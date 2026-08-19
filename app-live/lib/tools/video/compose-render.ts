import { tool } from 'ai'
import { z } from 'zod'

import type { Storyboard } from '@/lib/engine/beats'
import { runDocumentaryQa } from '@/lib/engine/documentary/qa'
import {
  type DocumentaryProject,
  documentaryProjectSchema
} from '@/lib/engine/documentary/schema'
import { kvGetJSON, kvSetJSON } from '@/lib/engine/kv'
import type { FootageAsset } from '@/lib/engine/sourcing'
import { isLambdaConfigured } from '@/lib/remotion/lambda'

import catalogData from '@/public/audio/catalog.json'
import {
  parseAudioCatalog,
  toCatalogAudioUrl
} from '@/lib/engine/audio-catalog'
import type { VoiceoverHandle } from './generate-voiceover'

import { documentaryShotMetadataSchema } from '@/remotion/documentary-schema'
import {
  audioCueSchema,
  captionStyleSchema,
  comparisonCardItemSchema,
  musicCreditSchema,
  overlaySchema,
  type Shot,
  type StoryboardInput,
  storyboardInputSchema,
  transitionSchema
} from '@/remotion/schema'

type StoredStoryboard = Omit<Storyboard, 'shots'> & {
  documentaryId?: string
  shots: Array<Storyboard['shots'][number] & Partial<Shot>>
}

// Every field below except `src`/`kind` is only needed when `beatsId` is NOT supplied —
// with beatsId, narration/timing/word-level captions all come from the stored cutBeats
// result instead. Making them optional here (rather than a second schema) keeps
// composeRender usable both ways: the lean path (beatsId + just the resolved assets) and
// the standalone path (a hand-built shot list with no prior cutBeats call).
const shotSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(['photo', 'video', 'avatar', 'a-roll', 'comparison']).optional(),
  comparisonCards: z
    .array(comparisonCardItemSchema)
    .optional()
    .describe('Comparison cards data if kind is comparison'),
  overlay: overlaySchema.optional(),
  documentary: documentaryShotMetadataSchema.optional(),
  footageId: z
    .string()
    .optional()
    .describe(
      'sourceFootage footageId. Preferred over copying URLs: composeRender resolves the exact selected full-resolution photo or direct playable clip, including its media kind.'
    ),
  src: z
    .string()
    .optional()
    .describe(
      'Public http(s) URL of the resolved asset (the vision-verified pick from sourceFootage). Omit to render a clean brand card for this shot. Local file paths are not supported — Lambda can only read URLs.'
    ),
  start: z
    .number()
    .optional()
    .describe('Shot start time in seconds. Only needed without beatsId.'),
  duration: z
    .number()
    .optional()
    .describe('Shot duration in seconds. Only needed without beatsId.'),
  narration: z.string().optional(),
  words: z
    .array(
      z.object({
        word: z.string(),
        start: z.number(),
        end: z.number()
      })
    )
    .optional()
    .describe(
      'Word-level caption timings. Only needed without beatsId — with beatsId, real timings from cutBeats/the voiceover are used automatically.'
    ),
  mediaFit: z
    .enum(['contain', 'cover'])
    .optional()
    .describe('Fit keeps the full source visible; Fill covers and may crop'),
  mediaOrigin: z
    .enum(['researched', 'archival', 'generated', 'manual'])
    .optional()
    .describe(
      'Source provenance for a direct src. sourceFootage handles derive this automatically.'
    ),
  mediaStart: z
    .number()
    .nonnegative()
    .optional()
    .describe('Source-media in point in seconds'),
  mediaEnd: z
    .number()
    .positive()
    .optional()
    .describe('Source-media out point in seconds'),
  mediaMuted: z
    .boolean()
    .optional()
    .describe(
      'Mute the source clip audio independently of voiceover and music'
    ),
  sourceDuration: z
    .number()
    .positive()
    .optional()
    .describe('Known duration of the resolved source video in seconds'),
  transitionOut: transitionSchema
    .optional()
    .describe('Visual transition from this shot into the next shot')
})

function originFromFootage(footage: FootageAsset): Shot['mediaOrigin'] {
  const provider = footage.rights?.provider
  const source = footage.source?.toLowerCase() ?? ''

  if (provider === 'ai-generated' || /ai[- ]generated/u.test(source)) {
    return 'generated'
  }
  if (provider === 'user-provided' || source.includes('user-provided')) {
    return 'manual'
  }
  if (
    provider === 'wikimedia' ||
    provider === 'internet-archive' ||
    provider === 'nara' ||
    /wikimedia|internet archive|national archives|\bnara\b/u.test(source)
  ) {
    return 'archival'
  }
  return 'researched'
}

function originFromDocumentary(
  documentary: Shot['documentary']
): Shot['mediaOrigin'] {
  if (!documentary) return undefined
  const provider = documentary.rights?.provider
  if (provider === 'ai-generated' || documentary.reconstruction) {
    return 'generated'
  }
  if (provider === 'user-provided') return 'manual'
  if (
    provider === 'wikimedia' ||
    provider === 'internet-archive' ||
    provider === 'nara' ||
    documentary.beatType === 'archival-photo'
  ) {
    return 'archival'
  }
  return 'researched'
}

function defaultMediaFit(origin: Shot['mediaOrigin']): Shot['mediaFit'] {
  if (origin === 'researched' || origin === 'archival') return 'contain'
  if (origin === 'generated' || origin === 'manual') return 'cover'
  return undefined
}

const composeRenderSchema = z.object({
  width: z.number().optional().describe('Frame width (default 1280)'),
  height: z.number().optional().describe('Frame height (default 720)'),
  fps: z.number().optional().describe('Frames per second (default 30)'),
  accent: z
    .string()
    .optional()
    .describe('Brand accent color #rrggbb for captions and fallback cards'),
  channel: z.string().optional(),
  beatsId: z
    .string()
    .optional()
    .describe(
      "cutBeats' beatsId. When given, shots[] only needs `src` per shot (and `kind` to override the default), matched by array index — narration, timing, and word-level captions are pulled automatically from the stored cutBeats result. Strongly preferred for any storyboard with more than a few shots: retyping narration/captions for every shot is what previously truncated large composeRender calls."
    ),
  documentaryId: z
    .string()
    .optional()
    .describe('Persisted documentary project handle from prepareDocumentary'),
  shots: z
    .array(shotSchema)
    .min(1)
    .describe(
      'The storyboard shots. With beatsId: pass `footageId` from sourceFootage per shot (preferred), or a direct `src` plus optional `kind`, in cutBeats order. footageId preserves the exact selected full-resolution photo or playable clip. Without beatsId: start/duration are also required.'
    ),
  voice: z
    .string()
    .optional()
    .describe('Public URL of the voiceover track (wav/mp3)'),
  voiceoverId: z
    .string()
    .optional()
    .describe(
      'Voiceover handle from generateVoiceover — its audio is mixed in automatically (preferred over passing voice directly)'
    ),
  music: z.string().optional().describe('Public URL of a background music bed'),
  musicCredit: musicCreditSchema
    .optional()
    .describe(
      'Creator, Pixabay source page and licence metadata returned by generateMusic'
    ),
  audioCues: z
    .array(audioCueSchema)
    .optional()
    .describe(
      'Timeline-positioned Pixabay sound effects and ambience with independent volume, looping and fades'
    ),
  transitionSfxVolume: z
    .number()
    .min(0)
    .max(2)
    .optional()
    .describe('Automatic transition sound volume; use 0 to mute'),
  captionStyle: captionStyleSchema
    .optional()
    .describe(
      "Caption presentation. 'tiktok': a big rolling window of a few words centered on the one being spoken — the dominant short-form caption style. 'normal': the full shot sentence wrapping across lines near the bottom. Omit to auto-pick by aspect ratio (tiktok for vertical/9:16-ish, normal otherwise)."
    )
})

// Assemble a storyboard (shots + assets + optional voiceover/music) into a Remotion
// composition and PUBLISH it to the Studio. The SAME storyboard drives the in-chat preview
// and the /studio/[id] canvas; the user opens the Studio, sees the full Remotion canvas, and
// clicks Render to run Remotion Lambda. Run after cutBeats + sourceFootage populate the shots.
export function createComposeRenderTool() {
  return tool({
    description:
      "Assemble the storyboard into a Remotion composition and open it in the Kakkao Studio. Pass beatsId from cutBeats plus sourceFootage's footageId for each shot, in the same shot order. Do not substitute `thumb` or a video watch-page URL: footageId resolves the exact selected full-resolution photo or direct playable clip and preserves whether it is photo or video. Narration, timing and captions are pulled from beatsId. Returns a Studio link (/studio/[id]); shots without an asset render as clean brand cards.",
    inputSchema: composeRenderSchema,
    execute: async input => {
      // Resolve the voiceover: an explicit `voice` URL wins; otherwise pull the audio URL
      // from the voiceover handle so the agent only threads the small id.
      let voice = input.voice
      if (!voice && input.voiceoverId) {
        const handle = await kvGetJSON<VoiceoverHandle>(
          `voiceover:${input.voiceoverId}`
        )
        voice = handle?.audioUrl
      }

      let storedStoryboard: StoredStoryboard | null = null
      if (input.beatsId) {
        const stored = await kvGetJSON<StoredStoryboard>(
          `beats:${input.beatsId}`
        )
        if (!stored) {
          throw new Error(
            `beatsId "${input.beatsId}" not found — it may have expired, or the id is wrong. Re-run cutBeats to get a fresh one.`
          )
        }
        storedStoryboard = stored
      }

      const documentaryId =
        input.documentaryId ?? storedStoryboard?.documentaryId
      const documentaryValue = documentaryId
        ? await kvGetJSON<unknown>(`documentary:${documentaryId}`)
        : null
      let documentaryProject: DocumentaryProject | null = documentaryValue
        ? documentaryProjectSchema.parse(documentaryValue)
        : null
      if (documentaryId && !documentaryProject) {
        throw new Error(`documentaryId "${documentaryId}" not found`)
      }

      const footageSelections = await Promise.all(
        input.shots.map(async shot => {
          if (!shot.footageId) return null
          const selection = await kvGetJSON<FootageAsset>(
            `footage:${shot.footageId}`
          )
          if (!selection?.src) {
            throw new Error(
              `footageId "${shot.footageId}" not found or has no resolved media file`
            )
          }
          return selection
        })
      )

      const shots = storedStoryboard
        ? storedStoryboard.shots.map((base, i) => {
            const override = input.shots[i]
            const footage = footageSelections[i]
            const assetRights = base.documentary?.assetId
              ? documentaryProject?.assets.find(
                  asset => asset.id === base.documentary?.assetId
                )?.rights
              : undefined
            const canonicalRights =
              footage?.rights ?? assetRights ?? base.documentary?.rights
            const enrichedBaseDocumentary = base.documentary
              ? {
                  ...base.documentary,
                  rights: canonicalRights
                }
              : undefined
            const documentary = override?.documentary
              ? {
                  ...enrichedBaseDocumentary,
                  ...override.documentary,
                  rights: override.documentary.rights ?? canonicalRights
                }
              : enrichedBaseDocumentary
            const mediaOrigin = footage
              ? originFromFootage(footage)
              : (override?.mediaOrigin ??
                base.mediaOrigin ??
                originFromDocumentary(documentary))
            return {
              ...base,
              id: override?.id ?? base.id,
              kind: override?.kind ?? footage?.kind ?? base.kind,
              comparisonCards:
                override?.comparisonCards ?? base.comparisonCards,
              overlay: override?.overlay ?? base.overlay,
              src: override?.src ?? footage?.src ?? base.src,
              start: override?.start ?? base.start,
              duration: override?.duration ?? base.duration,
              narration: override?.narration ?? base.narration,
              words: override?.words ?? base.words,
              mediaOrigin,
              mediaFit:
                override?.mediaFit ??
                base.mediaFit ??
                defaultMediaFit(mediaOrigin),
              mediaStart:
                override?.mediaStart ?? footage?.mediaStart ?? base.mediaStart,
              mediaEnd:
                override?.mediaEnd ?? footage?.mediaEnd ?? base.mediaEnd,
              mediaMuted:
                override?.mediaMuted ?? footage?.mediaMuted ?? base.mediaMuted,
              sourceDuration:
                override?.sourceDuration ??
                footage?.sourceDuration ??
                base.sourceDuration,
              transitionOut: override?.transitionOut ?? base.transitionOut,
              documentary
            }
          })
        : input.shots.map((s, i) => {
            const footage = footageSelections[i]
            if (s.start == null || s.duration == null) {
              throw new Error(
                `Shot ${i} is missing start/duration — required for every shot when beatsId is not provided.`
              )
            }
            const assetRights = s.documentary?.assetId
              ? documentaryProject?.assets.find(
                  asset => asset.id === s.documentary?.assetId
                )?.rights
              : undefined
            const documentary = s.documentary
              ? {
                  ...s.documentary,
                  rights: s.documentary.rights ?? footage?.rights ?? assetRights
                }
              : undefined
            const mediaOrigin = footage
              ? originFromFootage(footage)
              : (s.mediaOrigin ?? originFromDocumentary(documentary))
            return {
              id: s.id,
              kind: s.kind ?? footage?.kind ?? 'photo',
              comparisonCards: s.comparisonCards,
              overlay: s.overlay,
              src: s.src ?? footage?.src,
              start: s.start,
              duration: s.duration,
              narration: s.narration,
              words: s.words,
              mediaOrigin,
              mediaFit: s.mediaFit ?? defaultMediaFit(mediaOrigin),
              mediaStart: s.mediaStart ?? footage?.mediaStart,
              mediaEnd: s.mediaEnd ?? footage?.mediaEnd,
              mediaMuted: s.mediaMuted ?? footage?.mediaMuted,
              sourceDuration: s.sourceDuration ?? footage?.sourceDuration,
              transitionOut: s.transitionOut,
              documentary
            }
          })

      const validAudioUrls = new Set(
        parseAudioCatalog(catalogData).tracks.map(toCatalogAudioUrl)
      )
      const sanitizedAudioCues = input.audioCues?.filter(cue => {
        if (!cue.src) return false
        if (process.env.NODE_ENV === 'test') return true
        if (cue.src.startsWith('/audio/')) {
          return validAudioUrls.has(cue.src)
        }
        return true
      })

      // Build the canonical Remotion storyboard input — the single shape the preview and
      // the Lambda render both consume. Zod fills defaults (dimensions, accent).
      let inputProps: StoryboardInput = storyboardInputSchema.parse({
        width: input.width ?? 1280,
        height: input.height ?? 720,
        fps: input.fps ?? 30,
        brand: { channel: input.channel, accent: input.accent ?? '#ff2d55' },
        shots,
        voice,
        music: input.music,
        musicCredit: input.musicCredit,
        audioCues: sanitizedAudioCues,
        transitionSfxVolume: input.transitionSfxVolume,
        captionStyle: input.captionStyle,
        documentaryProject: documentaryProject
          ? {
              id: documentaryProject.id,
              chapters: documentaryProject.chapters,
              citations: documentaryProject.dossier.citations,
              qa: documentaryProject.qa
            }
          : undefined
      })

      if (documentaryProject) {
        const qa = runDocumentaryQa(documentaryProject, inputProps)
        documentaryProject = documentaryProjectSchema.parse({
          ...documentaryProject,
          qa,
          updatedAt: new Date().toISOString()
        })
        inputProps = storyboardInputSchema.parse({
          ...inputProps,
          documentaryProject: {
            id: documentaryProject.id,
            chapters: documentaryProject.chapters,
            citations: documentaryProject.dossier.citations,
            qa
          }
        })
        await kvSetJSON(
          `documentary:${documentaryProject.id}`,
          documentaryProject
        )
      }

      const last = inputProps.shots[inputProps.shots.length - 1]
      const totalSeconds = +(last.start + last.duration).toFixed(2)
      const fallbacks = inputProps.shots.filter(s => !s.src).length

      // Publish the storyboard to KV so the Studio page (/studio/[id]) can load it and the
      // user can render it on Lambda from there.
      const studioId = `sb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
      await kvSetJSON(`storyboard:${studioId}`, inputProps)

      return {
        state: 'complete' as const,
        studioId,
        studioPath: `/studio/${studioId}`,
        inputProps,
        totalSeconds,
        shots: inputProps.shots.length,
        hadVoice: !!inputProps.voice,
        hadMusic: !!inputProps.music,
        fallbacks,
        lambdaReady: isLambdaConfigured()
      }
    }
  })
}
