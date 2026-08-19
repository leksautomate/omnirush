// Video understanding for the learn-from-video sub-agent. Reverse-engineers a reference
// YouTube video's structure (hook, phase order, pacing, visual mix, narration devices) so
// the pipeline can make a video in that style.
//
// Prefers a model that ingests the URL natively — the model actually watches the footage
// and hears the audio, so there is no download step and no frame shuttling on the happy
// path. ModelArk's seed-2-0 family (pro/lite/mini/code-preview) does this and is tried
// first when configured; Gemini is the fallback native-video path. Four tiers, best first:
//   0. MODELARK — the canonical YouTube URL is handed to a seed-2-0 model as a `video_url`
//                 part via Ark's REST API directly (no AI SDK integration for Ark video
//                 input exists, so this tier bypasses `generateObject`). Real vision.
//   1. GEMINI   — same idea via @ai-sdk/google's native file-part support, as a fallback.
//   2. FRAMES   — if neither can open the URL, and a watch service is configured, that
//                 service returns sampled JPEG frames + a transcript, read as images by
//                 whichever vision model is configured. Still real vision, pre-extracted.
//   3. METADATA — last resort: the model reasons from the URL/goal alone. Clearly marked
//                 as not-watched so callers don't mistake it for an actual viewing.
//
// Note: this module deliberately does NOT go through `@/lib/utils/registry`. getModel()
// rewrites every model id onto AgentRouter/Claude, which cannot see video and 400s on
// image parts — that was the original crash. We construct providers directly instead.
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateObject, LanguageModel } from 'ai'
import { z } from 'zod'

/** How the analysis was produced — `metadata` means the model never saw the footage. */
export type AnalysisMethod = 'video' | 'frames' | 'metadata'

export interface VideoAnalysis {
  provider: 'modelark' | 'gemini'
  method: AnalysisMethod
  /** True when the model actually saw the footage (video or extracted frames). */
  watched: boolean
  hook?: string
  phases?: { name: string; purpose: string }[]
  pacing?: string
  visualMix?: string
  narrationDevices?: string[]
  summary: string
  /** The full structured object as returned by the model (superset of the above). */
  raw: Record<string, unknown>
}

const ANALYSIS_SYS = `You reverse-engineer YouTube videos for a faceless-content studio.
Watch the reference video and describe how it is built, so a scriptwriter and an editor can
recreate its style on a different topic. Be concrete and specific — cite what actually happens
on screen and in the narration rather than generic advice. Respond in structured JSON format.`

const analysisSchema = z.object({
  hook: z.string().describe('How the first 5-10s grabs attention'),
  phases: z
    .array(
      z.object({
        name: z
          .string()
          .describe('e.g. real footage / commentary over b-roll / graphics'),
        purpose: z.string().describe('What this phase accomplishes')
      })
    )
    .describe('The phases of the video, in order'),
  pacing: z.string().describe('Cut rhythm and shot-length feel'),
  visualMix: z.string().describe('Balance of real footage vs graphics vs talking'),
  narrationDevices: z
    .array(z.string())
    .describe('e.g. curiosity loops, retention hooks, callbacks'),
  summary: z
    .string()
    .describe('2-3 sentences a scriptwriter can act on to recreate this style')
})

type Analysis = z.infer<typeof analysisSchema>

// --- Provider ---------------------------------------------------------------

function geminiApiKey(): string {
  return (
    process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || ''
  )
}

function geminiModel() {
  const apiKey = geminiApiKey()
  if (!apiKey) {
    throw new Error(
      'Gemini is not configured — set GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) to watch reference videos.'
    )
  }
  const google = createGoogleGenerativeAI({ apiKey })
  return google(process.env.LEARN_VIDEO_GEMINI_MODEL || 'gemini-2.0-flash')
}

function modelArkApiKey(): string {
  return process.env.MODELARK_API_KEY || ''
}

function modelArkBaseURL(): string {
  return (
    process.env.MODELARK_BASE_URL || 'https://ark.ap-southeast.bytepluses.com/api/v3'
  ).replace(/\/+$/, '')
}

// seed-2-0-pro is the strongest of the seed-2-0 family for this kind of dense
// visual/narrative reverse-engineering. Override with LEARN_VIDEO_MODELARK_MODEL —
// seed-2-0-lite-260428 / seed-2-0-mini-260428 / seed-2-0-code-preview-260328 also
// support video input, for cheaper/faster passes.
const MODELARK_DEFAULT_VIDEO_MODEL = 'seed-2-0-pro-260328'

function modelArkModelId(): string {
  return process.env.LEARN_VIDEO_MODELARK_MODEL || MODELARK_DEFAULT_VIDEO_MODEL
}

// Standard chat-completions shape (text + image_url parts both work through the
// generic AI SDK translation), used for the frames and metadata tiers.
function modelArkChatModel(): LanguageModel {
  const apiKey = modelArkApiKey()
  if (!apiKey) {
    throw new Error(
      'ModelArk is not configured — set MODELARK_API_KEY to watch reference videos.'
    )
  }
  const ark = createOpenAICompatible({
    name: 'modelark',
    apiKey,
    baseURL: modelArkBaseURL()
  })
  return ark(modelArkModelId())
}

// Picks whichever vision-capable provider is configured, preferring ModelArk since
// it doesn't require a separate Gemini key.
function pickVisionModel(): {
  model: LanguageModel
  provider: VideoAnalysis['provider']
} {
  if (modelArkApiKey()) {
    return { model: modelArkChatModel(), provider: 'modelark' }
  }
  if (geminiApiKey()) {
    return { model: geminiModel(), provider: 'gemini' }
  }
  throw new Error(
    'No vision-capable model configured — set MODELARK_API_KEY or GEMINI_API_KEY to watch reference videos.'
  )
}

// --- URL handling -----------------------------------------------------------

const YT_ID = /^[\w-]{11}$/

// Gemini only accepts YouTube links in the canonical `watch?v=` (or `youtu.be/`) shape —
// @ai-sdk/google matches those against a regex to decide whether to pass the URL through
// as fileData or to download the bytes itself. A /shorts/, /embed/ or m.youtube.com link
// fails that match, so the SDK would try to fetch the page and inline it, which stalls and
// then blows up. Normalising up front keeps us on the pass-through path.
export function canonicalYouTubeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim())
    const host = u.hostname.replace(/^(?:www|m|music)\./, '')
    let id: string | null = null

    if (host === 'youtu.be') {
      id = u.pathname.slice(1).split('/')[0] || null
    } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') {
        id = u.searchParams.get('v')
      } else {
        const m = u.pathname.match(/^\/(?:shorts|embed|v|live)\/([\w-]+)/)
        id = m ? m[1] : null
      }
    }

    return id && YT_ID.test(id) ? `https://www.youtube.com/watch?v=${id}` : null
  } catch {
    return null
  }
}

// --- Helpers ----------------------------------------------------------------

// A hung analysis is worse than a failed one: the tool call never settles and the UI spins
// forever. Every tier gets a hard ceiling, folded together with the caller's abort signal.
function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const timeout = AbortSignal.timeout(ms)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

const VIDEO_TIMEOUT_MS = Number(process.env.LEARN_VIDEO_TIMEOUT_MS || 180_000)
const FRAMES_TIMEOUT_MS = 120_000
const METADATA_TIMEOUT_MS = 60_000

function shape(
  raw: Analysis,
  method: AnalysisMethod,
  provider: VideoAnalysis['provider'] = 'gemini'
): VideoAnalysis {
  return {
    provider,
    method,
    watched: method !== 'metadata',
    hook: raw.hook,
    phases: raw.phases,
    pacing: raw.pacing,
    visualMix: raw.visualMix,
    narrationDevices: raw.narrationDevices,
    summary: raw.summary || 'Analysis complete.',
    raw: raw as unknown as Record<string, unknown>
  }
}

function briefFor(youtubeUrl: string, goal: string | undefined): string {
  return `Reference video: ${youtubeUrl}${goal ? `\nWhat we want to make from it: ${goal}` : ''}`
}

// --- Tier 0: native ModelArk (Ark seed-2-0) video understanding -------------
//
// Ark's chat-completions message shape supports vision via `image_url` content parts
// (standard, goes through the generic AI SDK translation fine — see the frames tier)
// and video via the analogous `video_url` part, which is an Ark-specific extension
// with no AI SDK support. So this tier talks to Ark's REST API directly.
const ANALYSIS_JSON_SHAPE = `{
  "hook": string,
  "phases": [{ "name": string, "purpose": string }],
  "pacing": string,
  "visualMix": string,
  "narrationDevices": string[],
  "summary": string
}`

async function analyzeWithModelArkVideo(
  canonicalUrl: string,
  goal: string | undefined,
  signal?: AbortSignal
): Promise<VideoAnalysis> {
  const res = await fetch(`${modelArkBaseURL()}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${modelArkApiKey()}`
    },
    body: JSON.stringify({
      model: modelArkModelId(),
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `${ANALYSIS_SYS}\n\nRespond with ONLY a JSON object matching this shape, no prose, no markdown fences:\n${ANALYSIS_JSON_SHAPE}`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `${briefFor(canonicalUrl, goal)}\n\nWatch the attached video end to end and reverse-engineer how it is constructed.`
            },
            { type: 'video_url', video_url: { url: canonicalUrl } }
          ]
        }
      ]
    }),
    signal: withTimeout(signal, VIDEO_TIMEOUT_MS)
  })

  if (!res.ok) {
    throw new Error(`ModelArk HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[]
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('ModelArk returned no content')

  const parsed = analysisSchema.parse(JSON.parse(content))
  return shape(parsed, 'video', 'modelark')
}

// --- Tier 1: native Gemini video understanding ------------------------------

async function analyzeWithGeminiVideo(
  canonicalUrl: string,
  goal: string | undefined,
  signal?: AbortSignal
): Promise<VideoAnalysis> {
  const { object } = await generateObject({
    model: geminiModel(),
    schema: analysisSchema,
    system: ANALYSIS_SYS,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `${briefFor(canonicalUrl, goal)}\n\nWatch the attached video end to end and reverse-engineer how it is constructed.`
          },
          {
            type: 'file',
            data: new URL(canonicalUrl),
            mediaType: 'video/mp4'
          }
        ]
      }
    ],
    abortSignal: withTimeout(signal, VIDEO_TIMEOUT_MS),
    maxRetries: 1
  })
  return shape(object, 'video')
}

// --- Tier 2: watch-service frames, read by Gemini ---------------------------

async function analyzeWithFrames(
  youtubeUrl: string,
  goal: string | undefined,
  signal?: AbortSignal
): Promise<VideoAnalysis> {
  const svc = process.env.WATCH_SERVICE_URL!
  const res = await fetch(`${svc.replace(/\/$/, '')}/watch`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(process.env.WATCH_SERVICE_TOKEN
        ? { authorization: `Bearer ${process.env.WATCH_SERVICE_TOKEN}` }
        : {})
    },
    body: JSON.stringify({ url: youtubeUrl, detail: 'efficient' }),
    signal: withTimeout(signal, FRAMES_TIMEOUT_MS)
  })
  if (!res.ok) throw new Error(`watch service ${res.status}`)
  const { frames, transcript } = (await res.json()) as {
    frames: string[]
    transcript?: string
  }
  if (!frames?.length) throw new Error('watch service returned no frames')

  const { model, provider } = pickVisionModel()
  const { object } = await generateObject({
    model,
    schema: analysisSchema,
    system: ANALYSIS_SYS,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `${briefFor(youtubeUrl, goal)}\n\nTranscript:\n${(transcript || '(none available)').slice(0, 12000)}\n\nThe images are frames sampled in chronological order. Reverse-engineer how the video is constructed.`
          },
          ...frames
            .slice(0, 20)
            .map(f => ({ type: 'image' as const, image: f }))
        ]
      }
    ],
    abortSignal: withTimeout(signal, FRAMES_TIMEOUT_MS),
    maxRetries: 1
  })
  return shape(object, 'frames', provider)
}

// --- Tier 3: metadata only --------------------------------------------------

async function fetchYouTubeSnippet(
  youtubeUrl: string
): Promise<{ title?: string; description?: string; tags?: string[] } | null> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return null
  const canonical = canonicalYouTubeUrl(youtubeUrl)
  if (!canonical) return null
  const match = canonical.match(/v=([\w-]+)/)
  const videoId = match ? match[1] : null
  if (!videoId) return null

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`
    )
    if (!res.ok) return null
    const data = await res.json()
    const item = data.items?.[0]?.snippet
    if (!item) return null
    return {
      title: item.title,
      description: item.description,
      tags: item.tags
    }
  } catch {
    return null
  }
}

async function analyzeFromMetadata(
  youtubeUrl: string,
  goal: string | undefined,
  signal?: AbortSignal
): Promise<VideoAnalysis> {
  const snippet = await fetchYouTubeSnippet(youtubeUrl)

  if (modelArkApiKey()) {
    try {
      const contextStr = snippet
        ? `\nYouTube Video Title: ${snippet.title || 'Unknown'}\nYouTube Video Description:\n${(snippet.description || '').slice(0, 1500)}\nTags: ${snippet.tags?.join(', ') || 'none'}`
        : ''

      const res = await fetch(`${modelArkBaseURL()}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${modelArkApiKey()}`
        },
        body: JSON.stringify({
          model: modelArkModelId(),
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `${ANALYSIS_SYS}\n\nRespond with ONLY a JSON object matching this EXACT shape, with no extra wrapper objects:\n{\n  "hook": "How the opening grabs attention",\n  "phases": [{ "name": "Hook / Intro", "purpose": "Grab attention" }, { "name": "Body / Explanation", "purpose": "Deliver main content" }],\n  "pacing": "Cut rhythm and shot length feel",\n  "visualMix": "Balance of real footage vs graphics vs text",\n  "narrationDevices": ["Curiosity loop", "Fast-paced questions"],\n  "summary": "2-3 sentences summary of style"\n}`
            },
            {
              role: 'user',
              content: `${briefFor(youtubeUrl, goal)}${contextStr}\n\nReverse-engineer this video style and return the JSON object.`
            }
          ]
        }),
        signal: withTimeout(signal, METADATA_TIMEOUT_MS)
      })

      if (res.ok) {
        const data = (await res.json()) as {
          choices?: { message?: { content?: string | null } }[]
        }
        const content = data.choices?.[0]?.message?.content
        if (content) {
          const parsed = JSON.parse(content)
          const hook =
            parsed.hook ||
            parsed.referenceVideoCoreStyle?.hook ||
            'Fast-paced visual curiosity hook'
          const phases = Array.isArray(parsed.phases)
            ? parsed.phases
            : [
                { name: 'Hook', purpose: 'Grab viewer attention' },
                { name: 'Core Narrative', purpose: 'Deliver story with dynamic b-roll' },
                {
                  name: 'Climax & CTA',
                  purpose: 'Resolve hook and prompt engagement'
                }
              ]
          const pacing =
            parsed.pacing ||
            parsed.referenceVideoCoreStyle?.pacing ||
            'Fast 2-4s cuts'
          const visualMix =
            parsed.visualMix || 'Real footage & dynamic stills'
          const narrationDevices = Array.isArray(parsed.narrationDevices)
            ? parsed.narrationDevices
            : ['Curiosity loop', 'Retention hook']
          const summary =
            parsed.summary ||
            `Style template reverse-engineered from ${snippet?.title || youtubeUrl}.`

          return shape(
            { hook, phases, pacing, visualMix, narrationDevices, summary },
            'metadata',
            'modelark'
          )
        }
      }
    } catch (e) {
      console.warn('[VideoUnderstanding] ModelArk metadata pass failed:', e)
    }
  }

  const { model, provider } = pickVisionModel()
  const contextStr = snippet
    ? `\nYouTube Video Title: ${snippet.title || 'Unknown'}\nYouTube Video Description:\n${(snippet.description || '').slice(0, 1500)}\nTags: ${snippet.tags?.join(', ') || 'none'}`
    : ''

  const { object } = await generateObject({
    model,
    schema: analysisSchema,
    system: ANALYSIS_SYS,
    prompt: `${briefFor(youtubeUrl, goal)}${contextStr}\n\nAnalyze the reference video from its title, description, and metadata. Describe the most likely structure, hook, pacing, and visual mix for this style. Return your answer as a valid JSON object matching the schema.`,
    abortSignal: withTimeout(signal, METADATA_TIMEOUT_MS),
    maxRetries: 1
  })
  return shape(object, 'metadata', provider)
}

// --- Entry point ------------------------------------------------------------

// Analyze a reference video. Gemini watches it natively when the URL is a YouTube link;
// otherwise we fall back to pre-extracted frames, then to metadata-only reasoning.
export async function analyzeVideo(
  youtubeUrl: string,
  opts: { goal?: string; signal?: AbortSignal } = {}
): Promise<VideoAnalysis> {
  const { goal, signal } = opts
  const canonical = canonicalYouTubeUrl(youtubeUrl)

  if (canonical) {
    if (modelArkApiKey()) {
      try {
        return await analyzeWithModelArkVideo(canonical, goal, signal)
      } catch (error) {
        if (signal?.aborted) throw error
        console.warn(
          '[VideoUnderstanding] ModelArk native video pass failed, trying Gemini:',
          error
        )
      }
    }
    if (geminiApiKey()) {
      try {
        return await analyzeWithGeminiVideo(canonical, goal, signal)
      } catch (error) {
        if (signal?.aborted) throw error
        console.warn(
          '[VideoUnderstanding] Gemini native video pass failed, trying frames:',
          error
        )
      }
    }
  } else {
    console.warn(
      `[VideoUnderstanding] ${youtubeUrl} is not a YouTube URL Gemini can open directly.`
    )
  }

  if (process.env.WATCH_SERVICE_URL) {
    try {
      return await analyzeWithFrames(youtubeUrl, goal, signal)
    } catch (error) {
      if (signal?.aborted) throw error
      console.warn(
        '[VideoUnderstanding] Frame extraction failed, falling back to metadata:',
        error
      )
    }
  }

  return analyzeFromMetadata(youtubeUrl, goal, signal)
}
