// Kakkao engine — beat segmentation, ported server-side from the studio pipeline.
// Turns a clean narration script into a storyboard skeleton: an ordered list of shots,
// each with its narration, a concrete footage search query + intent, a still/clip hint,
// and estimated word-level timings so the karaoke captions and the FFmpeg xfade chain
// have a timeline to lock to. Real voiceover word timings replace the estimates later;
// until then even/character-weighted estimates keep the whole render coherent.
import { generateText, streamObject, tool } from 'ai'
import { z } from 'zod'

import { getModel } from '@/lib/utils/registry'

import { normalizeDocumentaryBeatPacing } from './beat-pacing'
import type { VoiceWord } from './voice'

const WORDS_PER_SEC = 2.4 // ~144 wpm, matching the script duration presets

export interface BeatWord {
  word: string
  start: number
  end: number
}

export interface BeatShot {
  narration: string
  kind: 'photo' | 'video' | 'comparison' | 'avatar' | 'a-roll'
  visualQuery: string
  visualIntent: string
  start: number
  duration: number
  words: BeatWord[]
  comparisonCards?: any[]
}

export interface Storyboard {
  topic: string
  format: '16:9' | '9:16' | '1:1'
  width: number
  height: number
  fps: number
  brand: { channel: string; accent: string }
  shots: BeatShot[]
  totalSeconds: number
  estimatedTimings: boolean
}

const DIMS: Record<Storyboard['format'], { width: number; height: number }> = {
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
  '1:1': { width: 1080, height: 1080 }
}

const SYS_BEATS = `You are a video editor segmenting a finished narration script into SHOTS for a faceless video.
Return one entry per shot, in reading order, covering the ENTIRE script with no words dropped or added.
Rules:
- For historical and documentary videos, create long, atmospheric scenes (10 to 30 seconds per shot, roughly 25-50 words per shot). Do NOT split sentences into 3-4 second micro-shots.
- For standard short-form videos, each shot's narration is roughly one sentence (4-25 words).
- Concatenating every "narration" in order MUST reproduce the original script exactly (aside from whitespace).
- Prefer "video" for motion/events/action, "photo" for places, objects, portraits, maps, diagrams.
- visualQuery must be specific and literal enough to match real archival/stock footage — no abstract concepts.
- For key historical beats (dates, battle locations, troop movements, equipment specs, stats, headlines), request a motion graphic overlayType ('animated-map', 'newspaper', 'equipment-spec', 'battle-map', 'evidence-card', 'number-counter').`

const DOCUMENTARY_BEAT_GUIDANCE =
  '- For documentary narration, request atmospheric beats of at least 15 narrated words and at least 10 seconds (up to 30s) at the expected speaking pace. Do NOT output fast 3-4s micro-shots.'

const shotSchema = z.object({
  narration: z
    .string()
    .describe(
      'The exact consecutive words of the script this shot covers (verbatim, no paraphrase)'
    ),
  kind: z.enum(['photo', 'video']),
  visualQuery: z
    .string()
    .describe(
      "A concrete, specific search phrase to find real b-roll for this shot (e.g. 'Saturn V rocket launch 1969')"
    ),
  visualIntent: z
    .string()
    .describe('One plain sentence describing what the shot must SHOW'),
  overlayType: z
    .enum([
      'none',
      'animated-map',
      'newspaper',
      'number-counter',
      'bar-chart',
      'typewriter',
      'film-burn',
      'camera-shake',
      'equipment-spec',
      'battle-map',
      'evidence-card',
      'force-comparison',
      'date-location'
    ])
    .optional()
    .describe('Optional motion graphic overlay type for historical dates, maps, evidence boards, or stats'),
  overlayTitle: z
    .string()
    .optional()
    .describe('Headline, label, location name, or stat metric for the overlay')
})
const shotListSchema = z.object({ shots: z.array(shotSchema).min(1) })

type ShotCore = Omit<BeatShot, 'start' | 'duration' | 'words'>

async function segmentViaToolGeneration(
  model: string,
  script: string,
  topic: string | undefined,
  signal: AbortSignal,
  system: string
): Promise<ShotCore[]> {
  try {
    const result = await generateText({
      model: getModel(model),
      system: `${system}\n\nSubmit the ordered shots with the required tool.`,
      prompt: `Segment this narration script into shots. Topic: ${topic || 'n/a'}.\n\nSCRIPT:\n${script}`,
      abortSignal: signal,
      maxRetries: 1,
      maxOutputTokens: 12_000,
      tools: {
        submit_shots: tool({
          description: 'Submit the ordered storyboard shots.',
          inputSchema: shotListSchema
        })
      },
      toolChoice: { type: 'tool', toolName: 'submit_shots' }
    })
    const call = result.toolCalls.find(item => item.toolName === 'submit_shots')
    if (!call) return []
    const shotsInput = (call.input as { shots?: unknown[] })?.shots
    if (!Array.isArray(shotsInput)) return []
    return shotsInput
      .map((shot: unknown) => sanitizeCore(shot as any, topic || ''))
      .filter((shot): shot is ShotCore => shot !== null)
  } catch {
    return []
  }
}

// Segmentation is the step users watch spin. It used to be a single blocking generateText
// with no output cap and no deadline: on a long script the model would run for minutes, and
// any truncation made the trailing JSON unparseable, so the tool threw after the wait. Now
// we stream the array and keep whatever shots have arrived, so a slow or cut-off generation
// degrades to a shorter storyboard instead of a crash.
const BEATS_TIMEOUT_MS = Number(process.env.CUT_BEATS_TIMEOUT_MS || 120_000)

function sanitizeCore(b: unknown, fallbackQuery: string): ShotCore | null {
  const shot = b as Record<string, unknown> | null
  const narration =
    shot && typeof shot.narration === 'string' ? shot.narration.trim() : ''
  if (!narration) return null
  return {
    narration,
    kind: shot!.kind === 'video' ? 'video' : 'photo',
    visualQuery: String(shot!.visualQuery || fallbackQuery || narration).trim(),
    visualIntent: String(shot!.visualIntent || narration).trim()
  }
}

// Fallback path for cutScriptIntoBeats — see call site. Plain generation + hand-rolled
// JSON parsing, same schema, no streaming.
async function segmentViaPlainGeneration(
  model: string,
  script: string,
  topic: string | undefined,
  signal: AbortSignal,
  system: string
): Promise<ShotCore[]> {
  let text: string
  try {
    const result = await generateText({
      model: getModel(model),
      system: `${system}\n\nRespond with ONLY a JSON array of shot objects, no prose, no markdown fences.`,
      prompt: `Segment this narration script into shots. Topic: ${topic || 'n/a'}.\n\nSCRIPT:\n${script}`,
      abortSignal: signal,
      maxRetries: 1
    })
    text = result.text
  } catch {
    return []
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start < 0 || end < start) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  return parsed
    .map(el => sanitizeCore(el, topic || ''))
    .filter((c): c is ShotCore => c !== null)
}

// Distribute a shot's duration across its words, weighting by word length so long
// words get more time — good enough for karaoke fill until real TTS timings arrive.
function timeWords(
  narration: string,
  start: number,
  duration: number
): BeatWord[] {
  const tokens = narration.split(/\s+/).filter(Boolean)
  if (!tokens.length) return []
  const weights = tokens.map(w =>
    Math.max(1, w.replace(/[^a-z0-9]/gi, '').length)
  )
  const total = weights.reduce((a, b) => a + b, 0)
  let t = start
  return tokens.map((word, i) => {
    const d = (weights[i] / total) * duration
    const w = { word, start: +t.toFixed(3), end: +(t + d).toFixed(3) }
    t += d
    return w
  })
}

export interface CutBeatsInput {
  script: string
  topic?: string
  format?: Storyboard['format']
  fps?: number
  channel?: string
  accent?: string
  /** Enables documentary pacing without changing the aspect-ratio format. */
  profile?: {
    niche?: 'ww1_ww2'
    format: 'documentary'
    presetVersion?: number
  }
  /** Semantic planners normalize only after enriching the timed cuts with metadata. */
  deferDocumentaryPacing?: boolean
  /** Real word timings from a voiceover; when present, shots lock to actual speech. */
  voiceWords?: VoiceWord[]
}

// Bind real voiceover word timings onto semantically-cut shots. The concatenation of
// shot narrations equals the script that was voiced, so we partition the voice words to
// shots by token count. Shot boundaries tile [0, audioEnd] at each shot's first spoken
// word (pauses fold into the preceding shot) so the video length locks to the audio with
// no drift; captions keep the voiceover's absolute word times.
export function bindVoiceTimings(
  shots: Omit<BeatShot, 'start' | 'duration' | 'words'>[],
  voiceWords: VoiceWord[]
): BeatShot[] {
  const perShot: VoiceWord[][] = []
  let wp = 0
  for (const s of shots) {
    const n = s.narration.split(/\s+/).filter(Boolean).length
    perShot.push(voiceWords.slice(wp, wp + n))
    wp += n
  }
  // Any leftover words (LLM dropped/added a token) go to the last shot so nothing is lost.
  if (wp < voiceWords.length && perShot.length) {
    perShot[perShot.length - 1].push(...voiceWords.slice(wp))
  }
  const audioEnd = voiceWords.length ? voiceWords[voiceWords.length - 1].end : 0
  const n = shots.length
  const boundaries: number[] = new Array(n + 1)
  boundaries[0] = 0
  for (let i = 1; i < n; i++) {
    const ws = perShot[i]
    boundaries[i] = ws.length ? ws[0].start : boundaries[i - 1]
  }
  boundaries[n] = audioEnd
  return shots.map((s, i) => {
    const start = +boundaries[i].toFixed(3)
    const duration = +Math.max(0.3, boundaries[i + 1] - boundaries[i]).toFixed(
      3
    )
    return { ...s, start, duration, words: perShot[i] }
  })
}

// Segment a script into a timed storyboard skeleton. LLM does the semantic cut; timings
// are estimated from word counts (estimatedTimings=true) until real voiceover is bound.
//
// `onProgress` fires as shots stream in, so callers can show the storyboard filling up
// rather than a spinner that sits on "Segmenting into shots…" for the whole generation.
export async function cutScriptIntoBeats(
  model: string,
  input: CutBeatsInput,
  abortSignal?: AbortSignal,
  onProgress?: (shotsSoFar: number) => void
): Promise<Storyboard> {
  const script = (input.script || '').trim()
  if (!script) throw new Error('no script to segment')
  const format = input.format || '16:9'
  const fps = input.fps || 30
  const { width, height } = DIMS[format]
  const system =
    input.profile?.format === 'documentary'
      ? `${SYS_BEATS}\n${DOCUMENTARY_BEAT_GUIDANCE}`
      : SYS_BEATS

  // Fold the caller's signal together with a hard deadline so a stalled generation can
  // never hang the tool call indefinitely.
  const deadline = AbortSignal.timeout(BEATS_TIMEOUT_MS)
  const signal = abortSignal
    ? AbortSignal.any([abortSignal, deadline])
    : deadline

  // The streaming attempt gets its own bounded sub-budget rather than the full
  // deadline above. Observed with ModelArk: structured-output streaming can hang
  // silently (no elements, no error) instead of failing fast — without this, it burns
  // the entire BEATS_TIMEOUT_MS and the plain-generation fallback below never gets a
  // real chance to run before `signal` is already aborted too.
  const streamBudgetMs = Math.min(BEATS_TIMEOUT_MS / 2, 60_000)
  const streamSignal = AbortSignal.any([
    signal,
    AbortSignal.timeout(streamBudgetMs)
  ])

  const cores: ShotCore[] = []
  if (model.startsWith('modelark:')) {
    const toolShots = await segmentViaToolGeneration(
      model,
      script,
      input.topic,
      signal,
      system
    )
    for (const shot of toolShots) {
      cores.push(shot)
      onProgress?.(cores.length)
    }
  } else {
    try {
      const { elementStream } = streamObject({
        model: getModel(model),
        output: 'array',
        schema: shotSchema,
        system,
        prompt: `Segment this narration script into shots. Topic: ${input.topic || 'n/a'}.\n\nSCRIPT:\n${script}`,
        abortSignal: streamSignal,
        maxRetries: 1
      })

      // Each element resolves as soon as it is complete, so shots land progressively.
      for await (const element of elementStream) {
        const core = sanitizeCore(element, input.topic || '')
        if (core) {
          cores.push(core)
          onProgress?.(cores.length)
        }
      }
    } catch (error) {
      // A mid-stream failure (timeout, truncation, transport hiccup, or an outright
      // rejection before any element arrives — e.g. some OpenAI-compatible providers 400
      // on response_format:'json_object' unless the literal word "json" appears in the
      // prompt) keeps whatever shots already landed and falls through to the fallback below
      // rather than failing the whole request immediately.
      console.warn(
        `[Beats] Streaming segmentation failed after ${cores.length} shots:`,
        error
      )
    }
  }

  if (!cores.length) {
    // Streaming produced nothing usable — either it threw outright or completed with zero
    // valid elements (seen with some OpenAI-compatible providers whose structured/array-
    // output streaming silently yields nothing even though the same model returns correct
    // JSON via a plain generation — observed with ModelArk). One extra non-streaming call,
    // parsed by hand, before giving up entirely.
    const fallback = await segmentViaPlainGeneration(
      model,
      script,
      input.topic,
      signal,
      system
    )
    if (fallback.length) {
      cores.push(...fallback)
      onProgress?.(cores.length)
    }
  }

  if (!cores.length) throw new Error('beat segmentation produced no shots')

  const useVoice = !!input.voiceWords?.length
  let shots: BeatShot[]
  if (useVoice) {
    shots = bindVoiceTimings(cores, input.voiceWords!)
  } else {
    // Estimate timings from word counts (character-weighted within each shot).
    let cursor = 0
    shots = cores.map(core => {
      const wordCount = core.narration.split(/\s+/).filter(Boolean).length
      const duration = Math.max(1.4, +(wordCount / WORDS_PER_SEC).toFixed(2))
      const start = +cursor.toFixed(3)
      cursor += duration
      return {
        ...core,
        start,
        duration,
        words: timeWords(core.narration, start, duration)
      }
    })
  }

  const isDocumentaryTopic =
    input.profile?.format === 'documentary' ||
    /history|documentary|ww2|war|battle|la-5|aircraft|luftwaffe|combat|military|historical/i.test(
      input.topic || ''
    ) ||
    /history|documentary|ww2|war|battle|la-5|aircraft|luftwaffe|combat|military|historical/i.test(
      script
    )

  if (isDocumentaryTopic && !input.deferDocumentaryPacing) {
    shots = normalizeDocumentaryBeatPacing(shots)
  }

  const last = shots[shots.length - 1]
  const totalSeconds = +(last.start + last.duration).toFixed(2)

  return {
    topic: input.topic || '',
    format,
    width,
    height,
    fps,
    brand: {
      channel: input.channel || 'Kakkao',
      accent: input.accent || '#ff2d55'
    },
    shots,
    totalSeconds,
    estimatedTimings: !useVoice
  }
}
