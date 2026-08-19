import { tool } from 'ai'
import { z } from 'zod'

import { cutScriptIntoBeats } from '@/lib/engine/beats'
import {
  documentaryBeatKind,
  planDocumentaryBeats
} from '@/lib/engine/documentary/planner'
import { loadDocumentaryProject } from '@/lib/engine/documentary/project'
import { kvGetJSON, kvSetJSON } from '@/lib/engine/kv'

import type { VoiceoverHandle } from './generate-voiceover'

const cutBeatsSchema = z
  .object({
    script: z
      .string()
      .optional()
      .describe(
        'The clean narration script to segment (the output of writeScript)'
      ),
    documentaryId: z
      .string()
      .optional()
      .describe(
        'Persisted WW1/WW2 documentary handle from prepareDocumentary. Use instead of script to retain chapters, claims, entities, dates, locations, and graphic instructions.'
      ),
    topic: z.string().optional().describe('Working title / topic, for context'),
    format: z
      .enum(['16:9', '9:16', '1:1'])
      .optional()
      .describe('Aspect ratio (default 16:9 for long-form, 9:16 for shorts)'),
    channel: z.string().optional().describe('Channel name for the brand card'),
    accent: z
      .string()
      .optional()
      .describe('Brand accent color as #rrggbb for the karaoke caption fill'),
    voiceoverId: z
      .string()
      .optional()
      .describe(
        'Voiceover handle from generateVoiceover — when provided, shots lock to the real spoken word timings instead of estimates'
      )
  })
  .superRefine((value, context) => {
    if (
      Number(Boolean(value.script)) + Number(Boolean(value.documentaryId)) !==
      1
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Provide exactly one script or documentaryId'
      })
    }
  })

const DIMS = {
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
  '1:1': { width: 1080, height: 1080 }
} as const

// Keep segmentation on the selected chat model by default. Choosing a provider merely
// because one of its keys exists can silently route around the user's selected model (and
// previously selected a retired Gemini model). CUT_BEATS_MODEL remains the explicit opt-in
// for deployments that want a dedicated segmentation model.
function segmentationModel(chatModel: string): string {
  const override = process.env.CUT_BEATS_MODEL?.trim()
  if (override) return override === 'chat' ? chatModel : override
  return chatModel
}

// Segment a narration script into a timed storyboard of shots, each with a footage
// search query and intent. This is the bridge between writeScript and sourceFootage:
// run cutBeats on the script, then sourceFootage on each shot's visualQuery/visualIntent.
export function createCutBeatsTool(model: string) {
  return tool({
    description:
      "Segment a finished narration script into an ordered storyboard of shots. Each shot carries its verbatim narration, a still/clip hint, a concrete footage search query, an intent describing what it must show, and estimated word-level caption timings. Returns a beatsId — pass it straight to composeRender (with just each shot's resolved src, in the same order) rather than retyping narration/timings/captions; composeRender pulls the full data automatically. Run this after writeScript; then source footage for each shot with the sourceFootage tool.",
    inputSchema: cutBeatsSchema,
    execute: async (input, { abortSignal }) => {
      let voiceWords: VoiceoverHandle['words'] | undefined
      if (input.voiceoverId) {
        const handle = await kvGetJSON<VoiceoverHandle>(
          `voiceover:${input.voiceoverId}`
        )
        voiceWords = handle?.words
      }
      let documentaryProject = null
      let storyboard
      if (input.documentaryId) {
        documentaryProject = await loadDocumentaryProject(input.documentaryId)
        if (!documentaryProject) {
          throw new Error(
            `Documentary project not found: ${input.documentaryId}`
          )
        }
        const format = input.format ?? '16:9'
        const fps = 30
        const beats = await planDocumentaryBeats(
          segmentationModel(model),
          documentaryProject,
          {
            format,
            fps,
            channel: input.channel,
            voiceWords,
            abortSignal
          }
        )
        const { width, height } = DIMS[format]
        const last = beats.at(-1)
        storyboard = {
          documentaryId: documentaryProject.id,
          topic: documentaryProject.topic,
          format,
          width,
          height,
          fps,
          brand: {
            channel: input.channel || 'Kakkao',
            accent: input.accent || '#B6924A'
          },
          shots: beats.map(beat => ({
            ...beat,
            kind: documentaryBeatKind(beat.type),
            documentary: {
              beatType: beat.type,
              chapterId: beat.chapterId,
              claimIds: beat.claimIds,
              entityIds: beat.entityIds,
              locationIds: beat.locationIds,
              dateLabel: beat.dateLabel,
              graphic: beat.graphic,
              assetId: beat.assetId,
              reconstruction: beat.type === 'reconstruction'
            }
          })),
          totalSeconds: last ? +(last.start + last.duration).toFixed(2) : 0,
          estimatedTimings: !voiceWords?.length
        }
        documentaryProject = {
          ...documentaryProject,
          beats,
          updatedAt: new Date().toISOString()
        }
        await kvSetJSON(
          `documentary:${documentaryProject.id}`,
          documentaryProject
        )
      } else {
        storyboard = await cutScriptIntoBeats(
          segmentationModel(model),
          { ...input, script: input.script!, voiceWords },
          abortSignal
        )
      }

      // Persist the full storyboard (including per-word caption timings) so
      // composeRender can pull it back by id instead of the model having to retype
      // it — that retyping is exactly what was truncating large composeRender calls.
      const beatsId = `bt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
      await kvSetJSON(`beats:${beatsId}`, storyboard)

      // Word-level timings are omitted from the tool RESULT on purpose — the model
      // only needs them to flow through to composeRender via beatsId, not to reason
      // over, and including them here bloats every downstream turn's context for no
      // benefit.
      return {
        state: 'complete' as const,
        beatsId,
        topic: storyboard.topic,
        format: storyboard.format,
        width: storyboard.width,
        height: storyboard.height,
        fps: storyboard.fps,
        brand: storyboard.brand,
        totalSeconds: storyboard.totalSeconds,
        estimatedTimings: storyboard.estimatedTimings,
        shots: storyboard.shots.map(s => ({
          kind: s.kind,
          visualQuery: s.visualQuery,
          visualIntent: s.visualIntent,
          narration: s.narration,
          start: s.start,
          duration: s.duration,
          ...('documentary' in s
            ? {
                id: s.id,
                chapterId: s.chapterId,
                type: s.type,
                claimIds: s.claimIds,
                entityIds: s.entityIds,
                locationIds: s.locationIds,
                dateLabel: s.dateLabel,
                graphic: s.graphic
              }
            : {})
        }))
      }
    }
  })
}
