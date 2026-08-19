export interface MediaWindow {
  start: number
  end: number
}

export interface SelectedVideoSegment extends MediaWindow {
  reason: string
}

export interface SelectRelevantVideoSegmentInput {
  narration: string
  visualIntent: string
  minimumDuration: number
  sourceDuration: number
  videoUrl: string
  mimeType?: string
  signal?: AbortSignal
}

const MODELARK_DEFAULT_VIDEO_MODEL = 'seed-2-0-pro-260328'

function modelArkBaseURL(): string {
  return (
    process.env.MODELARK_BASE_URL ||
    'https://ark.ap-southeast.bytepluses.com/api/v3'
  ).replace(/\/+$/, '')
}

function modelArkModelId(): string {
  return process.env.LEARN_VIDEO_MODELARK_MODEL || MODELARK_DEFAULT_VIDEO_MODEL
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`)
  }
  return value
}

export function parseTimestampSeconds(value: unknown): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('timestamp must be finite')
    return value
  }
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('timestamp must be seconds or HH:MM:SS')
  }

  const timestamp = value.trim()
  if (/^-?\d+(?:\.\d+)?$/u.test(timestamp)) {
    const seconds = Number(timestamp)
    if (Number.isFinite(seconds)) return seconds
  }

  const parts = timestamp.split(':')
  if (parts.length !== 2 && parts.length !== 3) {
    throw new Error(`invalid timestamp: ${timestamp}`)
  }
  if (!parts.every(part => /^\d+(?:\.\d+)?$/u.test(part))) {
    throw new Error(`invalid timestamp: ${timestamp}`)
  }

  const values = parts.map(Number)
  const seconds = values.at(-1)!
  const minutes = values.at(-2)!
  const hours = values.length === 3 ? values[0] : 0
  if (
    seconds >= 60 ||
    minutes >= 60 ||
    ![seconds, minutes, hours].every(Number.isFinite)
  ) {
    throw new Error(`invalid timestamp: ${timestamp}`)
  }
  return hours * 3600 + minutes * 60 + seconds
}

export function isResolvedMp4Input(
  videoUrl: string,
  mimeType?: string
): boolean {
  if (mimeType?.trim()) {
    const normalizedMime = mimeType.split(';', 1)[0].trim().toLowerCase()
    return (
      normalizedMime === 'video/mp4' || normalizedMime === 'application/mp4'
    )
  }
  try {
    const url = new URL(videoUrl)
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      /\.mp4$/iu.test(url.pathname)
    )
  } catch {
    return false
  }
}

export function validateMediaWindow({
  start,
  end,
  minimumDuration,
  sourceDuration,
  clampToSource = true
}: {
  start: unknown
  end: unknown
  minimumDuration: number
  sourceDuration?: number
  clampToSource?: boolean
}): MediaWindow {
  const parsedStart = parseTimestampSeconds(start)
  const parsedEnd = parseTimestampSeconds(end)
  const minimum = finiteNumber(minimumDuration, 'minimumDuration')
  if (minimum <= 0) throw new Error('minimumDuration must be greater than 0')

  let sourceEnd = Number.POSITIVE_INFINITY
  if (sourceDuration !== undefined) {
    sourceEnd = finiteNumber(sourceDuration, 'sourceDuration')
    if (sourceEnd <= 0) throw new Error('sourceDuration must be greater than 0')
    if (minimum > sourceEnd) {
      throw new Error(
        `Source duration ${sourceEnd} seconds is shorter than the required ${minimum} seconds`
      )
    }
    if (!clampToSource && parsedStart > sourceEnd) {
      throw new Error(`Source in point cannot exceed ${sourceEnd} seconds`)
    }
    if (!clampToSource && parsedEnd > sourceEnd) {
      throw new Error(`Source out point cannot exceed ${sourceEnd} seconds`)
    }
  }

  const clampedStart = clampToSource
    ? Math.min(sourceEnd, Math.max(0, parsedStart))
    : Math.max(0, parsedStart)
  const clampedEnd = clampToSource
    ? Math.min(sourceEnd, Math.max(0, parsedEnd))
    : Math.max(0, parsedEnd)
  if (clampedEnd <= clampedStart) {
    throw new Error('Source out point must be greater than the in point')
  }
  if (clampedEnd - clampedStart < minimum) {
    throw new Error(`Source window must be at least ${minimum} seconds`)
  }

  return { start: clampedStart, end: clampedEnd }
}

export function parseVideoSegmentSelection(
  output: unknown,
  constraints: { minimumDuration: number; sourceDuration: number }
): SelectedVideoSegment {
  try {
    const parsed =
      typeof output === 'string' ? (JSON.parse(output) as unknown) : output
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('response must be a JSON object')
    }
    const candidate = parsed as Record<string, unknown>
    if (typeof candidate.reason !== 'string' || !candidate.reason.trim()) {
      throw new Error('reason must be a non-empty string')
    }
    const window = validateMediaWindow({
      start: candidate.start,
      end: candidate.end,
      minimumDuration: constraints.minimumDuration,
      sourceDuration: constraints.sourceDuration
    })
    return { ...window, reason: candidate.reason.trim() }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`ModelArk segment selection is invalid: ${message}`)
  }
}

export async function selectRelevantVideoSegment({
  narration,
  visualIntent,
  minimumDuration,
  sourceDuration,
  videoUrl,
  mimeType,
  signal
}: SelectRelevantVideoSegmentInput): Promise<SelectedVideoSegment> {
  const apiKey = process.env.MODELARK_API_KEY || ''
  if (!apiKey) {
    throw new Error(
      'ModelArk is not configured — set MODELARK_API_KEY to select a video segment.'
    )
  }
  if (!narration.trim()) throw new Error('Narration is required')
  if (!visualIntent.trim()) throw new Error('Visual intent is required')
  if (!isResolvedMp4Input(videoUrl, mimeType)) {
    throw new Error('Video segment selection requires a resolved MP4 input')
  }
  finiteNumber(minimumDuration, 'minimumDuration')
  finiteNumber(sourceDuration, 'sourceDuration')
  if (minimumDuration <= 0 || sourceDuration <= 0) {
    throw new Error('Video durations must be greater than 0')
  }
  if (minimumDuration > sourceDuration) {
    throw new Error('The source video is shorter than the storyboard shot')
  }

  const prompt = [
    `Narration: ${narration.trim()}`,
    `Visual intent: ${visualIntent.trim()}`,
    `Source duration: ${sourceDuration} seconds`,
    `Required minimum continuous window: ${minimumDuration} seconds`,
    'Watch the resolved MP4 and choose the strongest single continuous section that supports both the narration and visual intent.',
    'Return source timestamps, not storyboard timeline timestamps.'
  ].join('\n')

  const response = await fetch(`${modelArkBaseURL()}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelArkModelId(),
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Select one continuous source-video window. Respond with ONLY JSON matching {"start": number|string, "end": number|string, "reason": string}. Do not use markdown fences.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'video_url', video_url: { url: videoUrl } }
          ]
        }
      ]
    }),
    signal
  })

  if (!response.ok) {
    throw new Error(
      `ModelArk HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`
    )
  }
  const data = (await response.json()) as {
    choices?: { message?: { content?: string | null } }[]
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('ModelArk returned no segment selection')

  return parseVideoSegmentSelection(content, {
    minimumDuration,
    sourceDuration
  })
}
