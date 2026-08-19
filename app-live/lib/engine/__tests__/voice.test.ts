import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  generateVoiceoverSpeechify,
  splitIntoTtsChunks,
  stripLeadingId3v2Tag
} from '../voice'

// Builds a synthetic ID3v2 tag + body, matching what Speechify's ffmpeg-based encoder
// prefixes onto every response (real bytes observed: 49 44 33 03 00 00 00 00 00 23 ...).
function buildId3v2Buffer(tagBodyLength: number, audioBytes: Buffer): Buffer {
  const header = Buffer.alloc(10)
  header.write('ID3', 0, 'ascii')
  header[3] = 3 // version
  header[4] = 0 // revision
  header[5] = 0 // flags
  // Synchsafe size: 7 significant bits per byte.
  header[6] = (tagBodyLength >> 21) & 0x7f
  header[7] = (tagBodyLength >> 14) & 0x7f
  header[8] = (tagBodyLength >> 7) & 0x7f
  header[9] = tagBodyLength & 0x7f
  const body = Buffer.alloc(tagBodyLength, 0xab)
  return Buffer.concat([header, body, audioBytes])
}

const hostGeneratedBytes = vi.hoisted(() =>
  vi.fn(async () => 'https://cdn.example.com/tts/test.mp3')
)
vi.mock('@/lib/storage/host-bytes', () => ({ hostGeneratedBytes }))

function sseResponse(events: Array<{ event: string; data: unknown }>): Response {
  const text = events
    .map(e => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
    .join('')
  return new Response(text, { status: 200 })
}

// Regression coverage for a real production bug: generateVoiceoverSpeechify used to
// always return words: [] (the plain /v1/audio/speech call has no timing data), so
// every caption was locked to a flat words-per-minute estimate instead of the actual
// synthesized speech — the reported "captions don't line up" symptom. It now streams
// /v1/audio/stream/with-timestamps and uses the real per-word speech marks.
describe('generateVoiceoverSpeechify (timestamped streaming)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    hostGeneratedBytes.mockClear()
  })

  it('converts Speechify speech marks (ms) into VoiceWord timings in seconds', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      sseResponse([
        {
          event: 'speech.chunk',
          data: {
            audio: Buffer.from('audio-bytes').toString('base64'),
            speech_marks: [
              { type: 'word', start: 0, end: 5, start_time: 0, end_time: 400, value: 'Hello' },
              { type: 'word', start: 6, end: 11, start_time: 400, end_time: 900, value: 'world' }
            ]
          }
        },
        { event: 'speech.done', data: {} }
      ])
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateVoiceoverSpeechify('Hello world', {
      apiKey: 'test-key',
      voiceId: 'voice-1'
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/audio/stream/with-timestamps'),
      expect.anything()
    )
    expect(result.words).toEqual([
      { word: 'Hello', start: 0, end: 0.4 },
      { word: 'world', start: 0.4, end: 0.9 }
    ])
    // durationSec should come from the real last-word end, not the WPM estimate.
    expect(result.durationSec).toBe(0.9)
  })

  it('splits a mark whose value spans multiple tokens instead of losing shot alignment', async () => {
    // Regression coverage for a real production bug: Speechify emitted a compound
    // number ("nineteen forty-four") as ONE mark instead of two. bindVoiceTimings
    // (beats.ts) partitions marks onto shots by counting whitespace tokens 1:1, so an
    // unsplit multi-word mark silently shifted every following shot's captions by one
    // word — confirmed live against a real "June sixth, nineteen forty-four." shot.
    const fetchMock = vi.fn().mockResolvedValueOnce(
      sseResponse([
        {
          event: 'speech.chunk',
          data: {
            audio: Buffer.from('a').toString('base64'),
            speech_marks: [
              { type: 'word', start: 0, end: 4, start_time: 0, end_time: 400, value: 'June' },
              {
                type: 'word',
                start: 5,
                end: 25,
                start_time: 400,
                end_time: 2000,
                value: 'nineteen forty-four'
              },
              { type: 'word', start: 26, end: 29, start_time: 2000, end_time: 2200, value: 'The' }
            ]
          }
        },
        { event: 'speech.done', data: {} }
      ])
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateVoiceoverSpeechify('June nineteen forty-four The', {
      apiKey: 'test-key',
      voiceId: 'voice-1'
    })

    // 4 words in, 4 VoiceWord entries out — not 3 (which would drop "The" onto the
    // wrong shot downstream).
    expect(result.words.map(w => w.word)).toEqual([
      'June',
      'nineteen',
      'forty-four',
      'The'
    ])
    expect(result.words[0]).toEqual({ word: 'June', start: 0, end: 0.4 })
    expect(result.words[3]).toEqual({ word: 'The', start: 2, end: 2.2 })
    // The split portion (nineteen / forty-four) stays within the original mark's span.
    expect(result.words[1].start).toBe(0.4)
    expect(result.words[2].end).toBe(2)
    expect(result.words[1].end).toBe(result.words[2].start)
  })

  it('merges marks Speechify over-segments at a hyphen back into one token', async () => {
    // Regression coverage for a second real production bug, the mirror image of the
    // one above: Speechify treats hyphens as word boundaries and emits the hyphen
    // itself as its own `word`-type mark — "wood-and-canvas" (ONE whitespace token)
    // came back as FIVE marks: "wood", "-", "and", "-", "canvas". Without realigning to
    // the original text's character offsets, that's 5 VoiceWords for 1 narration token,
    // again shifting every later shot's captions — confirmed live via the real API.
    const text = 'They flew wood-and-canvas crop dusters.'
    const fetchMock = vi.fn().mockResolvedValueOnce(
      sseResponse([
        {
          event: 'speech.chunk',
          data: {
            audio: Buffer.from('a').toString('base64'),
            speech_marks: [
              { type: 'word', start: 0, end: 4, start_time: 0, end_time: 341, value: 'They' },
              { type: 'word', start: 5, end: 9, start_time: 341, end_time: 683, value: 'flew' },
              { type: 'word', start: 10, end: 14, start_time: 683, end_time: 853, value: 'wood' },
              { type: 'word', start: 14, end: 15, start_time: 853, end_time: 896, value: '-' },
              { type: 'word', start: 15, end: 18, start_time: 896, end_time: 939, value: 'and' },
              { type: 'word', start: 18, end: 19, start_time: 939, end_time: 1109, value: '-' },
              { type: 'word', start: 19, end: 25, start_time: 1109, end_time: 1579, value: 'canvas' },
              { type: 'word', start: 26, end: 30, start_time: 1579, end_time: 1835, value: 'crop' },
              { type: 'word', start: 31, end: 39, start_time: 1835, end_time: 2200, value: 'dusters.' }
            ]
          }
        },
        { event: 'speech.done', data: {} }
      ])
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateVoiceoverSpeechify(text, {
      apiKey: 'test-key',
      voiceId: 'voice-1'
    })

    // 5 whitespace tokens in, 5 VoiceWord entries out — not the 9 raw marks Speechify sent.
    expect(result.words.map(w => w.word)).toEqual([
      'They',
      'flew',
      'wood-and-canvas',
      'crop',
      'dusters.'
    ])
    // The merged token spans from the first sub-mark's start to the last's end.
    expect(result.words[2]).toEqual({ word: 'wood-and-canvas', start: 0.683, end: 1.579 })
  })

  // One mark per whitespace token in `text`, sequential 100ms-per-token timing — a
  // realistic full-coverage fixture (unlike hand-picking one or two marks, which leaves
  // alignMarksToTokens with no mark for most of a long chunk's tokens).
  function marksForAllTokens(text: string, msPerToken = 100) {
    const tokens = text.split(/\s+/).filter(Boolean)
    let cursor = 0
    const marks = tokens.map(value => {
      const start = text.indexOf(value, cursor)
      cursor = start + value.length
      return { type: 'word', start, end: cursor, start_time: 0, end_time: 0, value }
    })
    let t = 0
    for (const mark of marks) {
      mark.start_time = t
      t += msPerToken
      mark.end_time = t
    }
    return marks
  }

  it('offsets word timings across multiple chunks onto one continuous timeline', async () => {
    // No sentence punctuation, so splitIntoTtsChunks treats this as one long run and
    // hard-splits it on a word boundary once it crosses the ~1900-char limit —
    // deterministically 2 chunks, with "One" at the very start and "Two" at the very end.
    const longText = 'One ' + 'x '.repeat(1000) + 'Two'
    const chunks = splitIntoTtsChunks(longText)
    expect(chunks).toHaveLength(2)

    const fetchMock = vi.fn()
    for (const chunk of chunks) {
      fetchMock.mockResolvedValueOnce(
        sseResponse([
          {
            event: 'speech.chunk',
            data: { audio: Buffer.from('a').toString('base64'), speech_marks: marksForAllTokens(chunk) }
          },
          { event: 'speech.done', data: {} }
        ])
      )
    }
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateVoiceoverSpeechify(longText, {
      apiKey: 'test-key',
      voiceId: 'voice-1'
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    // One VoiceWord per whitespace token in the ORIGINAL text — no words dropped or
    // duplicated at the chunk boundary.
    expect(result.words).toHaveLength(longText.split(/\s+/).filter(Boolean).length)
    expect(result.words[0].word).toBe('One')
    expect(result.words[0].start).toBe(0)
    expect(result.words[result.words.length - 1].word).toBe('Two')
    // Strictly non-decreasing across the whole merged timeline — chunk 2's marks must
    // be offset onto chunk 1's duration, not restart from zero.
    for (let i = 1; i < result.words.length; i++) {
      expect(result.words[i].start).toBeGreaterThanOrEqual(result.words[i - 1].start)
    }
    // The chunk-1/chunk-2 boundary word actually jumps forward (proves the offset was
    // applied, not just that per-chunk timing happened to already be monotonic).
    const chunk1TokenCount = chunks[0].split(/\s+/).filter(Boolean).length
    expect(result.words[chunk1TokenCount].start).toBeGreaterThan(
      result.words[chunk1TokenCount - 1].start
    )
  })
})

describe('splitIntoTtsChunks', () => {
  it('keeps a short script as a single chunk', () => {
    const text = 'A short narration. Two sentences here.'
    expect(splitIntoTtsChunks(text, 1900)).toEqual([text])
  })

  it('splits a long script on sentence boundaries without dropping content', () => {
    const sentence = 'This is a sentence about Roman history. '
    const text = sentence.repeat(80) // well over 1900 chars
    const chunks = splitIntoTtsChunks(text, 1900)

    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1900)
    }
    // No sentence content lost or altered by chunking.
    expect(chunks.join(' ').replace(/\s+/g, ' ').trim()).toBe(
      text.replace(/\s+/g, ' ').trim()
    )
  })

  it('hard-splits a single sentence longer than the limit on a word boundary', () => {
    const text = 'word '.repeat(500).trim() + '.' // one long run, no sentence breaks
    const chunks = splitIntoTtsChunks(text, 100)

    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(100)
    }
  })
})

// Regression test for a real bug: Buffer.concat-ing raw Speechify chunks left a second
// ID3v2 tag sitting mid-stream, which decoders read where they expect an MPEG frame sync
// word — audible corruption at the seam ("Header missing", confirmed via ffmpeg decode).
describe('stripLeadingId3v2Tag', () => {
  it('removes an ID3v2 tag and leaves the audio bytes untouched', () => {
    const audio = Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x00, 0x01, 0x02, 0x03])
    const tagged = buildId3v2Buffer(23, audio)

    const stripped = stripLeadingId3v2Tag(tagged)

    expect(stripped.equals(audio)).toBe(true)
  })

  it('leaves a buffer with no ID3v2 tag unchanged', () => {
    const audio = Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x00, 0x01])
    expect(stripLeadingId3v2Tag(audio).equals(audio)).toBe(true)
  })

  it('leaves a too-short buffer unchanged rather than throwing', () => {
    const tiny = Buffer.from([0x49, 0x44]) // "ID" — not even a full possible tag
    expect(stripLeadingId3v2Tag(tiny).equals(tiny)).toBe(true)
  })
})
