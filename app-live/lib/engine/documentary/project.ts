import { createId } from '@paralleldrive/cuid2'
import { generateText, type LanguageModel } from 'ai'
import { z } from 'zod'

import { kvGetJSON, kvSetJSON } from '@/lib/engine/kv'

import { extractOpeningDate, parseDocumentaryScript } from './parse-script'
import { resolveContentProfile, WW1_WW2_DOCUMENTARY_PRESET } from './preset'
import { runDocumentaryQa } from './qa'
import { buildResearchDossier, validateDossier } from './research'
import {
  type DocumentaryAct,
  type DocumentaryBrief,
  type DocumentaryChapter,
  type DocumentaryProject,
  documentaryProjectSchema,
  type DocumentaryQaIssue,
  type DocumentarySource,
  type ResearchDossier
} from './schema'
import { generateDocumentaryObject } from './structured-output'

export type PrepareDocumentaryInput =
  | {
      mode: 'topic'
      topic: string
      targetMinutes: number
      language: string
      angle?: string
      sources: DocumentarySource[]
    }
  | {
      mode: 'script'
      script: string
      topic?: string
      targetMinutes?: number
      language: string
      sources: DocumentarySource[]
    }

interface PreparedChapters {
  chapters: DocumentaryChapter[]
  narration: string
}

interface ChapterCheckpoint {
  chapterId: string
  narration: string
  completedAt: string
}

const ACT_TITLES: Record<DocumentaryAct, string> = {
  'cold-open': 'The Moment Everything Changed',
  'strategic-context': 'The Strategic Situation',
  'build-up': 'Forces in Motion',
  conflict: 'The Battle Begins',
  'turning-point': 'The Turning Point',
  aftermath: 'The Cost',
  epilogue: 'What Changed'
}

const outlineChapterSchema = z.object({
  title: z.string().min(1),
  act: z.enum(WW1_WW2_DOCUMENTARY_PRESET.defaultActs),
  dateRange: z.string().optional(),
  locationIds: z.array(z.string()),
  claimIds: z.array(z.string()),
  entityIds: z.array(z.string()),
  emotionalObjective: z.string().min(1),
  retentionHook: z.string().min(1),
  minutes: z.number().positive()
})

const outlineSchema = z.object({
  chapters: z.array(outlineChapterSchema).min(2).max(7)
})

function qaReport(issues: DocumentaryQaIssue[]) {
  return {
    publishReady: !issues.some(issue => issue.severity === 'blocking'),
    issues
  }
}

function openingDateIssue(narration: string): DocumentaryQaIssue[] {
  if (extractOpeningDate(narration)) return []
  return [
    {
      code: 'opening-date-missing',
      severity: 'blocking',
      message:
        'The generated documentary does not begin with a concrete historical date.',
      claimIds: [],
      beatIds: [],
      assetIds: [],
      evidence: narration.split(/(?<=[.!?])\s+/u, 1)[0] ?? narration,
      suggestedAction:
        'Regenerate the Cold Open with a dossier-backed year and location.'
    }
  ]
}

function inferredMinutes(narration: string) {
  const words = narration.trim().split(/\s+/u).filter(Boolean).length
  return Math.min(60, Math.max(0.5, Number((words / 145).toFixed(2))))
}

function inferTopic(brief: DocumentaryBrief, narration: string) {
  const fromBrief = brief.whatTheVideoIsAbout.trim()
  if (fromBrief) return fromBrief.slice(0, 180)
  return (
    narration.split(/(?<=[.!?])\s+/u, 1)[0]?.slice(0, 180) ||
    'WW1/WW2 documentary'
  )
}

function sentenceRanges(narration: string) {
  return Array.from(
    narration.matchAll(/[^.!?]+(?:[.!?]+(?=\s|$)|$)\s*/gu),
    match => ({
      start: match.index,
      end: match.index + match[0].trimEnd().length
    })
  ).filter(range => range.end > range.start)
}

export async function classifyImportedChapters(
  narration: string,
  dossier: ResearchDossier
): Promise<PreparedChapters> {
  const ranges = sentenceRanges(narration)
  const chapterCount = Math.min(7, Math.max(1, ranges.length))
  const acts = WW1_WW2_DOCUMENTARY_PRESET.defaultActs.slice(0, chapterCount)
  const allEntityIds = [
    ...dossier.people,
    ...dossier.militaryUnits,
    ...dossier.equipment
  ].map(entity => entity.id)
  const opening = extractOpeningDate(narration)
  const chapters = acts.map((act, index) => {
    const firstSentence = Math.floor((index * ranges.length) / chapterCount)
    const nextSentence = Math.floor(
      ((index + 1) * ranges.length) / chapterCount
    )
    const startNarrationOffset = ranges[firstSentence]?.start ?? 0
    const endNarrationOffset =
      ranges[Math.max(firstSentence, nextSentence - 1)]?.end ?? narration.length

    return {
      id: `chapter-${index + 1}`,
      title: ACT_TITLES[act],
      act,
      startNarrationOffset,
      endNarrationOffset,
      dateRange: index === 0 ? opening?.label : undefined,
      locationIds: dossier.locations.map(location => location.id),
      claimIds: dossier.claims.map(claim => claim.id),
      entityIds: allEntityIds,
      emotionalObjective:
        index === 0
          ? 'Establish the decisive moment and central historical question.'
          : `Advance the documented ${ACT_TITLES[act].toLowerCase()} phase.`,
      retentionHook:
        index === chapterCount - 1
          ? 'Resolve the opening question with the documented strategic consequence.'
          : 'End on the next unresolved decision or consequence.'
    }
  })

  return { chapters, narration }
}

async function planAndGenerateTopicChapters(
  model: LanguageModel,
  projectId: string,
  input: Extract<PrepareDocumentaryInput, { mode: 'topic' }>,
  dossier: ResearchDossier
): Promise<PreparedChapters> {
  const object = await generateDocumentaryObject({
    model,
    schema: outlineSchema,
    system: `Plan an evidence-led WW1/WW2 documentary in the seven-act order: ${WW1_WW2_DOCUMENTARY_PRESET.defaultActs.join(', ')}. Use only claim, entity, and location IDs in the supplied dossier. The Cold Open must specify a sourced date and location; the Epilogue must answer its central question.`,
    prompt: JSON.stringify({
      topic: input.topic,
      angle: input.angle,
      targetMinutes: input.targetMinutes,
      dossier
    }),
    maxOutputTokens: 6000
  })
  const outline = outlineSchema.parse(object)
  const completed: Array<{
    outline: z.infer<typeof outlineChapterSchema>
    text: string
  }> = []

  for (const [index, chapter] of outline.chapters.entries()) {
    const chapterId = `${projectId}-chapter-${index + 1}`
    const checkpointKey = `documentary:${projectId}:chapter:${chapterId}`
    const checkpoint = await kvGetJSON<ChapterCheckpoint>(checkpointKey)
    let text = checkpoint?.narration.trim()

    if (!text) {
      const previousEnding = completed.at(-1)?.text.slice(-500) ?? ''
      const result = await generateText({
        model,
        system:
          'Write clean spoken historical-documentary narration. Use only the supplied dossier claims. Do not include headings, citations, stage directions, or metadata.',
        prompt: JSON.stringify({
          topic: input.topic,
          language: input.language,
          thesis: dossier.thesis,
          act: chapter.act,
          title: chapter.title,
          emotionalObjective: chapter.emotionalObjective,
          retentionHook: chapter.retentionHook,
          wordBudget: Math.max(75, Math.round(chapter.minutes * 145)),
          claimIds: chapter.claimIds,
          citations: dossier.citations.filter(citation =>
            dossier.claims.some(
              claim =>
                chapter.claimIds.includes(claim.id) &&
                claim.citationIds.includes(citation.id)
            )
          ),
          previousChapterEnding: previousEnding,
          openingRule:
            chapter.act === 'cold-open'
              ? 'The first sentence must begin with a dossier-backed date/year and location.'
              : undefined,
          resolutionRule:
            chapter.act === 'epilogue'
              ? 'Answer the Cold Open question using verified claims.'
              : undefined
        })
      })
      text = result.text.trim()
      if (!text)
        throw new Error(`Model returned empty narration for ${chapterId}`)
      await kvSetJSON(checkpointKey, {
        chapterId,
        narration: text,
        completedAt: new Date().toISOString()
      } satisfies ChapterCheckpoint)
    }

    completed.push({ outline: chapter, text })
  }

  let cursor = 0
  const chapters = completed.map(({ outline: chapter, text }, index) => {
    const startNarrationOffset = cursor
    cursor += text.length
    const endNarrationOffset = cursor
    if (index < completed.length - 1) cursor += 2
    return {
      id: `${projectId}-chapter-${index + 1}`,
      title: chapter.title,
      act: chapter.act,
      startNarrationOffset,
      endNarrationOffset,
      dateRange: chapter.dateRange,
      locationIds: chapter.locationIds,
      claimIds: chapter.claimIds,
      entityIds: chapter.entityIds,
      emotionalObjective: chapter.emotionalObjective,
      retentionHook: chapter.retentionHook
    }
  })

  return {
    chapters,
    narration: completed.map(chapter => chapter.text).join('\n\n')
  }
}

function makeTopicBrief(
  input: Extract<PrepareDocumentaryInput, { mode: 'topic' }>,
  dossier: ResearchDossier
): DocumentaryBrief {
  return {
    whatTheVideoIsAbout: input.angle
      ? `${input.topic}: ${input.angle}`
      : input.topic,
    styleOfTalking:
      'Premium, grounded historical documentary with escalating evidence-led tension.',
    whoThisVideoIsFor:
      'Viewers of WW1, WW2, military history, and strategic turning-point documentaries.',
    keyFacts: dossier.claims.map(claim => claim.text),
    inferredFields: []
  }
}

export async function prepareDocumentaryProject(
  model: LanguageModel,
  input: PrepareDocumentaryInput
): Promise<DocumentaryProject> {
  if (input.mode === 'topic' && input.sources.length === 0) {
    throw new Error('Topic mode requires at least one structured source')
  }

  const parsed =
    input.mode === 'script' ? parseDocumentaryScript(input.script) : null
  const topic =
    input.mode === 'topic'
      ? input.topic
      : (input.topic ?? inferTopic(parsed!.brief, parsed!.narration))
  const dossier = await buildResearchDossier(model, {
    topic,
    narration: parsed?.narration,
    sources: input.sources
  })
  const id = createId()
  const prepared =
    input.mode === 'topic'
      ? await planAndGenerateTopicChapters(model, id, input, dossier)
      : await classifyImportedChapters(parsed!.narration, dossier)
  const now = new Date().toISOString()
  const issues = [
    ...(parsed?.issues ?? openingDateIssue(prepared.narration)),
    ...validateDossier(dossier)
  ]
  let project = documentaryProjectSchema.parse({
    id,
    profile: resolveContentProfile('ww1_ww2', 'documentary'),
    inputMode: input.mode,
    topic,
    targetMinutes:
      input.targetMinutes ??
      inferredMinutes(parsed?.narration ?? prepared.narration),
    language: input.language,
    brief:
      parsed?.brief ??
      makeTopicBrief(
        input as Extract<PrepareDocumentaryInput, { mode: 'topic' }>,
        dossier
      ),
    narration: parsed?.narration ?? prepared.narration,
    rotationLog: parsed?.rotationLog,
    dossier,
    chapters: prepared.chapters,
    beats: [],
    assets: [],
    qa: qaReport(issues),
    createdAt: now,
    updatedAt: now
  })

  project = documentaryProjectSchema.parse({
    ...project,
    qa: runDocumentaryQa(project)
  })

  await kvSetJSON(`documentary:${project.id}`, project)
  return project
}

export async function loadDocumentaryProject(
  id: string
): Promise<DocumentaryProject | null> {
  const value = await kvGetJSON<unknown>(`documentary:${id}`)
  return value === null ? null : documentaryProjectSchema.parse(value)
}
