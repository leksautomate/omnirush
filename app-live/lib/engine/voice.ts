// Kakkao engine — voiceover (TTS) via Speechify's streaming-with-timestamps endpoint
// (/v1/audio/stream/with-timestamps). Unlike the basic /v1/audio/speech call this replaced,
// it returns real per-word speech marks alongside the audio, which is what lets captions
// lock to the actual synthesized speech instead of a flat words-per-minute estimate — the
// estimate is still there as a fallback for the legacy simba-english/simba-multilingual
// models, which don't support this route. The endpoint returns Base64-encoded audio (not a
// hosted URL either), so we still host the bytes ourselves (R2/S3, else a local public/
// file in dev, else a data: URI as a last resort).

import { hostGeneratedBytes } from '@/lib/storage/host-bytes'

export interface VoiceWord {
  word: string
  start: number
  end: number
}

export interface VoiceResult {
  audioUrl: string
  words: VoiceWord[]
  durationSec: number
  voiceId: string
}

// Group character-level alignment into word timings (for providers that return
// per-character rather than per-word alignment). A word runs from its first non-space
// character's start to its last one's end; runs are delimited by whitespace. Kept for
// bindVoiceTimings (lib/engine/beats.ts) — provider-agnostic, not tied to any one TTS
// backend's response shape.
export function groupCharsIntoWords(
  characters: string[],
  starts: number[],
  ends: number[]
): VoiceWord[] {
  const words: VoiceWord[] = []
  let buf = ''
  let wStart = 0
  let wEnd = 0
  let open = false
  const flush = () => {
    if (open && buf.trim()) words.push({ word: buf, start: wStart, end: wEnd })
    buf = ''
    open = false
  }
  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i]
    if (/\s/.test(ch)) {
      flush()
      continue
    }
    if (!open) {
      wStart = starts[i] ?? wEnd
      open = true
    }
    buf += ch
    wEnd = ends[i] ?? wStart
  }
  flush()
  return words
}

const SPEECHIFY_DEFAULT_BASE = 'https://api.speechify.ai'
const SPEECHIFY_DEFAULT_MODEL = process.env.SPEECHIFY_MODEL || 'simba-3.0'
// Typical narration pace, used only to estimate duration since Speechify's basic
// response doesn't include one.
const NARRATION_WORDS_PER_MINUTE = 165

function speechifyApiKey(): string {
  return process.env.SPEECHIFY_API_KEY || ''
}

// Host TTS audio bytes for real — R2/S3 if configured, else a local public/ file when
// running locally (not a real cloud deployment), else a data: URI as a last resort
// (works for the in-chat Studio preview only; large narrations may be too big to
// play/download reliably this way).
async function hostTtsAudioBytes(bytes: Buffer, keyHint: string): Promise<string> {
  return hostGeneratedBytes(bytes, {
    r2KeyPrefix: 'tts',
    localSubdir: 'audio',
    filename: `${keyHint}-${Date.now()}.mp3`,
    contentType: 'audio/mpeg'
  })
}

// Every Speechify response is independently encoded (via their own ffmpeg/libavformat
// backend) and carries its own leading ID3v2 tag. Concatenating chunks naively leaves
// that tag sitting mid-stream in the merged file, which a decoder reads where it expects
// an MPEG frame sync word — "Header missing" / corrupted playback right at the seam.
// Stripping the tag from every chunk but the first fixes it (verified via ffmpeg decode).
export function stripLeadingId3v2Tag(buf: Buffer): Buffer {
  if (buf.length < 10 || buf.toString('ascii', 0, 3) !== 'ID3') return buf
  // ID3v2 header: 3 bytes "ID3", 2 bytes version, 1 byte flags, 4 bytes synchsafe size
  // (7 significant bits per byte) — the tag body follows immediately after this header.
  const size =
    ((buf[6] & 0x7f) << 21) |
    ((buf[7] & 0x7f) << 14) |
    ((buf[8] & 0x7f) << 7) |
    (buf[9] & 0x7f)
  return buf.subarray(10 + size)
}

function concatMp3Chunks(buffers: Buffer[]): Buffer {
  return Buffer.concat(
    buffers.map((buf, i) => (i === 0 ? buf : stripLeadingId3v2Tag(buf)))
  )
}

// Speechify rejects input over ~2000 characters. Scripts of any real narration length
// exceed that easily, and trimming/rewriting the script to fit isn't acceptable — it's
// content the user wrote deliberately. Split on sentence boundaries instead, voice each
// chunk separately, and concatenate the resulting MP3 bytes into one file. Plain
// concatenation of MP3 frames from the same encoder/voice/bitrate plays back fine in
// practice; it's not a byte-perfect re-mux, but there's no ffmpeg in this pipeline and
// none is needed for consistent same-source TTS chunks.
const SPEECHIFY_MAX_CHARS = 1900 // margin under the documented ~2000-char limit

export function splitIntoTtsChunks(text: string, maxChars = SPEECHIFY_MAX_CHARS): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [text]
  const chunks: string[] = []
  let current = ''

  const pushCurrent = () => {
    if (current.trim()) chunks.push(current.trim())
    current = ''
  }

  for (let sentence of sentences) {
    // A single sentence longer than the whole limit: hard-split on word boundaries so
    // no chunk ever exceeds maxChars, even if it means splitting mid-sentence.
    while (sentence.length > maxChars) {
      let cut = sentence.lastIndexOf(' ', maxChars)
      if (cut <= 0) cut = maxChars
      const piece = sentence.slice(0, cut)
      if (current.length + piece.length > maxChars) pushCurrent()
      current += piece
      pushCurrent()
      sentence = sentence.slice(cut).trimStart()
    }
    if (current.length + sentence.length > maxChars && current.length > 0) {
      pushCurrent()
    }
    current += sentence
  }
  pushCurrent()
  return chunks
}

// Legacy Simba 1.6 models return 400 speech_marks_unsupported on the timestamped route.
const MODELS_WITHOUT_TIMESTAMPS = new Set(['simba-english', 'simba-multilingual'])

interface SpeechifyMark {
  word: string
  startMs: number
  endMs: number
}

// A raw Speechify speech mark, before realignment to our own tokenization. `charStart`/
// `charEnd` are offsets into the INPUT TEXT of this request — see alignMarksToTokens.
interface RawSpeechifyMark {
  value: string
  charStart: number
  charEnd: number
  startMs: number
  endMs: number
}

interface SpeechifyChunkResult {
  audio: Buffer
  marks: SpeechifyMark[]
}

// Speechify's own word segmentation doesn't reliably match `text.split(/\s+/)`, the
// tokenization bindVoiceTimings (beats.ts) uses to partition marks onto shots 1:1 — two
// opposite failure modes observed live:
//   - UNDER-segmentation: a compound number like "nineteen forty-four" arrives as ONE
//     mark spanning two whitespace tokens.
//   - OVER-segmentation: a hyphenated word like "wood-and-canvas" arrives as FIVE marks
//     ("wood", "-", "and", "-", "canvas" — Speechify treats the hyphen as a word
//     boundary and emits it as its own mark).
// Either way, a naive 1:1 zip silently shifts every following shot's captions. Instead,
// rebuild one mark per actual whitespace token in the original text, using Speechify's
// character offsets (not the mark text) to decide which raw mark(s) belong to which
// token: a token's timing is the min/max start/end of every raw mark whose character
// range overlaps it. Tokens that share a single raw mark (the merge case) split that
// mark's span by character-length weight, matching beats.ts' timeWords() convention for
// estimated timing.
function alignMarksToTokens(
  text: string,
  rawMarks: RawSpeechifyMark[]
): SpeechifyMark[] {
  const tokens: { start: number; end: number; value: string }[] = []
  const tokenRe = /\S+/g
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(text))) {
    tokens.push({ start: m.index, end: m.index + m[0].length, value: m[0] })
  }
  if (!tokens.length) return []

  const result: SpeechifyMark[] = new Array(tokens.length)
  let lastEndMs = 0
  let i = 0
  while (i < tokens.length) {
    const overlapping = rawMarks.filter(
      rm => rm.charStart < tokens[i].end && rm.charEnd > tokens[i].start
    )
    if (!overlapping.length) {
      // No TTS mark touched this token's character range (rare — e.g. a token that's
      // pure punctuation Speechify doesn't voice at all). Zero-width at the running
      // cursor rather than dropping it, so shot partitioning still sees one entry per
      // whitespace token.
      result[i] = { word: tokens[i].value, startMs: lastEndMs, endMs: lastEndMs }
      i++
      continue
    }
    // How many consecutive tokens does this same raw-mark group cover? (The merge
    // case: one raw mark's character range spans multiple tokens.) Group them so their
    // shared span can be split proportionally instead of duplicated onto each token.
    let groupEnd = i + 1
    while (
      groupEnd < tokens.length &&
      rawMarks.some(
        rm =>
          rm.charStart < tokens[groupEnd].end &&
          rm.charEnd > tokens[groupEnd].start &&
          overlapping.includes(rm)
      )
    ) {
      groupEnd++
    }
    const startMs = Math.min(...overlapping.map(o => o.startMs))
    const endMs = Math.max(...overlapping.map(o => o.endMs))
    const groupSize = groupEnd - i
    if (groupSize === 1) {
      result[i] = { word: tokens[i].value, startMs, endMs }
    } else {
      const span = endMs - startMs
      const weights = tokens
        .slice(i, groupEnd)
        .map(t => Math.max(1, t.value.replace(/[^a-z0-9]/gi, '').length))
      const total = weights.reduce((a, b) => a + b, 0)
      let t = startMs
      for (let k = 0; k < groupSize; k++) {
        const d = (weights[k] / total) * span
        const start = t
        t += d
        result[i + k] = {
          word: tokens[i + k].value,
          startMs: Math.round(start),
          endMs: Math.round(t)
        }
      }
    }
    lastEndMs = endMs
    i = groupEnd
  }
  return result
}

// Parse Speechify's SSE stream: a run of `speech.chunk` events (each carrying a
// Base64 audio run, finalized speech marks, or both) followed by a terminal
// `speech.done`. Marks' start_time/end_time are absolute milliseconds from the start of
// this stream's synthesis — the caller offsets them onto the merged multi-chunk timeline.
async function parseSpeechifySseStream(
  body: ReadableStream<Uint8Array>
): Promise<{ audio: Buffer; marks: RawSpeechifyMark[] }> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const audioParts: Buffer[] = []
  const marks: RawSpeechifyMark[] = []
  let buffer = ''
  let done = false

  const handleEvent = (block: string) => {
    let eventType = 'message'
    const dataLines: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) eventType = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
    }
    if (!dataLines.length) return
    const payload = JSON.parse(dataLines.join('\n'))

    if (eventType === 'speech.error') {
      throw new Error(
        `Speechify stream error: ${payload.message || JSON.stringify(payload)}`
      )
    }
    if (eventType === 'speech.done') {
      done = true
      return
    }
    // speech.chunk (and any event type we don't recognize but that carries the same
    // shape) — ignore unrecognized event types per the API's own forward-compat guidance.
    if (payload.audio) audioParts.push(Buffer.from(payload.audio, 'base64'))
    if (Array.isArray(payload.speech_marks)) {
      for (const mark of payload.speech_marks) {
        if (mark.type !== 'word') continue
        marks.push({
          value: String(mark.value ?? ''),
          charStart: Number(mark.start) || 0,
          charEnd: Number(mark.end) || 0,
          startMs: Number(mark.start_time) || 0,
          endMs: Number(mark.end_time) || 0
        })
      }
    }
  }

  while (!done) {
    const { value, done: streamDone } = await reader.read()
    if (streamDone) break
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() || ''
    for (const block of blocks) {
      if (block.trim()) handleEvent(block)
      if (done) break
    }
  }
  // The stream can close without a trailing blank line after the final event, leaving
  // it unflushed in buffer — process it rather than silently dropping the last chunk.
  if (!done && buffer.trim()) handleEvent(buffer)

  return { audio: Buffer.concat(audioParts), marks }
}

async function speechifyStreamChunk(
  text: string,
  opts: {
    apiKey: string
    base: string
    voiceId: string
    model: string
    abortSignal?: AbortSignal
  }
): Promise<SpeechifyChunkResult> {
  const res = await fetch(`${opts.base}/v1/audio/stream/with-timestamps`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${opts.apiKey}`,
      'content-type': 'application/json',
      accept: 'audio/mpeg'
    },
    body: JSON.stringify({
      input: text,
      voice_id: opts.voiceId,
      model: opts.model,
      options: { text_normalization: true }
    }),
    signal: opts.abortSignal
  })

  if (!res.ok || !res.body) {
    throw new Error(
      `Speechify HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`
    )
  }

  const { audio, marks } = await parseSpeechifySseStream(res.body)
  return { audio, marks: alignMarksToTokens(text, marks) }
}

// Generate a voiceover via Speechify, chunking the script as needed to stay under
// Speechify's per-request character limit without altering the script's content.
export async function generateVoiceoverSpeechify(
  text: string,
  opts: {
    apiKey?: string
    baseUrl?: string
    voiceId?: string
    model?: string
    abortSignal?: AbortSignal
  } = {}
): Promise<VoiceResult> {
  const apiKey = opts.apiKey || speechifyApiKey()
  if (!apiKey) throw new Error('SPEECHIFY_API_KEY is not set')
  const clean = (text || '').trim()
  if (!clean) throw new Error('no text to voice')
  const base = (
    opts.baseUrl ||
    process.env.SPEECHIFY_BASE_URL ||
    SPEECHIFY_DEFAULT_BASE
  ).replace(/\/+$/, '')
  const voiceId = opts.voiceId || process.env.SPEECHIFY_VOICE_ID || ''
  if (!voiceId) {
    throw new Error(
      'Speechify voice id is not set — pass voiceId or set SPEECHIFY_VOICE_ID'
    )
  }
  const model = opts.model || SPEECHIFY_DEFAULT_MODEL
  const supportsTimestamps = !MODELS_WITHOUT_TIMESTAMPS.has(model)

  const chunks = splitIntoTtsChunks(clean)

  if (!supportsTimestamps) {
    // Legacy Simba 1.6 models 400 on the timestamped route — fall back to the plain
    // /v1/audio/speech call and estimated (words-per-minute) timing, same as before.
    const buffers = await Promise.all(
      chunks.map(chunk =>
        speechifyRequestChunkNoTimestamps(chunk, {
          apiKey,
          base,
          voiceId,
          model,
          abortSignal: opts.abortSignal
        })
      )
    )
    const audioUrl = await hostTtsAudioBytes(concatMp3Chunks(buffers), voiceId)
    const wordCount = clean.split(/\s+/).filter(Boolean).length
    const durationSec = +(wordCount / (NARRATION_WORDS_PER_MINUTE / 60)).toFixed(2)
    return { audioUrl, words: [], durationSec, voiceId }
  }

  const results = await Promise.all(
    chunks.map(chunk =>
      speechifyStreamChunk(chunk, {
        apiKey,
        base,
        voiceId,
        model,
        abortSignal: opts.abortSignal
      })
    )
  )

  // Each chunk's speech marks are timestamped from zero (its own request's timeline).
  // Walk the chunks in order, offsetting each one's marks by the running total so far,
  // and converting Speechify's milliseconds to the seconds this engine uses throughout
  // (shot start/duration, VoiceWord — see beats.ts).
  const words: VoiceWord[] = []
  let offsetMs = 0
  for (const { marks } of results) {
    for (const mark of marks) {
      words.push({
        word: mark.word,
        start: +((offsetMs + mark.startMs) / 1000).toFixed(3),
        end: +((offsetMs + mark.endMs) / 1000).toFixed(3)
      })
    }
    // Approximate this chunk's audio duration as its last word's end — consistent with
    // how bindVoiceTimings (beats.ts) already treats "last word's end" as the audio end.
    const chunkDurationMs = marks.length ? marks[marks.length - 1].endMs : 0
    offsetMs += chunkDurationMs
  }

  const audioUrl = await hostTtsAudioBytes(
    concatMp3Chunks(results.map(r => r.audio)),
    voiceId
  )

  const durationSec = words.length
    ? words[words.length - 1].end
    : +(
        clean.split(/\s+/).filter(Boolean).length /
        (NARRATION_WORDS_PER_MINUTE / 60)
      ).toFixed(2)

  return { audioUrl, words, durationSec, voiceId }
}

async function speechifyRequestChunkNoTimestamps(
  text: string,
  opts: {
    apiKey: string
    base: string
    voiceId: string
    model: string
    abortSignal?: AbortSignal
  }
): Promise<Buffer> {
  const res = await fetch(`${opts.base}/v1/audio/speech`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${opts.apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      input: text,
      voice_id: opts.voiceId,
      model: opts.model,
      audio_format: 'mp3',
      options: { text_normalization: true }
    }),
    signal: opts.abortSignal
  })

  if (!res.ok) {
    throw new Error(
      `Speechify HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`
    )
  }

  const data = (await res.json()) as { audio_data?: string; audio_url?: string }
  if (data.audio_url) {
    const audioRes = await fetch(data.audio_url, { signal: opts.abortSignal })
    if (!audioRes.ok) throw new Error(`Speechify audio fetch HTTP ${audioRes.status}`)
    return Buffer.from(await audioRes.arrayBuffer())
  }
  if (!data.audio_data) throw new Error('Speechify returned no audio_data')
  return Buffer.from(data.audio_data, 'base64')
}
