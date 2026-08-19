// Canonical Remotion storyboard input — the single source of truth shared by the
// composition (remotion/Storyboard.tsx), the render tool (lib/tools/video/compose-render.ts),
// the Lambda wrapper (lib/remotion/lambda.ts) and the in-chat Player preview
// (components/remotion-preview.tsx). Everything that produces or consumes a storyboard
// speaks this shape, so preview and final render are guaranteed to match.
import { z } from 'zod'

import {
  documentaryShotMetadataSchema,
  documentaryStoryboardMetadataSchema
} from './documentary-schema'

/** Crossfade length between shots, in seconds — matches the studio's 0.18–0.25s. */
export const FADE_SECONDS = 0.25

export const wordSchema = z.object({
  word: z.string(),
  /** Start time in seconds on the global timeline. */
  start: z.number(),
  /** End time in seconds on the global timeline. */
  end: z.number()
})

export const comparisonCardItemSchema = z.object({
  name: z.string(),
  role: z.string(),
  country: z.string(),
  countryCode: z.string().optional(),
  lifespan: z.string(),
  portraitUrl: z.string(),
  cause: z.string(),
  statNumber: z.number(),
  statLabel: z.string().default('AGE').optional()
})

export const barChartItemSchema = z.object({
  label: z.string(),
  value: z.number(),
  highlighted: z.boolean().optional()
})

export const overlaySchema = z.object({
  type: z.enum([
    'none',
    'film-burn',
    'camera-shake',
    'number-counter',
    'circular-progress',
    'typewriter',
    'glitch',
    'newspaper',
    'bar-chart',
    'animated-map',
    'quote-card'
  ]),
  text: z.string().optional(),
  numberValue: z.number().optional(),
  numberLabel: z.string().optional(),
  numberPrefix: z.string().optional(),
  numberSuffix: z.string().optional(),
  // Newspaper options
  publication: z.string().optional(),
  issueDate: z.string().optional(),
  category: z.string().optional(),
  headline: z.string().optional(),
  highlightWords: z.array(z.string()).optional(),
  summary: z.string().optional(),
  byline: z.string().optional(),
  // Quote card options
  quote: z.string().optional(),
  speaker: z.string().optional(),
  role: z.string().optional(),
  institution: z.string().optional(),
  date: z.string().optional(),
  // Bar chart options
  bars: z.array(barChartItemSchema).optional(),
  // Map options
  mapTitle: z.string().optional(),
  fromLabel: z.string().optional(),
  toLabel: z.string().optional(),
  /** [lon, lat], resolved from fromLabel via MapTiler geocoding. */
  fromCoords: z.tuple([z.number(), z.number()]).optional(),
  /** [lon, lat], resolved from toLabel via MapTiler geocoding. */
  toCoords: z.tuple([z.number(), z.number()]).optional(),
  /** Real MapTiler satellite static-map URL framing fromCoords/toCoords, built once and persisted. */
  mapImageUrl: z.string().optional()
})

export const transitionTypeSchema = z.enum([
  'crossfade',
  'whip-pan',
  'zoom-blur',
  'slide',
  'film-burn',
  'cut'
])

export const transitionSchema = z.object({
  type: transitionTypeSchema,
  /** Transition length in seconds. Hard cuts should use 0. */
  duration: z.number().min(0).max(1)
})

export const shotSchema = z
  .object({
    /** Stable beat identifier for documentary editing, credits, and QA. */
    id: z.string().optional(),
    kind: z.enum(['photo', 'video', 'avatar', 'a-roll', 'comparison']),
    /**
     * Public http(s) URL of the resolved asset (the vision-verified pick from
     * sourceFootage). Omit to render a clean brand card for this shot. Lambda cannot
     * read local file paths, so only URLs are valid in production.
     */
    src: z.string().optional(),
    /** Shot start time in seconds on the global timeline (Σ of prior shot durations). */
    start: z.number(),
    /** Shot duration in seconds. */
    duration: z.number(),
    narration: z.string().optional(),
    /** Word-level caption timings (from cutBeats / the voiceover). */
    words: z.array(wordSchema).optional(),
    /** Comparison cards data if kind === 'comparison'. */
    comparisonCards: z.array(comparisonCardItemSchema).optional(),
    /** Motion graphic visual overlay attached to this shot. */
    overlay: overlaySchema.optional(),
    /** If true, this shot is hidden from playback & render without deleting it. */
    hidden: z.boolean().default(false).optional(),
    /** Volume of audio embedded within this video clip (0.0 to 1.0, default 0). */
    videoVolume: z.number().min(0).max(1).default(0).optional(),
    /** Canonical source provenance used to choose a backward-compatible default fit. */
    mediaOrigin: z
      .enum(['researched', 'archival', 'generated', 'manual'])
      .optional(),
    /** Scale source media within the shot frame. */
    mediaFit: z.enum(['contain', 'cover']).optional(),
    /** Source-media playback window start, in seconds. */
    mediaStart: z.number().optional(),
    /** Source-media playback window end, in seconds. */
    mediaEnd: z.number().optional(),
    /** Whether to mute the source media's embedded audio. */
    mediaMuted: z.boolean().optional(),
    /** Known duration of the resolved source video, in seconds. */
    sourceDuration: z.number().positive().optional(),
    /** Visual transition from this shot into the next active shot. */
    transitionOut: transitionSchema.optional(),
    /** Typed WW1/WW2 documentary semantics; absent for generic videos. */
    documentary: documentaryShotMetadataSchema.optional()
  })
  .refine(
    shot =>
      shot.mediaStart === undefined ||
      shot.mediaEnd === undefined ||
      shot.mediaEnd > shot.mediaStart,
    {
      message: 'mediaEnd must be greater than mediaStart',
      path: ['mediaEnd']
    }
  )

export const brandSchema = z.object({
  channel: z.string().optional(),
  /** Accent color #rrggbb for captions and fallback cards. */
  accent: z.string().default('#ff2d55')
})

export const captionStyleSchema = z.enum([
  'documentary',
  'karaoke',
  'minimal',
  'tiktok',
  'full-sentence',
  'normal'
])

export const musicCreditSchema = z.object({
  title: z.string(),
  creator: z.string(),
  source: z.literal('pixabay'),
  sourceUrl: z.string().url(),
  license: z.literal('Pixabay Content License'),
  licenseUrl: z.literal('https://pixabay.com/service/license-summary/'),
  contentIdRegistered: z.boolean()
})

export const audioCueSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['sfx', 'ambient']),
  src: z.string().min(1),
  /** Start time on the global timeline, in seconds. */
  start: z.number().min(0),
  /** Cue playback window. Omit to let a one-shot play to its natural end. */
  duration: z.number().positive().optional(),
  volume: z.number().min(0).max(2).default(0.5),
  loop: z.boolean().default(false),
  fadeIn: z.number().min(0).default(0),
  fadeOut: z.number().min(0).default(0),
  credit: musicCreditSchema.optional()
})

export const storyboardInputSchema = z.object({
  width: z.number().default(1280),
  height: z.number().default(720),
  fps: z.number().default(30),
  brand: brandSchema.default({ accent: '#ff2d55' }),
  shots: z.array(shotSchema).min(1),
  /** Public URL of the voiceover track (wav/mp3). Optional. */
  voice: z.string().optional(),
  /** Volume of the voiceover track (0.0 to 2.0, default 1.0). */
  voiceVolume: z.number().min(0).max(2).default(1).optional(),
  /** Public URL of a background music bed. Optional. */
  music: z.string().optional(),
  /** Provenance retained with curated music for publishing records and claim disputes. */
  musicCredit: musicCreditSchema.optional(),
  /** Base volume of the background music bed (0.0 to 2.0, default 0.12). */
  musicVolume: z.number().min(0).max(2).default(0.12).optional(),
  /** Timeline-positioned sound effects and ambience layers. */
  audioCues: z.array(audioCueSchema).default([]).optional(),
  /** Volume of automatic transition whooshes/impacts. */
  transitionSfxVolume: z.number().min(0).max(2).default(0.35).optional(),
  /** Whether to display subtitles/captions on the video. Default: true. */
  showCaptions: z.boolean().default(true).optional(),
  /** Whether to show the YouTube Subscribe Call-To-Action animation near the end. Default: true. */
  showSubscribeCta: z.boolean().default(true).optional(),
  /** Strength of the optional film grain treatment (0..1). */
  filmGrainIntensity: z.number().min(0).max(1).optional(),
  /**
   * Caption presentation. `normal` remains a legacy alias; new projects can use
   * documentary, karaoke, minimal, tiktok, or full-sentence styles.
   */
  captionStyle: captionStyleSchema.optional(),
  /** Project-level documentary chapters, citations, and QA; absent for generic videos. */
  documentaryProject: documentaryStoryboardMetadataSchema.optional()
})

export type CaptionWord = z.infer<typeof wordSchema>
export type CaptionStyle = z.infer<typeof captionStyleSchema>
export type MusicCredit = z.infer<typeof musicCreditSchema>
export type AudioCue = z.infer<typeof audioCueSchema>
export type Transition = z.infer<typeof transitionSchema>
export type TransitionType = z.infer<typeof transitionTypeSchema>
export type Shot = z.infer<typeof shotSchema>
export type Brand = z.infer<typeof brandSchema>
export type StoryboardInput = z.infer<typeof storyboardInputSchema>

/** Recalculate start times for an array of shots based on their durations in sequence (skipping hidden shots). */
export function recalculateShotTimings(shots: Shot[]): Shot[] {
  let cursor = 0
  return shots.map(s => {
    if (s.hidden) {
      return { ...s, start: +cursor.toFixed(3) }
    }
    const start = +cursor.toFixed(3)
    const duration = +Math.max(0.2, s.duration).toFixed(3)
    cursor += duration
    return {
      ...s,
      start,
      duration
    }
  })
}

/** Total timeline length in seconds — last active shot's start + duration. */
export function totalSeconds(input: Pick<StoryboardInput, 'shots'>): number {
  const activeShots = input.shots.filter(s => !s.hidden)
  if (!activeShots.length) return 0
  const last = activeShots[activeShots.length - 1]
  return +(last.start + last.duration).toFixed(3)
}

/** Composition length in frames, derived from the shots and fps. */
export function durationInFrames(
  input: Pick<StoryboardInput, 'shots' | 'fps'>
): number {
  const fps = input.fps || 30
  return Math.max(1, Math.ceil(totalSeconds(input) * fps))
}
