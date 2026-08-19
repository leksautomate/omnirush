// Kakkao engine — image generation via ModelArk (Seedream). Direct synchronous REST:
// POST /images/generations returns the image URL in the response body when
// response_format is "url" and stream is false — no task polling involved. That URL is
// a short-lived presigned link (not permanent hosting), so we immediately fetch the
// bytes and rehost them to our own storage — the same durability move already applied
// to TTS audio in lib/engine/voice.ts. Without this, the link expires before the
// storyboard is ever rendered/viewed, leaving a black gap where the shot used to be.
import { kvGetJSON, kvSetJSON } from '@/lib/engine/kv'
import { hostGeneratedBytes } from '@/lib/storage/host-bytes'

export interface ImageResult {
  imageUrl: string
  model: string
  width?: number
  height?: number
  /** The model's revised/expanded prompt, when returned. */
  revisedPrompt?: string
}

export const MODELARK_DEFAULT_IMAGE_MODEL =
  process.env.MODELARK_IMAGE_MODEL || 'seedream-5-0-260128'
export const MODELARK_DEFAULT_THUMBNAIL_MODEL =
  process.env.MODELARK_THUMBNAIL_MODEL || MODELARK_DEFAULT_IMAGE_MODEL

// Ark caps each model at 99 generations/day per account. Track usage ourselves so a
// spent quota fails with a clear message instead of surfacing as a raw 429 mid-storyboard.
const MODELARK_DAILY_IMAGE_QUOTA = 99

function modelArkApiKey(): string {
  return process.env.MODELARK_API_KEY || ''
}

function modelArkBaseURL(): string {
  return (
    process.env.MODELARK_BASE_URL || 'https://ark.ap-southeast.bytepluses.com/api/v3'
  ).replace(/\/+$/, '')
}

function secondsUntilMidnightUTC(): number {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setUTCHours(24, 0, 0, 0)
  return Math.max(1, Math.floor((midnight.getTime() - now.getTime()) / 1000))
}

async function bumpModelArkImageQuota(model: string): Promise<void> {
  const dateKey = new Date().toISOString().split('T')[0]
  const key = `modelark:img-quota:${model}:${dateKey}`
  const used = (await kvGetJSON<number>(key)) || 0
  if (used >= MODELARK_DAILY_IMAGE_QUOTA) {
    throw new Error(
      `ModelArk daily image quota reached for "${model}" (${MODELARK_DAILY_IMAGE_QUOTA}/day). Resets at midnight UTC.`
    )
  }
  // Best-effort counter (get-then-set, not atomic) — fine for a soft daily cap; worst
  // case a couple of concurrent requests slip through right at the boundary.
  await kvSetJSON(key, used + 1, secondsUntilMidnightUTC() + 3600)
}

export interface GenerateImageModelArkOptions {
  /** Ark Seedream model id. Defaults to MODELARK_IMAGE_MODEL / seedream-5-0-260128. */
  model?: string
  /** Reference image URL(s) for image-to-image edits/conditioning. */
  referenceImages?: string[]
  /** Ark size tier, e.g. "1K" / "2K" / "4K". Defaults to "2K". */
  size?: string
  abortSignal?: AbortSignal
}

// Generate a single image via ModelArk's Seedream API.
export async function generateImageModelArk(
  prompt: string,
  opts: GenerateImageModelArkOptions = {}
): Promise<ImageResult> {
  const apiKey = modelArkApiKey()
  if (!apiKey) throw new Error('MODELARK_API_KEY is not set')
  const clean = (prompt || '').trim()
  if (!clean) throw new Error('no image prompt')
  const model = opts.model || MODELARK_DEFAULT_IMAGE_MODEL

  await bumpModelArkImageQuota(model)

  const refs = (opts.referenceImages || []).filter(Boolean)
  const body: Record<string, unknown> = {
    model,
    prompt: clean,
    response_format: 'url',
    size: opts.size || '2K',
    stream: false,
    watermark: false,
    // Always a single image — the multi-image ("auto"/max_images) mode is a separate
    // feature this tool doesn't expose.
    sequential_image_generation: 'disabled'
  }
  if (refs.length) {
    body.image = refs
  }

  const res = await fetch(`${modelArkBaseURL()}/images/generations`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal: opts.abortSignal
  })

  if (!res.ok) {
    throw new Error(
      `ModelArk image HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`
    )
  }

  const data = (await res.json()) as {
    data?: { url?: string; revised_prompt?: string }[]
  }
  const first = data.data?.[0]
  if (!first?.url) {
    throw new Error('ModelArk image generation returned no image URL')
  }

  const imageUrl = await rehostImageUrl(first.url, model)

  return {
    imageUrl,
    model,
    revisedPrompt: first.revised_prompt
  }
}

// Fetch the (short-lived) ModelArk image and rehost the bytes durably. Falls back to
// the original URL if the fetch itself fails — better a shot that works until the
// original link expires than a hard failure for the whole storyboard step.
async function rehostImageUrl(sourceUrl: string, model: string): Promise<string> {
  try {
    const res = await fetch(sourceUrl)
    if (!res.ok) throw new Error(`fetch HTTP ${res.status}`)
    const contentType = res.headers.get('content-type')?.split(';')[0] || 'image/png'
    const ext = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1] || 'png'
    const bytes = Buffer.from(await res.arrayBuffer())

    return await hostGeneratedBytes(bytes, {
      r2KeyPrefix: 'images',
      localSubdir: 'images',
      filename: `${model}-${Date.now()}.${ext}`,
      contentType
    })
  } catch (err) {
    console.warn(
      '[image] Failed to rehost ModelArk image, using the (short-lived) original URL:',
      err
    )
    return sourceUrl
  }
}
