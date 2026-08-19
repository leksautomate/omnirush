# WW1/WW2 Premium Documentary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class WW1/WW2 documentary pipeline that accepts a topic or VidRush-style script, produces evidence-backed semantic scenes and cinematic overlays, enforces reusable-media rights, and renders a Studio-editable project up to 60 minutes.

**Architecture:** Introduce a focused `lib/engine/documentary/` domain layer whose Zod schemas are the canonical contract for parsing, research, chapter planning, semantic beats, rights, credits, and QA. Existing video tools become adapters: the researcher prepares a documentary project, `cutBeats` creates documentary-aware beats, `sourceFootage` selects only rights-safe media, and `composeRender` preserves the complete project into the Remotion storyboard. Remotion receives typed documentary graphics plus the four registered local background plates; Studio edits the same persisted storyboard used by preview and Lambda render.

**Tech Stack:** TypeScript, Zod 4, Vercel AI SDK 6, Vitest, React 19, Next.js 16, Remotion 4, Redis/Upstash KV, existing Pixabay audio catalogue.

**Spec:** `docs/superpowers/specs/2026-08-14-ww1-ww2-documentary-design.md`

## Global Constraints

- Scope is only `ww1_ww2 + documentary`; do not add history listicles, general explainers, breakdowns, or other niche/format combinations.
- Supported duration is exactly 0.5 through 60 minutes. Topic projects over 20 minutes are generated and persisted chapter by chapter.
- Imported narration is preserved byte-for-byte after metadata extraction unless the user explicitly requests rewriting.
- Every documentary opening must contain a year; otherwise emit the blocking issue code `opening-date-missing` and suggest, but do not insert, a replacement sentence.
- Four Pillars and Rotation Log content never enter narration, TTS, or captions.
- Standard YouTube and unknown-rights web media are reference-only and cannot appear in final-render assets.
- AI reconstruction is internally marked `ai-generated`; do not render a per-scene AI label.
- `app-live/background/bg1.mp4` through `bg4.mp4` remain untouched; copy them to the public Remotion tree and always render them muted.
- Reuse the completed curated Pixabay music, ambience, SFX, ducking, and transition implementation; do not replace it.
- Preview, Studio, Lambda, credits export, and QA consume the same canonical storyboard.
- Preserve unrelated dirty-worktree changes. Stage only files named in the current task.
- Do not set Git author identity automatically. If a commit is blocked by missing `user.name` or `user.email`, leave the task changes unstaged and report the blocker.
- Run commands from `app-live/` unless a command explicitly names a root-level document.

---

## File Structure

### New documentary domain files

- `app-live/lib/engine/documentary/schema.ts` — canonical Zod schemas and inferred TypeScript types for profile, brief, sources, dossier, chapters, semantic beats, graphics, rights, assets, project, and QA.
- `app-live/lib/engine/documentary/preset.ts` — connects the existing niche concept to the exact `ww1_ww2 + documentary` content profile and creative defaults.
- `app-live/lib/engine/documentary/parse-script.ts` — parses Four Pillars, clean narration, CTA, Rotation Log, inferred fields, and opening date/location.
- `app-live/lib/engine/documentary/research.ts` — builds a structured claim/citation dossier from supplied source records and validates evidence/quotation relationships.
- `app-live/lib/engine/documentary/project.ts` — orchestrates Topic and Script modes, chapter planning, long-form generation checkpoints, project IDs, and KV persistence.
- `app-live/lib/engine/documentary/planner.ts` — creates semantic documentary beats and deterministic graphic/background instructions.
- `app-live/lib/engine/documentary/rights.ts` — classifies asset rights, filters final-render candidates, and creates reconstruction fallbacks.
- `app-live/lib/engine/documentary/backgrounds.ts` — immutable registry for the four user-provided background plates.
- `app-live/lib/engine/documentary/credits.ts` — deduplicates final asset and citation credits and exports YouTube-description text.
- `app-live/lib/engine/documentary/qa.ts` — emits stable blockers/warnings and `publishReady`.
- `app-live/lib/tools/video/prepare-documentary.ts` — AI SDK tool that turns topic/script input plus researched sources into a persisted documentary project.

### New renderer and UI files

- `app-live/remotion/documentary-schema.ts` — render-safe documentary graphic union and metadata schemas imported by the main storyboard schema.
- `app-live/remotion/documentary/DocumentaryBackground.tsx` — muted looping background-video layer.
- `app-live/remotion/documentary/DocumentaryGraphic.tsx` — exhaustive graphic dispatcher.
- `app-live/remotion/documentary/DocumentaryGraphicBoundary.tsx` — beat-scoped overlay fallback that leaves the underlying archival/media layer visible and reports the affected beat ID.
- `app-live/remotion/documentary/ArchivalPhotoTreatment.tsx` — depth-safe Ken Burns movement, subject-aware crop, and restrained bg3 film treatment without invented human motion.
- `app-live/remotion/documentary/DateLocationCard.tsx` — opening/chapter date and location treatment.
- `app-live/remotion/documentary/BattleMap.tsx` — phased map, unit, route, objective, and front-line animation.
- `app-live/remotion/documentary/MilitaryTimeline.tsx` — dated event progression.
- `app-live/remotion/documentary/ForceComparison.tsx` — generic opposing-force comparison.
- `app-live/remotion/documentary/EquipmentSpec.tsx` — model/variant and typed specification presentation.
- `app-live/remotion/documentary/EvidenceCard.tsx` — evidence and exact-quotation card.
- `app-live/remotion/documentary/StatisticsPanel.tsx` — counter, bar, before/after, and opposing-side statistics.
- `app-live/components/documentary-section.tsx` — chat tool result for documentary preparation.
- `app-live/components/studio/documentary-inspector.tsx` — chapter, claims, rights, graphics, background, QA, and credits controls.
- `app-live/public/documentary/backgrounds/bg1.mp4` through `bg4.mp4` — public copies of the original muted plates.

### Existing integration files to modify

- `app-live/lib/engine/niche-presets.ts` — delegate WW1/WW2 documentary resolution to the new preset instead of leaving presets disconnected.
- `app-live/lib/engine/beats.ts` and `app-live/lib/tools/video/cut-beats.ts` — accept a documentary project ID and retain chapter/claim/entity/graphic metadata.
- `app-live/lib/engine/sourcing.ts` and `app-live/lib/tools/video/source-footage.ts` — attach structured rights and filter final-render candidates.
- `app-live/remotion/schema.ts` and `app-live/remotion/Storyboard.tsx` — add documentary metadata/graphics without regressing existing generic projects.
- `app-live/lib/tools/video/compose-render.ts` — merge stored documentary fields losslessly.
- `app-live/lib/agents/researcher.ts`, `app-live/lib/types/agent.ts`, `app-live/lib/types/ai.ts`, `app-live/lib/streaming/helpers/sanitize-messages-for-model.ts`, and `app-live/components/tool-section.tsx` — register and display `prepareDocumentary`.
- `app-live/components/studio-canvas.tsx` — mount the focused documentary inspector for documentary storyboards.

---

### Task 1: Canonical Documentary Schemas and Connected Preset

**Files:**
- Create: `app-live/lib/engine/documentary/schema.ts`
- Create: `app-live/lib/engine/documentary/preset.ts`
- Create: `app-live/lib/engine/documentary/__tests__/schema.test.ts`
- Modify: `app-live/lib/engine/niche-presets.ts`

**Interfaces:**
- Consumes: existing `Transition` and `TimedWord` shapes from `remotion/schema.ts` only through structurally compatible schemas; do not create a runtime import cycle.
- Produces: `contentProfileSchema`, `documentarySourceSchema`, `researchDossierSchema`, `documentaryChapterSchema`, `graphicInstructionSchema`, `assetRightsSchema`, `documentaryAssetSchema`, `documentaryBeatSchema`, `documentaryQaReportSchema`, `documentaryProjectSchema`, and all inferred types.
- Produces: `WW1_WW2_DOCUMENTARY_PRESET` and `resolveContentProfile(niche, format): ContentProfile`.

- [ ] **Step 1: Write the failing schema and preset tests**

```ts
import { describe, expect, it } from 'vitest'

import { resolveContentProfile } from '../preset'
import {
  documentaryProjectSchema,
  evidenceGraphicSchema,
  quoteGraphicSchema
} from '../schema'

describe('documentary contract', () => {
  it('resolves niche and format as independent fields', () => {
    expect(resolveContentProfile('ww1_ww2', 'documentary')).toEqual({
      niche: 'ww1_ww2',
      format: 'documentary',
      presetVersion: 1
    })
  })

  it('rejects an evidence card without a citation id', () => {
    expect(
      evidenceGraphicSchema.safeParse({
        type: 'evidence-card',
        documentTitle: 'Station HYPO report',
        institution: 'US Navy',
        date: '1942-05-28',
        excerpt: 'AF is short of water'
      }).success
    ).toBe(false)
  })

  it('rejects a quotation card without an exact source URL', () => {
    expect(
      quoteGraphicSchema.safeParse({
        type: 'quote-card',
        quote: 'AF is short of water',
        speaker: 'Station HYPO',
        citationId: 'citation-1'
      }).success
    ).toBe(false)
  })

  it('accepts projects from thirty seconds through sixty minutes', () => {
    const base = makeValidDocumentaryProject()
    expect(documentaryProjectSchema.safeParse({ ...base, targetMinutes: 0.5 }).success).toBe(true)
    expect(documentaryProjectSchema.safeParse({ ...base, targetMinutes: 60 }).success).toBe(true)
    expect(documentaryProjectSchema.safeParse({ ...base, targetMinutes: 60.1 }).success).toBe(false)
  })
})
```

Include a local `makeValidDocumentaryProject()` fixture in the test with empty arrays for valid optional collections and one valid chapter/beat so every required field is exercised.

- [ ] **Step 2: Run the focused test and verify the imports fail**

Run: `bun run test lib/engine/documentary/__tests__/schema.test.ts`

Expected: FAIL because `../schema` and `../preset` do not exist.

- [ ] **Step 3: Implement the canonical schemas**

Define literal unions rather than free-text strings. The core declarations must include these exact names and fields:

```ts
import { z } from 'zod'

export const contentProfileSchema = z.object({
  niche: z.literal('ww1_ww2'),
  format: z.literal('documentary'),
  presetVersion: z.literal(1)
})

export const sourceClassSchema = z.enum([
  'primary',
  'institutional',
  'secondary',
  'discovery-only'
])

export const citationRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  authorOrInstitution: z.string().min(1),
  url: z.string().url(),
  publicationDate: z.string().optional(),
  accessedAt: z.string().datetime(),
  sourceClass: sourceClassSchema,
  supportingNote: z.string().min(1),
  reliability: z.enum(['high', 'medium', 'low'])
})

export const claimRecordSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  importance: z.enum(['critical', 'supporting']),
  verification: z.enum(['verified', 'unverified', 'disputed', 'contradicted']),
  citationIds: z.array(z.string().min(1)),
  suggestedCorrection: z.string().optional()
})

export const assetRightsSchema = z.object({
  provider: z.enum([
    'wikimedia', 'internet-archive', 'nara', 'youtube',
    'user-provided', 'ai-generated', 'web'
  ]),
  sourceUrl: z.string().url().optional(),
  creator: z.string().optional(),
  institution: z.string().optional(),
  license: z.enum([
    'public-domain', 'cc0', 'cc-by', 'cc-by-sa',
    'permission', 'standard-youtube', 'unknown'
  ]),
  attribution: z.string().optional(),
  reusable: z.boolean(),
  reviewRequired: z.boolean(),
  accessedAt: z.string().datetime()
})
```

Also implement all beat types and graphic variants from the spec as a discriminated union on `type`. Keep force sides generic (`name`, `allegiance`, optional personnel/aircraft/ships/vehicles/artillery) and equipment specifications typed as `{ label, value, unit?, claimId }`. `DocumentaryProject` must contain all canonical fields in the spec and add `createdAt`/`updatedAt` ISO datetimes for persistence.

- [ ] **Step 4: Implement and connect the preset**

```ts
import type { ContentProfile } from './schema'

export const WW1_WW2_DOCUMENTARY_PRESET = {
  profile: { niche: 'ww1_ww2', format: 'documentary', presetVersion: 1 },
  palette: {
    charcoal: '#171717', parchment: '#D8C7A3', brass: '#B6924A',
    offWhite: '#F2EBDD', allied: '#4776B9', axis: '#A4473E', neutral: '#77736B'
  },
  openingDateRequired: true,
  defaultActs: [
    'cold-open', 'strategic-context', 'build-up', 'conflict',
    'turning-point', 'aftermath', 'epilogue'
  ]
} as const

export function resolveContentProfile(
  niche: 'ww1_ww2',
  format: 'documentary'
): ContentProfile {
  if (niche !== 'ww1_ww2' || format !== 'documentary') {
    throw new Error(`Unsupported content profile: ${niche}/${format}`)
  }
  return { ...WW1_WW2_DOCUMENTARY_PRESET.profile }
}
```

Update `niche-presets.ts` so `history_ww1_ww2` exposes this documentary profile and preset, while preserving current callers and other existing niche entries.

- [ ] **Step 5: Run tests, lint the touched files, and commit**

Run: `bun run test lib/engine/documentary/__tests__/schema.test.ts`

Expected: PASS.

Run: `bunx eslint lib/engine/documentary/schema.ts lib/engine/documentary/preset.ts lib/engine/niche-presets.ts lib/engine/documentary/__tests__/schema.test.ts`

Expected: no new errors.

```bash
git add app-live/lib/engine/documentary/schema.ts app-live/lib/engine/documentary/preset.ts app-live/lib/engine/documentary/__tests__/schema.test.ts app-live/lib/engine/niche-presets.ts
git commit -m "feat: add ww1 ww2 documentary contract"
```

### Task 2: VidRush Script Import and Opening-Date Validation

**Files:**
- Create: `app-live/lib/engine/documentary/parse-script.ts`
- Create: `app-live/lib/engine/documentary/__tests__/parse-script.test.ts`
- Create: `app-live/lib/engine/documentary/__tests__/fixtures/midway-vidrush.txt`

**Interfaces:**
- Consumes: `DocumentaryBrief`, `RotationLog`, and `DocumentaryQaIssue` from `schema.ts`.
- Produces: `parseDocumentaryScript(text: string): ParsedDocumentaryScript`.
- Produces: `extractOpeningDate(narration: string): { label: string; year: number } | null`.
- `ParsedDocumentaryScript` contains `originalText`, `brief`, `narration`, optional `cta`, optional `rotationLog`, `inferredFields`, `openingDate`, and `issues`.

- [ ] **Step 1: Add the Midway fixture and failing parser tests**

Copy the supplied Midway document into the repository fixture so tests do not depend on `C:\Users\leksi\.codex\attachments`. Then add:

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { extractOpeningDate, parseDocumentaryScript } from '../parse-script'

const fixture = readFileSync(
  fileURLToPath(new URL('./fixtures/midway-vidrush.txt', import.meta.url)),
  'utf8'
)

describe('parseDocumentaryScript', () => {
  it('keeps metadata and rotation log out of narration', () => {
    const parsed = parseDocumentaryScript(fixture)
    expect(parsed.brief.whatTheVideoIsAbout).toContain('June 1942')
    expect(parsed.narration).toMatch(/^By the summer of 1942/)
    expect(parsed.narration).not.toContain('What the Video Is About')
    expect(parsed.narration).not.toContain('Rotation Log')
    expect(parsed.rotationLog).toBeDefined()
  })

  it.each([
    ['By June 1942, the carrier war had changed.', 1942],
    ['On September 1, 1939, Germany invaded Poland.', 1939],
    ['By the summer of 1942, Japan appeared unstoppable.', 1942],
    ['Between 1914 and 1918, Europe was transformed.', 1914]
  ])('accepts a dated opening: %s', (text, year) => {
    expect(extractOpeningDate(text)?.year).toBe(year)
  })

  it('blocks an undated opening without rewriting narration', () => {
    const text = 'Japan appeared unstoppable.\n\nIts carrier fleet crossed the Pacific.'
    const parsed = parseDocumentaryScript(text)
    expect(parsed.narration).toBe(text)
    expect(parsed.issues).toContainEqual(
      expect.objectContaining({ code: 'opening-date-missing', severity: 'blocking' })
    )
    expect(parsed.issues[0].suggestedAction).toContain('year')
  })
})
```

- [ ] **Step 2: Run the parser test and verify failure**

Run: `bun run test lib/engine/documentary/__tests__/parse-script.test.ts`

Expected: FAIL because `parse-script.ts` does not exist.

- [ ] **Step 3: Implement deterministic section parsing**

Use normalized headings that accept emoji or plain-text variants. Stop narration at `🔄 Rotation Log`; locate clean narration after the Key Facts section, not by stripping arbitrary lines from the user text.

```ts
const HEADING_PATTERNS = {
  about: /^\s*(?:🎥\s*)?what the video is about\s*:??\s*$/im,
  style: /^\s*(?:🗣️\s*)?style of talking\s*:??\s*$/im,
  audience: /^\s*(?:🎯\s*)?who this video is for\s*:??\s*$/im,
  facts: /^\s*(?:📌\s*)?key facts covered\s*:??\s*$/im,
  rotation: /^\s*(?:🔄\s*)?rotation log\s*:??\s*$/im
} as const

const OPENING_DATE = /\b(?:between\s+)?(?:(?:january|february|march|april|may|june|july|august|september|october|november|december|spring|summer|autumn|fall|winter)\s+(?:\d{1,2},?\s+)?)?(1[89]\d{2}|20\d{2})\b/i

export function extractOpeningDate(narration: string) {
  const firstSentence = narration.trim().split(/(?<=[.!?])\s+/u, 1)[0] ?? ''
  const match = firstSentence.match(OPENING_DATE)
  return match ? { label: match[0], year: Number(match[1]) } : null
}
```

Return section-level diagnostics for malformed structured input. For narration-only input, infer brief fields as empty strings, record all inferred field names, and retain the entire original as narration. Split a CTA only when the final paragraph clearly begins with `If`, `Subscribe`, `Like`, or `Comment`; retain it in narration because it is spoken, while also exposing it as `cta` for editing.

- [ ] **Step 4: Run the parser suite and commit**

Run: `bun run test lib/engine/documentary/__tests__/parse-script.test.ts`

Expected: PASS, including the exact Midway opening and metadata exclusion checks.

```bash
git add app-live/lib/engine/documentary/parse-script.ts app-live/lib/engine/documentary/__tests__/parse-script.test.ts app-live/lib/engine/documentary/__tests__/fixtures/midway-vidrush.txt
git commit -m "feat: import vidrush documentary scripts"
```

### Task 3: Evidence-Backed Research Dossier

**Files:**
- Create: `app-live/lib/engine/documentary/research.ts`
- Create: `app-live/lib/engine/documentary/__tests__/research.test.ts`

**Interfaces:**
- Consumes: `DocumentarySource`, `ResearchDossier`, `ClaimRecord`, and `CitationRecord` from `schema.ts`.
- Produces: `buildResearchDossier(model, input): Promise<ResearchDossier>` where `input` is `{ topic: string; narration?: string; sources: DocumentarySource[] }`.
- Produces: `validateDossier(dossier): DocumentaryQaIssue[]` and `citationCanVerifyCriticalClaim(citation): boolean`.

- [ ] **Step 1: Write failing validation and AI-mapping tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const generateObject = vi.fn()
vi.mock('ai', () => ({ generateObject }))

import {
  buildResearchDossier,
  citationCanVerifyCriticalClaim,
  validateDossier
} from '../research'

describe('documentary research', () => {
  beforeEach(() => generateObject.mockReset())

  it('does not let discovery-only sources verify critical claims', () => {
    expect(citationCanVerifyCriticalClaim({ sourceClass: 'discovery-only' })).toBe(false)
  })

  it('flags a critical claim whose citations cannot verify it', () => {
    const dossier = makeDossier({
      claims: [{
        id: 'claim-1', text: 'Japan lost four fleet carriers.', importance: 'critical',
        verification: 'verified', citationIds: ['citation-1']
      }],
      citations: [{ ...makeCitation('citation-1'), sourceClass: 'discovery-only' }]
    })
    expect(validateDossier(dossier)).toContainEqual(
      expect.objectContaining({ code: 'critical-claim-unsupported', claimIds: ['claim-1'] })
    )
  })

  it('passes only supplied source records to dossier generation', async () => {
    generateObject.mockResolvedValue({ object: makeDossier() })
    await buildResearchDossier('test-model' as never, {
      topic: 'Battle of Midway',
      sources: [makeSource('https://www.history.navy.mil/midway')]
    })
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('https://www.history.navy.mil/midway')
      })
    )
  })
})
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `bun run test lib/engine/documentary/__tests__/research.test.ts`

Expected: FAIL because `research.ts` does not exist.

- [ ] **Step 3: Implement dossier generation and deterministic validation**

```ts
import { generateObject, type LanguageModel } from 'ai'

import {
  researchDossierSchema,
  type CitationRecord,
  type DocumentarySource,
  type ResearchDossier
} from './schema'

export function citationCanVerifyCriticalClaim(
  citation: Pick<CitationRecord, 'sourceClass' | 'reliability'>
) {
  return citation.sourceClass !== 'discovery-only' && citation.reliability !== 'low'
}

export async function buildResearchDossier(
  model: LanguageModel,
  input: { topic: string; narration?: string; sources: DocumentarySource[] }
): Promise<ResearchDossier> {
  const { object } = await generateObject({
    model,
    schema: researchDossierSchema,
    system: 'Build a WW1/WW2 research dossier using only the supplied sources. Never invent a citation, URL, quotation, date, unit, person, location, or equipment model.',
    prompt: JSON.stringify(input)
  })
  return researchDossierSchema.parse(object)
}
```

`validateDossier` must check broken citation IDs, critical claims supported only by discovery/low-reliability citations, exact quotations without a valid citation URL, and contradictory verification states. Return stable issue codes and affected IDs; never mutate the dossier.

- [ ] **Step 4: Run the research suite and commit**

Run: `bun run test lib/engine/documentary/__tests__/research.test.ts`

Expected: PASS.

```bash
git add app-live/lib/engine/documentary/research.ts app-live/lib/engine/documentary/__tests__/research.test.ts
git commit -m "feat: build cited documentary dossiers"
```

### Task 4: Topic/Script Project Preparation and Long-Form Persistence

**Files:**
- Create: `app-live/lib/engine/documentary/project.ts`
- Create: `app-live/lib/tools/video/prepare-documentary.ts`
- Create: `app-live/lib/engine/documentary/__tests__/project.test.ts`
- Create: `app-live/lib/tools/video/__tests__/prepare-documentary.test.ts`

**Interfaces:**
- Consumes: `parseDocumentaryScript`, `buildResearchDossier`, canonical schemas, `kvGetJSON`, and `kvSetJSON`.
- Produces: `prepareDocumentaryProject(model, input): Promise<DocumentaryProject>`.
- Produces: `loadDocumentaryProject(id): Promise<DocumentaryProject | null>`.
- Produces: `createPrepareDocumentaryTool(model)` with input `{ mode, topic?, script?, targetMinutes, language, angle?, sources }`.
- Persistence keys: `documentary:${projectId}` and `documentary:${projectId}:chapter:${chapterId}`.

- [ ] **Step 1: Write failing orchestration tests**

```ts
it('preserves imported narration and persists a script project', async () => {
  const project = await prepareDocumentaryProject(model, {
    mode: 'script', script: midwayFixture, targetMinutes: 12,
    language: 'English', sources: [navalHistorySource]
  })
  expect(project.inputMode).toBe('script')
  expect(project.narration).toMatch(/^By the summer of 1942/)
  expect(project.narration).not.toContain('Rotation Log')
  expect(kvSetJSON).toHaveBeenCalledWith(`documentary:${project.id}`, project)
})

it('generates and checkpoints every chapter above twenty minutes', async () => {
  generateText.mockResolvedValue({ text: 'Chapter narration.' })
  const project = await prepareDocumentaryProject(model, {
    mode: 'topic', topic: 'The Battle of the Atlantic', targetMinutes: 45,
    language: 'English', sources: [archiveSource, museumSource]
  })
  expect(generateText).toHaveBeenCalledTimes(project.chapters.length)
  for (const chapter of project.chapters) {
    expect(kvSetJSON).toHaveBeenCalledWith(
      `documentary:${project.id}:chapter:${chapter.id}`,
      expect.objectContaining({ chapterId: chapter.id })
    )
  }
})

it('refuses topic mode without researched sources', async () => {
  await expect(prepareDocumentaryProject(model, {
    mode: 'topic', topic: 'Operation Torch', targetMinutes: 10,
    language: 'English', sources: []
  })).rejects.toThrow('Topic mode requires at least one structured source')
})
```

Mock `ai`, the research builder, and KV so this test owns orchestration rather than model output.

- [ ] **Step 2: Run project and tool tests to verify failure**

Run: `bun run test lib/engine/documentary/__tests__/project.test.ts lib/tools/video/__tests__/prepare-documentary.test.ts`

Expected: FAIL because the project engine and tool are missing.

- [ ] **Step 3: Implement project preparation**

Use a discriminated input union and validate the paired fields:

```ts
export type PrepareDocumentaryInput =
  | { mode: 'topic'; topic: string; targetMinutes: number; language: string; angle?: string; sources: DocumentarySource[] }
  | { mode: 'script'; script: string; topic?: string; targetMinutes?: number; language: string; sources: DocumentarySource[] }

export async function prepareDocumentaryProject(
  model: LanguageModel,
  input: PrepareDocumentaryInput
): Promise<DocumentaryProject> {
  if (input.mode === 'topic' && input.sources.length === 0) {
    throw new Error('Topic mode requires at least one structured source')
  }
  const parsed = input.mode === 'script' ? parseDocumentaryScript(input.script) : null
  const topic = input.mode === 'topic' ? input.topic : input.topic ?? parsed!.brief.whatTheVideoIsAbout
  const dossier = await buildResearchDossier(model, {
    topic,
    narration: parsed?.narration,
    sources: input.sources
  })
  const prepared = input.mode === 'topic'
    ? await planAndGenerateTopicChapters(model, input, dossier)
    : await classifyImportedChapters(model, parsed!.narration, dossier)
  const now = new Date().toISOString()
  const project = documentaryProjectSchema.parse({
    id: createId(), profile: resolveContentProfile('ww1_ww2', 'documentary'),
    inputMode: input.mode, topic, targetMinutes: resolveTargetMinutes(input, parsed),
    language: input.language, brief: parsed?.brief ?? makeTopicBrief(input),
    narration: parsed?.narration ?? prepared.narration,
    rotationLog: parsed?.rotationLog, dossier, chapters: prepared.chapters, beats: [], assets: [],
    qa: mergeQaIssues(parsed?.issues ?? [], validateDossier(dossier)),
    createdAt: now, updatedAt: now
  })
  await kvSetJSON(`documentary:${project.id}`, project)
  return project
}
```

For Topic Mode, request a structured chapter outline first. When `targetMinutes > 20`, call `generateText` once per chapter with the same thesis, terminology, tense, voice rules, previous chapter ending, word budget (`minutes * 145` apportioned by chapter), and only relevant claim/citation IDs. Persist each completed chapter before proceeding. Resume by reading an existing chapter key before generating it. At or below 20 minutes, one script call may produce all chapters, followed by deterministic chapter-offset calculation.

The Cold Open prompt must require its first sentence to contain a dossier-backed year/date and location, and the Epilogue prompt must answer the Cold Open's central question using verified claims. Validate the generated first sentence with `extractOpeningDate`; a model miss remains a blocking QA issue and is never silently repaired.

For Script Mode, never send narration to a rewrite prompt. Use the dossier and narration offsets to classify text into the seven acts. Acts without evidence may be omitted, but cold open and epilogue must exist.

- [ ] **Step 4: Implement the AI SDK tool**

```ts
export function createPrepareDocumentaryTool(model: LanguageModel) {
  return tool({
    description: 'Prepare an evidence-backed WW1/WW2 documentary from a topic or existing script.',
    inputSchema: prepareDocumentaryInputSchema,
    execute: async input => {
      const project = await prepareDocumentaryProject(model, input)
      return {
        documentaryId: project.id,
        topic: project.topic,
        inputMode: project.inputMode,
        chapterCount: project.chapters.length,
        targetMinutes: project.targetMinutes,
        publishReady: project.qa.publishReady,
        issues: project.qa.issues
      }
    }
  })
}
```

Implement the loader with schema validation so corrupt or stale KV data cannot enter later stages:

```ts
export async function loadDocumentaryProject(id: string): Promise<DocumentaryProject | null> {
  const value = await kvGetJSON<unknown>(`documentary:${id}`)
  return value === null ? null : documentaryProjectSchema.parse(value)
}
```

- [ ] **Step 5: Run tests and commit**

Run: `bun run test lib/engine/documentary/__tests__/project.test.ts lib/tools/video/__tests__/prepare-documentary.test.ts`

Expected: PASS.

```bash
git add app-live/lib/engine/documentary/project.ts app-live/lib/tools/video/prepare-documentary.ts app-live/lib/engine/documentary/__tests__/project.test.ts app-live/lib/tools/video/__tests__/prepare-documentary.test.ts
git commit -m "feat: prepare long form documentary projects"
```

### Task 5: Semantic Beat and Automatic Graphic Planning

**Files:**
- Create: `app-live/lib/engine/documentary/planner.ts`
- Create: `app-live/lib/engine/documentary/__tests__/planner.test.ts`
- Modify: `app-live/lib/engine/beats.ts`
- Modify: `app-live/lib/tools/video/cut-beats.ts`
- Modify: `app-live/lib/engine/__tests__/beats.test.ts`

**Interfaces:**
- Consumes: `DocumentaryProject`, `DocumentaryBeat`, and graphic union from `schema.ts`.
- Produces: `planDocumentaryBeats(model, project): Promise<DocumentaryBeat[]>`.
- Produces: `chooseGraphicInstruction(context): GraphicInstruction | undefined` and `chooseBackgroundRole(graphicType): DocumentaryBackgroundId`.
- Extends `cutBeats` input with optional `documentaryId`; when present, it loads the project, uses documentary planning, persists enriched beats, and updates the project.

- [ ] **Step 1: Write failing planner tests for every semantic trigger**

```ts
it.each([
  ['movement from Midway toward the Japanese carriers', 'battle-map'],
  ['repairs completed between May 27 and May 30', 'military-timeline'],
  ['four Japanese carriers faced three American carriers', 'force-comparison'],
  ['the Zero had a top speed of 331 mph', 'equipment-spec'],
  ['the decrypted Station HYPO message showed AF was Midway', 'evidence-card'],
  ['Admiral Nimitz wrote, “They had no right to win.”', 'quote-card'],
  ['Japan lost four carriers and 248 aircraft', 'statistics']
])('maps narration to %s graphics', (narration, expectedType) => {
  const graphic = chooseGraphicInstruction(makePlannerContext(narration))
  expect(graphic?.type).toBe(expectedType)
})

it('assigns opening date and location to the first beat', async () => {
  const beats = await planDocumentaryBeats(model, makeMidwayProject())
  expect(beats[0]).toEqual(expect.objectContaining({
    dateLabel: expect.stringContaining('1942'),
    graphic: expect.objectContaining({ type: 'date-location' })
  }))
})

it('retains chapter, claim, entity, date, location and graphic metadata through cutBeats', async () => {
  const result = await cutBeatsTool.execute({ documentaryId: 'doc-1' }, options)
  expect(result.beats[0]).toEqual(expect.objectContaining({
    chapterId: 'chapter-1', claimIds: ['claim-1'], entityIds: ['unit-1'],
    locationIds: ['midway'], graphic: expect.objectContaining({ type: 'battle-map' })
  }))
})
```

- [ ] **Step 2: Run the planner and beat tests to verify failure**

Run: `bun run test lib/engine/documentary/__tests__/planner.test.ts lib/engine/__tests__/beats.test.ts`

Expected: FAIL because the planner and documentary path do not exist.

- [ ] **Step 3: Implement semantic planning**

Use structured model output for beat boundaries and IDs, then deterministic enrichment for required graphics. The model schema may select only IDs already present in the project.

```ts
export async function planDocumentaryBeats(
  model: LanguageModel,
  project: DocumentaryProject
): Promise<DocumentaryBeat[]> {
  const planned = await generateObject({
    model,
    schema: z.object({ beats: z.array(documentaryBeatPlanSchema) }),
    system: DOCUMENTARY_BEAT_SYSTEM,
    prompt: JSON.stringify({
      narration: project.narration,
      chapters: project.chapters,
      dossier: project.dossier
    })
  })
  return planned.object.beats.map((beat, index) => enrichBeat(beat, project, index))
}
```

Enrichment rules must force the opening `date-location` graphic; prefer maps for movement/geography, timelines for three or more dated events, comparisons for opposing quantities, equipment specs for model/variant facts, evidence cards for archival documents, quote cards only for exact cited quotations, and statistics for numeric change. Select `archival-video`/`archival-photo` for ordinary descriptive beats. Select `reconstruction` only later, after rights-safe sourcing fails.

Prevent the same `visualQuery` from appearing in adjacent beats and avoid more than two identical beat types consecutively when an evidence-backed graphic is available.

Use one exhaustive background-role mapping shared by the planner and Studio defaults:

```ts
export function chooseBackgroundRole(type: GraphicInstruction['type']): DocumentaryBackgroundId {
  switch (type) {
    case 'date-location':
    case 'quote-card': return 'bg1'
    case 'military-timeline':
    case 'evidence-card': return 'bg2'
    case 'battle-map':
    case 'force-comparison':
    case 'equipment-spec':
    case 'strategic-overlay':
    case 'statistics': return 'bg4'
  }
}
```

- [ ] **Step 4: Add the documentary branch to beat cutting**

```ts
const cutBeatsInputSchema = z.object({
  scriptId: z.string().optional(),
  documentaryId: z.string().optional()
}).superRefine((value, ctx) => {
  if ((value.scriptId ? 1 : 0) + (value.documentaryId ? 1 : 0) !== 1) {
    ctx.addIssue({ code: 'custom', message: 'Provide exactly one scriptId or documentaryId' })
  }
})
```

Keep the generic script path unchanged. On the documentary path, update `project.beats`, `updatedAt`, and `documentary:${id}` after persisting `beats:${beatsId}`.

- [ ] **Step 5: Run tests and commit**

Run: `bun run test lib/engine/documentary/__tests__/planner.test.ts lib/engine/__tests__/beats.test.ts`

Expected: PASS with existing generic beat tests unchanged.

```bash
git add app-live/lib/engine/documentary/planner.ts app-live/lib/engine/documentary/__tests__/planner.test.ts app-live/lib/engine/beats.ts app-live/lib/tools/video/cut-beats.ts app-live/lib/engine/__tests__/beats.test.ts
git commit -m "feat: plan semantic documentary beats"
```

### Task 6: Rights-Aware Archival Sourcing and Reconstruction Fallback

**Files:**
- Create: `app-live/lib/engine/documentary/rights.ts`
- Create: `app-live/lib/engine/documentary/__tests__/rights.test.ts`
- Modify: `app-live/lib/engine/sourcing.ts`
- Modify: `app-live/lib/tools/video/source-footage.ts`
- Modify: `app-live/lib/engine/__tests__/sourcing.test.ts`

**Interfaces:**
- Consumes: `AssetRights`, `DocumentaryAsset`, `DocumentaryBeat`, and existing `FootageAsset`.
- Produces: `classifyAssetRights(candidate, accessedAt): AssetRights`.
- Produces: `canUseInFinalRender(rights): boolean`.
- Produces: `selectDocumentaryAsset(beat, candidates, now): DocumentaryAsset | null`.
- Produces: `createReconstructionAsset(beat, context): DocumentaryAsset`.
- Extends `FootageAsset` with required `rights` for newly sourced candidates and optional `providerMetadata.youtubeLicense` for YouTube API evidence.

- [ ] **Step 1: Write the rights matrix tests**

```ts
it.each([
  ['public-domain', true], ['cc0', true], ['cc-by', true],
  ['cc-by-sa', true], ['permission', true],
  ['standard-youtube', false], ['unknown', false]
])('classifies %s final-render use as %s', (license, reusable) => {
  expect(canUseInFinalRender(makeRights({ license, reusable }))).toBe(reusable)
})

it('treats ordinary YouTube search results as reference-only', () => {
  const rights = classifyAssetRights({
    source: 'youtube', url: 'https://youtube.com/watch?v=abc', title: 'Midway footage'
  }, '2026-08-14T00:00:00.000Z')
  expect(rights).toMatchObject({
    provider: 'youtube', license: 'standard-youtube',
    reusable: false, reviewRequired: true
  })
})

it('accepts YouTube only with explicit Creative Commons API evidence', () => {
  const rights = classifyAssetRights({
    source: 'youtube', url: 'https://youtube.com/watch?v=cc',
    providerMetadata: { youtubeLicense: 'creativeCommon' }
  }, '2026-08-14T00:00:00.000Z')
  expect(rights).toMatchObject({ license: 'cc-by', reusable: true })
})

it('falls back from unsafe media to an internally tracked reconstruction', () => {
  const asset = createReconstructionAsset(makeBeat(), makeVerifiedContext())
  expect(asset.rights).toMatchObject({ provider: 'ai-generated', reusable: true })
  expect(asset).not.toHaveProperty('visibleAiLabel')
})
```

- [ ] **Step 2: Run rights and sourcing tests to verify failure**

Run: `bun run test lib/engine/documentary/__tests__/rights.test.ts lib/engine/__tests__/sourcing.test.ts`

Expected: FAIL because structured rights classification is missing.

- [ ] **Step 3: Implement rights classification and selection**

```ts
export function canUseInFinalRender(rights: AssetRights) {
  return rights.reusable && !['standard-youtube', 'unknown'].includes(rights.license)
}

export function selectDocumentaryAsset(
  beat: DocumentaryBeat,
  candidates: FootageAsset[],
  accessedAt: string
): DocumentaryAsset | null {
  return candidates
    .map(candidate => ({ candidate, rights: classifyAssetRights(candidate, accessedAt) }))
    .filter(item => canUseInFinalRender(item.rights))
    .sort(compareArchivePriorityThenScore)
    .map(({ candidate, rights }) => makeDocumentaryAsset(beat, candidate, rights))[0] ?? null
}
```

Classification rules:

- Wikimedia: parse the existing licence text into public-domain, CC0, CC BY, or CC BY-SA; unknown text is not reusable.
- Internet Archive/NARA/institutional: reusable only when the result contains explicit rights text or collection metadata mapped to public domain/Creative Commons.
- YouTube: `creativeCommon` API metadata maps to CC BY; `youtube`, missing metadata, or a watch-page URL maps to `standard-youtube` and `reusable: false`.
- User media: reusable only after an explicit `userConfirmedRights: true` input, mapped to `permission`.
- General web: `unknown`, `reusable: false`.

`createReconstructionAsset` must reject incomplete grounding. Its input includes verified `claimIds`, date or date range, location, uniforms, equipment/model, weather when known, and operational context. The generated prompt may omit an unknown weather value but cannot invent it. The returned asset stores those claim IDs, the exact prompt, `provider: 'ai-generated'`, and no field capable of enabling an automatic visible scene label.

Order safe results: NARA/institutional public domain, Wikimedia, Internet Archive, safe YouTube, user-provided, then generated reconstruction. Preserve creator, institution, source URL, attribution, access date, and licence on the chosen asset.

- [ ] **Step 4: Extend the sourcing tool without weakening generic search**

Add optional input fields:

```ts
{
  documentaryId?: string
  beatId?: string
  finalRender?: boolean
  userConfirmedRights?: boolean
}
```

When `finalRender` is true, return only `canUseInFinalRender` candidates. When no candidate survives and both documentary/beat IDs are present, return the verified-context reconstruction specification rather than an unsafe URL. Keep reference-only candidates in a separate `referenceCandidates` array for research inspection.

- [ ] **Step 5: Run tests and commit**

Run: `bun run test lib/engine/documentary/__tests__/rights.test.ts lib/engine/__tests__/sourcing.test.ts`

Expected: PASS, including existing watch-page and Internet Archive resolution tests.

```bash
git add app-live/lib/engine/documentary/rights.ts app-live/lib/engine/documentary/__tests__/rights.test.ts app-live/lib/engine/sourcing.ts app-live/lib/tools/video/source-footage.ts app-live/lib/engine/__tests__/sourcing.test.ts
git commit -m "feat: enforce documentary media rights"
```

### Task 7: Render Contract and Registered Documentary Backgrounds

**Files:**
- Create: `app-live/remotion/documentary-schema.ts`
- Create: `app-live/lib/engine/documentary/backgrounds.ts`
- Create: `app-live/remotion/__tests__/documentary-schema.test.ts`
- Modify: `app-live/remotion/schema.ts`
- Copy: `app-live/background/bg1.mp4` to `app-live/public/documentary/backgrounds/bg1.mp4`
- Copy: `app-live/background/bg2.mp4` to `app-live/public/documentary/backgrounds/bg2.mp4`
- Copy: `app-live/background/bg3.mp4` to `app-live/public/documentary/backgrounds/bg3.mp4`
- Copy: `app-live/background/bg4.mp4` to `app-live/public/documentary/backgrounds/bg4.mp4`

**Interfaces:**
- Consumes: schema shapes from Task 1 but defines render-local schemas to avoid importing server-only code into Remotion.
- Produces: `documentaryGraphicSchema`, `documentaryStoryboardMetadataSchema`, and inferred render types.
- Produces: `DOCUMENTARY_BACKGROUNDS` and `getDocumentaryBackground(id)`.
- Extends each storyboard shot with optional `documentary` metadata and the storyboard root with optional `documentaryProject` metadata.

- [ ] **Step 1: Write failing render-contract tests**

```ts
it('parses all documentary graphic variants', () => {
  for (const graphic of makeEveryGraphicFixture()) {
    expect(documentaryGraphicSchema.safeParse(graphic).success).toBe(true)
  }
})

it('keeps force comparison generic', () => {
  const parsed = documentaryGraphicSchema.parse({
    type: 'force-comparison',
    sides: [
      { name: 'US Task Forces', allegiance: 'allied', ships: 26, aircraft: 233, claimIds: ['c1'] },
      { name: 'First Air Fleet', allegiance: 'axis', ships: 21, aircraft: 248, claimIds: ['c2'] }
    ],
    backgroundId: 'bg4'
  })
  expect(parsed).not.toHaveProperty('lifespan')
  expect(parsed).not.toHaveProperty('cause')
})

it('registers all four backgrounds as muted public videos', () => {
  expect(Object.values(DOCUMENTARY_BACKGROUNDS)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: 'bg1', muted: true }),
      expect.objectContaining({ id: 'bg2', muted: true }),
      expect.objectContaining({ id: 'bg3', muted: true }),
      expect.objectContaining({ id: 'bg4', muted: true })
    ])
  )
})
```

- [ ] **Step 2: Run the schema test to verify failure**

Run: `bun run test remotion/__tests__/documentary-schema.test.ts`

Expected: FAIL because the render schema and background registry are missing.

- [ ] **Step 3: Implement the render-local schema and main storyboard extension**

The render graphic union must mirror the domain union exactly. Add these optional shot fields without removing the current generic `overlay` or `comparisonCards` fields:

```ts
documentary: z.object({
  beatType: documentaryBeatTypeSchema,
  chapterId: z.string(),
  claimIds: z.array(z.string()),
  entityIds: z.array(z.string()),
  locationIds: z.array(z.string()),
  dateLabel: z.string().optional(),
  graphic: documentaryGraphicSchema.optional(),
  assetId: z.string().optional(),
  rights: assetRightsRenderSchema.optional(),
  reconstruction: z.boolean().default(false),
  filmTreatmentBackgroundId: z.literal('bg3').optional()
}).optional()
```

The mirrored discriminated union contains these exact `type` literals and payloads:

```ts
type DocumentaryGraphic =
  | { type: 'date-location'; date: string; location: string; theatre?: string; operation?: string; coordinates?: [number, number]; backgroundId: 'bg1' | 'bg2' | 'bg4' }
  | { type: 'battle-map'; theatre: string; bounds?: [number, number, number, number]; dateLabel?: string; units: MapUnit[]; routes: MapRoute[]; frontLines: FrontLine[]; objectives: MapObjective[]; annotations: string[]; backgroundId: 'bg2' | 'bg4' }
  | { type: 'military-timeline'; events: TimelineEvent[]; backgroundId: 'bg2' | 'bg4' }
  | { type: 'force-comparison'; sides: ForceSide[]; backgroundId: 'bg4' }
  | { type: 'equipment-spec'; name: string; model?: string; variant?: string; serviceYear?: number; role: string; manufacturer?: string; image?: string; specifications: EquipmentSpecification[]; backgroundId: 'bg4' }
  | { type: 'strategic-overlay'; theatre: string; objectives: MapObjective[]; routes: MapRoute[]; detectionRanges: DetectionRange[]; defensiveZones: DefensiveZone[]; formations: Formation[]; backgroundId: 'bg4' }
  | { type: 'evidence-card'; documentTitle: string; institution: string; date?: string; excerpt: string; citationId: string; sourceUrl: string; backgroundId: 'bg1' | 'bg2' }
  | { type: 'quote-card'; quote: string; speaker: string; role?: string; institution?: string; date?: string; citationId: string; sourceUrl: string; backgroundId: 'bg1' | 'bg2' }
  | { type: 'statistics'; title: string; display: 'counter' | 'bars' | 'before-after' | 'opposing-sides'; values: StatisticValue[]; backgroundId: 'bg2' | 'bg4' }
```

At storyboard root add chapters, citations, QA report, and project ID under one optional `documentaryProject` object. Existing storyboard fixtures must continue parsing.

- [ ] **Step 4: Register and copy the backgrounds**

```ts
export const DOCUMENTARY_BACKGROUNDS = {
  bg1: { id: 'bg1', src: '/documentary/backgrounds/bg1.mp4', role: 'dark-sepia', muted: true, fit: 'cover' },
  bg2: { id: 'bg2', src: '/documentary/backgrounds/bg2.mp4', role: 'archival-parchment', muted: true, fit: 'cover' },
  bg3: { id: 'bg3', src: '/documentary/backgrounds/bg3.mp4', role: 'film-gate', muted: true, fit: 'cover', opacity: 0.24 },
  bg4: { id: 'bg4', src: '/documentary/backgrounds/bg4.mp4', role: 'tactical-grid', muted: true, fit: 'cover' }
} as const
```

Use `Copy-Item -LiteralPath` for the binary copies after verifying each source resolves inside `app-live/background` and each destination resolves inside `app-live/public/documentary/backgrounds`. Do not transcode or modify the originals.

- [ ] **Step 5: Run tests, verify copies, and commit**

Run: `bun run test remotion/__tests__/documentary-schema.test.ts`

Expected: PASS.

Run: `Get-FileHash background/bg1.mp4,background/bg2.mp4,background/bg3.mp4,background/bg4.mp4,public/documentary/backgrounds/bg1.mp4,public/documentary/backgrounds/bg2.mp4,public/documentary/backgrounds/bg3.mp4,public/documentary/backgrounds/bg4.mp4`

Expected: each source hash equals its corresponding public-copy hash.

```bash
git add app-live/remotion/documentary-schema.ts app-live/remotion/schema.ts app-live/remotion/__tests__/documentary-schema.test.ts app-live/lib/engine/documentary/backgrounds.ts app-live/public/documentary/backgrounds/bg1.mp4 app-live/public/documentary/backgrounds/bg2.mp4 app-live/public/documentary/backgrounds/bg3.mp4 app-live/public/documentary/backgrounds/bg4.mp4
git commit -m "feat: add documentary render contract and backgrounds"
```

### Task 8: Cinematic Documentary Graphics

**Files:**
- Create: `app-live/remotion/documentary/DocumentaryBackground.tsx`
- Create: `app-live/remotion/documentary/DocumentaryGraphic.tsx`
- Create: `app-live/remotion/documentary/DocumentaryGraphicBoundary.tsx`
- Create: `app-live/remotion/documentary/ArchivalPhotoTreatment.tsx`
- Create: `app-live/remotion/documentary/DateLocationCard.tsx`
- Create: `app-live/remotion/documentary/BattleMap.tsx`
- Create: `app-live/remotion/documentary/MilitaryTimeline.tsx`
- Create: `app-live/remotion/documentary/ForceComparison.tsx`
- Create: `app-live/remotion/documentary/EquipmentSpec.tsx`
- Create: `app-live/remotion/documentary/EvidenceCard.tsx`
- Create: `app-live/remotion/documentary/StatisticsPanel.tsx`
- Create: `app-live/remotion/documentary/__tests__/DocumentaryGraphic.test.tsx`

**Interfaces:**
- Consumes: `DocumentaryGraphic` from `remotion/documentary-schema.ts` and `DOCUMENTARY_BACKGROUNDS`.
- Produces: `<DocumentaryGraphic graphic={graphic} durationInFrames={number} />` and `<DocumentaryBackground id={id} />`.
- Produces: `<ArchivalPhotoTreatment src subjectFocus filmTreatment />` and `<DocumentaryGraphicBoundary beatId fallback onError?>`.
- All animation derives only from `useCurrentFrame`, `useVideoConfig`, `interpolate`, and `spring`; no wall-clock state, random values, or effects.

- [ ] **Step 1: Write failing component tests with deterministic Remotion hooks**

```tsx
vi.mock('remotion', async () => ({
  AbsoluteFill: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
  OffthreadVideo: (props: Record<string, unknown>) => <video {...props} />,
  staticFile: (src: string) => src,
  useCurrentFrame: () => 45,
  useVideoConfig: () => ({ fps: 30, width: 1920, height: 1080 }),
  interpolate: () => 1,
  spring: () => 1
}))

it.each([
  ['date-location', makeDateGraphic(), 'JUNE 1942'],
  ['battle-map', makeMapGraphic(), 'MIDWAY ATOLL'],
  ['military-timeline', makeTimelineGraphic(), 'Yorktown repaired'],
  ['force-comparison', makeForceGraphic(), 'First Air Fleet'],
  ['equipment-spec', makeEquipmentGraphic(), 'Mitsubishi A6M2 Zero'],
  ['evidence-card', makeEvidenceGraphic(), 'Station HYPO'],
  ['statistics', makeStatisticsGraphic(), '4 carriers']
])('renders %s data', (_type, graphic, expectedText) => {
  render(<DocumentaryGraphic graphic={graphic} durationInFrames={180} />)
  expect(screen.getByText(expectedText)).toBeInTheDocument()
})

it('always mutes documentary background video', () => {
  const { container } = render(<DocumentaryBackground id="bg1" />)
  expect(container.querySelector('video')).toHaveAttribute('muted')
})

it('applies restrained film treatment without an AI label', () => {
  render(<ArchivalPhotoTreatment src="/midway.jpg" subjectFocus={{ x: 0.62, y: 0.4 }} filmTreatment />)
  expect(screen.getByRole('img')).toHaveAttribute('src', '/midway.jpg')
  expect(screen.queryByText(/AI[- ]generated/i)).not.toBeInTheDocument()
})

it('falls back to the media layer and reports the affected beat', () => {
  const onError = vi.fn()
  render(
    <DocumentaryGraphicBoundary beatId="beat-7" fallback={<div>archive remains visible</div>} onError={onError}>
      <ThrowingGraphic />
    </DocumentaryGraphicBoundary>
  )
  expect(screen.getByText('archive remains visible')).toBeInTheDocument()
  expect(onError).toHaveBeenCalledWith('beat-7', expect.any(Error))
})
```

- [ ] **Step 2: Run component tests and verify failure**

Run: `bun run test remotion/documentary/__tests__/DocumentaryGraphic.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the background and exhaustive dispatcher**

```tsx
export function DocumentaryGraphic({ graphic, durationInFrames }: Props) {
  switch (graphic.type) {
    case 'date-location': return <DateLocationCard graphic={graphic} />
    case 'battle-map': return <BattleMap graphic={graphic} durationInFrames={durationInFrames} />
    case 'military-timeline': return <MilitaryTimeline graphic={graphic} />
    case 'force-comparison': return <ForceComparison graphic={graphic} />
    case 'equipment-spec': return <EquipmentSpec graphic={graphic} />
    case 'strategic-overlay': return <BattleMap graphic={graphic} durationInFrames={durationInFrames} />
    case 'evidence-card':
    case 'quote-card': return <EvidenceCard graphic={graphic} />
    case 'statistics': return <StatisticsPanel graphic={graphic} />
    default: return assertNever(graphic)
  }
}
```

`DocumentaryBackground` resolves the registered public path with `staticFile`, sets `muted`, loops within the owning sequence, uses `OffthreadVideo`, and applies the registered fit/opacity.

`DocumentaryGraphicBoundary` catches only its owning overlay, returns the unmodified underlying media fallback, and reports/logs `documentary-overlay-fallback:<beatId>`. It must never replace or stop the whole composition. `ArchivalPhotoTreatment` uses a maximum 1.08 scale, a subject-aware transform origin, slow pan, and bg3 at no more than 0.24 opacity. Historical people receive no lip movement, face animation, or invented body motion.

- [ ] **Step 4: Implement the visual language and phased motion**

Use the preset palette and these concrete behaviors:

- Date/location: bg1, brass rules, condensed uppercase date, off-white location, 12-frame fade/track-in, minimum 2.5-second hold.
- Battle map/strategic overlay: bg4, establish geography during the first 20%, reveal forces at 20–40%, animate routes at 40–70%, reveal consequences at 70–85%, hold thereafter. If coordinates are missing, render labelled regions without precise markers.
- Timeline/evidence: bg2, parchment panel, active-event brass marker, document institution/date/source readable at 1080p.
- Force/equipment/statistics: bg4, Allied blue/Axis red/neutral grey/objective gold, numbers animate only after the scene's 20% point.
- Archival film treatment: bg3 as an optional 0.24-opacity overlay. Do not animate mouths or invent motion inside photographs.
- Quote cards require exact quote data from the schema. The visible source line includes speaker/author, institution, and date, but the full URL remains metadata rather than a long on-screen string.

- [ ] **Step 5: Run tests and commit**

Run: `bun run test remotion/documentary/__tests__/DocumentaryGraphic.test.tsx`

Expected: PASS.

```bash
git add app-live/remotion/documentary
git commit -m "feat: render cinematic documentary graphics"
```

### Task 9: Lossless Compose, Storyboard Rendering, and Credits Export

**Files:**
- Modify: `app-live/lib/tools/video/compose-render.ts`
- Modify: `app-live/lib/tools/video/__tests__/compose-render.test.ts`
- Modify: `app-live/remotion/Storyboard.tsx`
- Create: `app-live/lib/engine/documentary/credits.ts`
- Create: `app-live/lib/engine/documentary/__tests__/credits.test.ts`

**Interfaces:**
- Consumes: stored documentary project and beats, asset rights, graphics, existing transition/audio cue schemas.
- Produces: storyboard shots that preserve `comparisonCards`, generic `overlay`, documentary metadata, rights, claims, graphics, asset IDs, and transitions.
- Produces: `buildSourceCredits(storyboard): SourceCredit[]` and `exportYouTubeCredits(storyboard): string`.

- [ ] **Step 1: Extend the compose test before production changes**

```ts
it('preserves every documentary field while composing stored beats', async () => {
  kvGetJSON.mockImplementation(async key => {
    if (key === 'beats:beats-1') return makeStoredDocumentaryBeats()
    if (key === 'documentary:doc-1') return makeDocumentaryProject()
    return null
  })

  const result = await compose.execute({
    beatsId: 'beats-1', documentaryId: 'doc-1',
    shots: [{ beatIndex: 0, src: 'https://archive.org/download/midway.mp4' }],
    audioCues: makeAudioCues()
  }, options)

  const stored = kvSetJSON.mock.calls.find(([key]) => String(key).startsWith('storyboard:'))?.[1]
  expect(stored.shots[0]).toMatchObject({
    comparisonCards: expect.any(Array),
    overlay: expect.any(Object),
    documentary: {
      chapterId: 'chapter-1', claimIds: ['claim-1'],
      graphic: expect.objectContaining({ type: 'battle-map' }),
      rights: expect.objectContaining({ license: 'public-domain' })
    },
    transitionOut: expect.any(Object)
  })
  expect(stored.documentaryProject).toMatchObject({
    id: 'doc-1', chapters: expect.any(Array), citations: expect.any(Array)
  })
})
```

Add a credits test with two shots using the same archive asset and assert one credit entry, while two distinct citations remain two entries.

- [ ] **Step 2: Run compose and credits tests to verify failure**

Run: `bun run test lib/tools/video/__tests__/compose-render.test.ts lib/engine/documentary/__tests__/credits.test.ts`

Expected: FAIL because documentary data is dropped and credits functions are missing.

- [ ] **Step 3: Make composition lossless**

Extend the tool schema with optional `documentaryId`. Load and validate both records. Merge only `src` and explicit editor overrides onto each stored beat; spread the stored shot first so semantic fields survive:

```ts
const shot = {
  ...storedBeat,
  ...explicitOverride,
  src: explicitOverride.src ?? resolvedAsset?.src ?? storedBeat.src,
  transitionOut: explicitOverride.transitionOut ?? storedBeat.transitionOut,
  documentary: storedBeat.documentary
    ? { ...storedBeat.documentary, rights: resolvedAsset?.rights ?? storedBeat.documentary.rights }
    : undefined
}
```

Validate the complete result with the canonical Remotion storyboard schema before writing `storyboard:${id}`. Attach chapters, citations, QA, and project ID once at the root.

- [ ] **Step 4: Render documentary graphics in Storyboard**

Inside each existing shot sequence, preserve the media layer and current generic overlays. Add `<DocumentaryGraphic>` when `shot.documentary?.graphic` exists and wrap it with `<DocumentaryGraphicBoundary beatId={shot.id} fallback={null}>` so one failed optional overlay leaves the media layer intact. Route archival-photo/reconstruction stills through `<ArchivalPhotoTreatment>` and apply bg3 only when instructed. Do not render any text based on `shot.documentary.reconstruction`.

- [ ] **Step 5: Implement deterministic credit export**

Deduplicate assets by `${provider}:${sourceUrl ?? assetId}` and citations by citation ID. Sort assets by first appearance in shots, followed by unused project citations alphabetically. Output creator/title, institution, licence, attribution, and URL. Never label standard YouTube/reference-only candidates as footage used.

- [ ] **Step 6: Run tests and commit**

Run: `bun run test lib/tools/video/__tests__/compose-render.test.ts lib/engine/documentary/__tests__/credits.test.ts`

Expected: PASS, including the existing music, ambience, SFX, and transition persistence tests.

```bash
git add app-live/lib/tools/video/compose-render.ts app-live/lib/tools/video/__tests__/compose-render.test.ts app-live/remotion/Storyboard.tsx app-live/lib/engine/documentary/credits.ts app-live/lib/engine/documentary/__tests__/credits.test.ts
git commit -m "feat: preserve documentary data through render"
```

### Task 10: Editorial QA and Publish Gate

**Files:**
- Create: `app-live/lib/engine/documentary/qa.ts`
- Create: `app-live/lib/engine/documentary/__tests__/qa.test.ts`
- Modify: `app-live/lib/engine/documentary/project.ts`
- Modify: `app-live/lib/tools/video/compose-render.ts`

**Interfaces:**
- Consumes: a complete `DocumentaryProject` and optional assembled storyboard.
- Produces: `runDocumentaryQa(project, storyboard?): DocumentaryQaReport`.
- Produces stable issue codes from the spec and `publishReady = !issues.some(issue => issue.severity === 'blocking')`.

- [ ] **Step 1: Write table-driven QA tests**

```ts
it.each([
  ['opening-date-missing', projectWithoutOpeningDate()],
  ['critical-claim-unsupported', projectWithUnsupportedCriticalClaim()],
  ['historical-entity-contradiction', projectWithContradictedEquipment()],
  ['quotation-citation-missing', projectWithUnsourcedQuote()],
  ['asset-rights-not-reusable', projectWithStandardYouTubeFinalAsset()],
  ['evidence-source-missing', projectWithUnsourcedEvidenceCard()]
])('blocks publication for %s', (code, project) => {
  const report = runDocumentaryQa(project)
  expect(report.publishReady).toBe(false)
  expect(report.issues).toContainEqual(expect.objectContaining({ code, severity: 'blocking' }))
})

it.each([
  ['repeated-visual', projectWithRepeatedAsset()],
  ['visual-subject-mismatch', projectWithYearMismatch()],
  ['visual-narration-mismatch', projectWithIntentMismatch()],
  ['retention-gap', projectWithNinetyOneSecondGap()],
  ['excessive-reconstruction', projectWithThreeReconstructions()],
  ['attribution-detail-missing', projectWithIncompleteAttribution()]
])('warns without blocking for %s', (code, project) => {
  const report = runDocumentaryQa(project)
  expect(report.issues).toContainEqual(expect.objectContaining({ code, severity: 'warning' }))
})
```

- [ ] **Step 2: Run QA tests to verify failure**

Run: `bun run test lib/engine/documentary/__tests__/qa.test.ts`

Expected: FAIL because `qa.ts` does not exist.

- [ ] **Step 3: Implement pure QA rules**

```ts
export function runDocumentaryQa(
  project: DocumentaryProject,
  storyboard?: Storyboard
): DocumentaryQaReport {
  const issues = [
    ...checkOpeningDate(project),
    ...checkClaimsAndCitations(project),
    ...checkQuotesAndEvidence(project),
    ...checkAssetRights(project, storyboard),
    ...checkRepeatedAndMismatchedVisuals(project),
    ...checkRetentionProgression(project),
    ...checkReconstructionRuns(project),
    ...checkAttribution(project)
  ]
  return { publishReady: !issues.some(issue => issue.severity === 'blocking'), issues }
}
```

Use exact thresholds: a retention gap is more than 90 seconds without a new chapter, claim, beat type, location, statistic, or meaningful visual query; excessive reconstruction is three or more consecutive reconstruction beats. A missing optional creator is a warning, but missing source/licence/reusability on a final asset is blocking.

- [ ] **Step 4: Integrate QA at preparation and composition boundaries**

Run initial QA after script/dossier/chapter preparation, then final QA after assets and storyboard assembly. Allow preview persistence with blockers, but include `publishReady: false`. The render/export action must reject a final render request when blockers remain and return the issue list.

- [ ] **Step 5: Run QA and compose tests, then commit**

Run: `bun run test lib/engine/documentary/__tests__/qa.test.ts lib/tools/video/__tests__/compose-render.test.ts`

Expected: PASS.

```bash
git add app-live/lib/engine/documentary/qa.ts app-live/lib/engine/documentary/__tests__/qa.test.ts app-live/lib/engine/documentary/project.ts app-live/lib/tools/video/compose-render.ts
git commit -m "feat: add documentary editorial qa"
```

### Task 11: Researcher Tool Wiring and Studio Documentary Inspector

**Files:**
- Create: `app-live/components/documentary-section.tsx`
- Create: `app-live/components/studio/documentary-inspector.tsx`
- Create: `app-live/components/studio/__tests__/documentary-inspector.test.tsx`
- Modify: `app-live/lib/agents/researcher.ts`
- Modify: `app-live/lib/types/agent.ts`
- Modify: `app-live/lib/types/ai.ts`
- Modify: `app-live/lib/streaming/helpers/sanitize-messages-for-model.ts`
- Modify: `app-live/components/tool-section.tsx`
- Modify: `app-live/components/studio-canvas.tsx`

**Interfaces:**
- Consumes: `createPrepareDocumentaryTool`, canonical storyboard, `exportYouTubeCredits`, and current Studio update callbacks.
- Produces: registered AI tool name `prepareDocumentary` and tool part `tool-prepareDocumentary`.
- Produces: `<DocumentaryInspector storyboard onChange />` with chapter navigation, scene/claim/rights inspection, typed graphic editors, background selection, QA, and credits copy.

- [ ] **Step 1: Write failing inspector tests**

```tsx
it('shows chapters, claims, rights, QA and all four backgrounds', () => {
  render(<DocumentaryInspector storyboard={makeMidwayStoryboard()} onChange={vi.fn()} />)
  expect(screen.getByText('Cold Open')).toBeInTheDocument()
  expect(screen.getByText('claim-1')).toBeInTheDocument()
  expect(screen.getByText('Public domain')).toBeInTheDocument()
  expect(screen.getByText('Publish ready')).toBeInTheDocument()
  for (const label of ['Dark sepia', 'Archival parchment', 'Film gate', 'Tactical grid']) {
    expect(screen.getByText(label)).toBeInTheDocument()
  }
})

it('edits a graphic without changing narration', async () => {
  const onChange = vi.fn()
  render(<DocumentaryInspector storyboard={makeMidwayStoryboard()} onChange={onChange} />)
  await userEvent.clear(screen.getByLabelText('Date label'))
  await userEvent.type(screen.getByLabelText('Date label'), 'June 4, 1942')
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
    shots: [expect.objectContaining({ narration: expect.stringContaining('By the summer of 1942') })]
  }))
})

it('shows reconstruction origin only in the inspector', () => {
  render(<DocumentaryInspector storyboard={makeReconstructionStoryboard()} onChange={vi.fn()} />)
  expect(screen.getByText('AI reconstruction')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the inspector test to verify failure**

Run: `bun run test components/studio/__tests__/documentary-inspector.test.tsx`

Expected: FAIL because the inspector does not exist.

- [ ] **Step 3: Register `prepareDocumentary` everywhere**

Instantiate the tool beside `writeScript`, add it to the researcher tool map and type declarations, allow `tool-prepareDocumentary` in message sanitization, and add its UI case to `tool-section.tsx`. Update the researcher system prompt with this exact flow:

1. For WW1/WW2 documentary requests, gather structured primary/institutional sources first.
2. Call `prepareDocumentary` in Topic or Script mode.
3. Call documentary-aware `cutBeats`.
4. Source final footage with `finalRender: true`; keep unsafe YouTube as reference-only.
5. Use generated reconstruction only when safe archive/photo/map/graphic coverage is inadequate.
6. Add curated music/ambience/SFX and call `composeRender` with the documentary ID.

Keep the generic pipeline prompt for other video requests.

- [ ] **Step 4: Implement the chat section and focused Studio inspector**

`documentary-section.tsx` displays mode, topic, chapter count, duration, publish status, and issue summary from the tool result. `documentary-inspector.tsx` must provide:

- chapter/act navigation;
- current beat type, claim IDs, citation links, asset provider/licence/reusability;
- editors for the active graphic's date, location, labels, values, units, routes, events, and annotations;
- bg1–bg4 selector filtered by registered role;
- internal reconstruction-origin badge in the inspector only;
- blockers/warnings grouped by severity;
- a copy button using `exportYouTubeCredits` output.

Mount it conditionally in `studio-canvas.tsx` when `storyboard.documentaryProject` exists. Reuse the current immutable storyboard update path so generic Studio behavior remains unchanged.

- [ ] **Step 5: Run tests and typecheck the wiring surface**

Run: `bun run test components/studio/__tests__/documentary-inspector.test.tsx`

Expected: PASS.

Run: `bun typecheck`

Expected: no new errors in any file from this task. If the known pre-existing matcher or beats-section errors remain, record their exact unchanged output rather than treating them as documentary regressions.

- [ ] **Step 6: Commit**

```bash
git add app-live/components/documentary-section.tsx app-live/components/studio/documentary-inspector.tsx app-live/components/studio/__tests__/documentary-inspector.test.tsx app-live/lib/agents/researcher.ts app-live/lib/types/agent.ts app-live/lib/types/ai.ts app-live/lib/streaming/helpers/sanitize-messages-for-model.ts app-live/components/tool-section.tsx app-live/components/studio-canvas.tsx
git commit -m "feat: add documentary workflow to studio"
```

### Task 12: Midway Acceptance Test, Render Smoke Test, and Full Verification

**Files:**
- Create: `app-live/lib/engine/documentary/__tests__/midway-acceptance.test.ts`
- Create: `app-live/remotion/fixtures/documentary-smoke.json`
- Create: `app-live/scripts/verify-documentary-render.mjs`
- Modify: `app-live/package.json`
- Modify: `docs/superpowers/specs/2026-08-14-ww1-ww2-documentary-design.md` only to check off acceptance results if the repository convention permits status notes; do not change requirements.

**Interfaces:**
- Consumes: every public interface from Tasks 1–11 and the Midway fixture.
- Produces: `bun run verify:documentary-render`, which renders the deterministic fixture and verifies H.264 video plus AAC audio.
- Produces: an end-to-end acceptance test proving all ten acceptance statements from the spec.

- [ ] **Step 1: Write the failing Midway acceptance test**

```ts
it('builds the approved Midway documentary contract', async () => {
  const parsed = parseDocumentaryScript(midwayFixture)
  const project = await prepareDocumentaryProject(model, makeScriptInput(midwayFixture))
  const beats = await planDocumentaryBeats(model, project)
  const safeAssets = sourceAcceptanceAssets(beats)
  const storyboard = composeAcceptanceStoryboard(project, beats, safeAssets)
  const credits = buildSourceCredits(storyboard)
  const qa = runDocumentaryQa({ ...project, beats, assets: safeAssets }, storyboard)

  expect(parsed.openingDate?.year).toBe(1942)
  expect(parsed.narration).not.toMatch(/What the Video Is About|Rotation Log/)
  expect(project.chapters.map(chapter => chapter.act)).toEqual([
    'cold-open', 'strategic-context', 'build-up', 'conflict',
    'turning-point', 'aftermath', 'epilogue'
  ])
  expect(project.dossier.claims.map(claim => claim.text).join(' ')).toMatch(
    /Pearl Harbor|Coral Sea|Station HYPO|Yorktown|June 4|four carriers|strategic/i
  )
  expect(beats.map(beat => beat.graphic?.type)).toEqual(expect.arrayContaining([
    'date-location', 'battle-map', 'force-comparison', 'evidence-card',
    'military-timeline', 'statistics'
  ]))
  expect(safeAssets.every(asset => asset.rights.reusable)).toBe(true)
  expect(storyboard.shots.some(shot => shot.documentary?.reconstruction)).toBe(true)
  expect(JSON.stringify(storyboard)).not.toContain('AI-generated scene')
  const backgroundIds = storyboard.shots
    .map(shot => shot.documentary?.graphic?.backgroundId ?? shot.documentary?.filmTreatmentBackgroundId)
    .filter((id): id is string => Boolean(id))
  expect(backgroundIds).toEqual(expect.arrayContaining(['bg1', 'bg2', 'bg3', 'bg4']))
  expect(credits.length).toBe(new Set(credits.map(credit => credit.key)).size)
  expect(qa.publishReady).toBe(true)
})
```

Use deterministic mocked AI results and local safe-asset fixtures. This is a pipeline contract test, not a network test.

- [ ] **Step 2: Run the acceptance test and fix only integration defects**

Run: `bun run test lib/engine/documentary/__tests__/midway-acceptance.test.ts`

Expected initially: FAIL on whichever cross-task contract is inconsistent. Make the smallest changes in the owning Task 1–11 files until the test passes; do not relax assertions.

- [ ] **Step 3: Add the three-scene render fixture**

The fixture is 1920×1080 at 30 fps and contains:

1. 3-second date/location opening over bg1.
2. 4-second Midway battle map over bg4 with two units, one objective, and one route.
3. 3-second evidence card over bg2 followed by an archival still with bg3 film treatment.

It uses one existing curated Pixabay music cue, one quiet ambience cue, one transition SFX, and the existing transition system. Every background shot is muted.

- [ ] **Step 4: Implement codec verification and package command**

Add `"verify:documentary-render": "node scripts/verify-documentary-render.mjs"` to `package.json`. The script must:

```js
const render = spawnSync('bunx', [
  'remotion', 'render', 'Storyboard', 'out/documentary-smoke.mp4',
  '--props=remotion/fixtures/documentary-smoke.json'
], { stdio: 'inherit', shell: process.platform === 'win32' })
if (render.status !== 0) process.exit(render.status ?? 1)

const probe = spawnSync('ffprobe', [
  '-v', 'error', '-show_entries', 'stream=codec_type,codec_name',
  '-of', 'json', 'out/documentary-smoke.mp4'
], { encoding: 'utf8', shell: process.platform === 'win32' })
if (probe.status !== 0) process.exit(probe.status ?? 1)
const streams = JSON.parse(probe.stdout).streams
if (!streams.some(stream => stream.codec_type === 'video' && stream.codec_name === 'h264')) process.exit(2)
if (!streams.some(stream => stream.codec_type === 'audio' && stream.codec_name === 'aac')) process.exit(3)
```

Use the repository's existing Remotion entry point. If Windows cannot resolve `bunx` through `spawnSync`, invoke it through `process.env.ComSpec` with a fixed argument array; never build a command from user input.

- [ ] **Step 5: Run focused, full, static, and render verification**

Run: `bun run test lib/engine/documentary lib/tools/video/__tests__/compose-render.test.ts lib/engine/__tests__/beats.test.ts lib/engine/__tests__/sourcing.test.ts remotion/documentary components/studio/__tests__/documentary-inspector.test.tsx`

Expected: all documentary and touched-regression tests PASS.

Run: `bun run test`

Expected: no new failures. Compare any remaining failures to the recorded baseline; the previously observed two message-ID failures must not increase or change signature.

Run: `bun lint`

Expected: no lint errors in touched files.

Run: `bun typecheck`

Expected: no type errors in touched files; record unchanged pre-existing matcher/beat-section errors if still present.

Run: `bun format:check`

Expected: all touched files pass formatting.

Run: `bun run build`

Expected: build succeeds, or any environment-only/pre-existing failure is captured with exact output and demonstrated unrelated to touched files.

Run: `bun run verify:documentary-render`

Expected: `out/documentary-smoke.mp4` exists and ffprobe reports H.264 video plus AAC audio.

- [ ] **Step 6: Manually inspect four deterministic frames**

Open frames at approximately 1.5s, 4.5s, 7.5s, and 9.5s. Confirm date/location legibility over bg1, phased units/routes over bg4, evidence citation legibility over bg2, restrained bg3 scratches, correct 16:9 crop, and no visible AI-scene label.

- [ ] **Step 7: Commit the acceptance and verification slice**

```bash
git add app-live/lib/engine/documentary/__tests__/midway-acceptance.test.ts app-live/remotion/fixtures/documentary-smoke.json app-live/scripts/verify-documentary-render.mjs app-live/package.json docs/superpowers/specs/2026-08-14-ww1-ww2-documentary-design.md
git commit -m "test: verify midway documentary pipeline"
```

---

## Completion Evidence

Implementation is complete only when the executor can provide:

- the focused documentary test totals;
- the full-suite result compared with the pre-change baseline;
- lint, typecheck, formatting, and build results with any unchanged pre-existing failures clearly separated;
- the rendered smoke-test MP4 path and ffprobe codecs;
- frame captures proving bg1–bg4 roles and overlay readability;
- a Midway QA report with `publishReady: true` using only reusable final assets;
- a source-credit export with every used asset exactly once;
- confirmation that Four Pillars/Rotation Log are absent from narration and no per-scene AI label is rendered.
