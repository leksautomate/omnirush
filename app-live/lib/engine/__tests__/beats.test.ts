import { beforeEach, describe, expect, it, vi } from 'vitest'

// The engine streams shots via `streamObject` and resolves models through the registry;
// both are stubbed so these tests exercise our own segmentation logic only. `generateText`
// backs the plain-generation fallback used when streaming yields nothing usable.
const streamObject = vi.hoisted(() => vi.fn())
const generateText = vi.hoisted(() => vi.fn())
vi.mock('ai', async importOriginal => ({
  ...(await importOriginal<typeof import('ai')>()),
  streamObject,
  generateText
}))
vi.mock('@/lib/utils/registry', () => ({ getModel: (m: string) => m }))

import { bindVoiceTimings, cutScriptIntoBeats } from '../beats'

type Shot = {
  narration: string
  kind?: string
  visualQuery?: string
  visualIntent?: string
}

/** Drive `elementStream` from a fixed list, optionally throwing partway through. */
function mockStream(shots: Shot[], failAfter?: number) {
  streamObject.mockReturnValue({
    elementStream: (async function* () {
      for (let i = 0; i < shots.length; i++) {
        if (failAfter !== undefined && i === failAfter) {
          throw new Error('stream died mid-generation')
        }
        yield shots[i]
      }
    })()
  })
}

const shot = (narration: string): Shot => ({
  narration,
  kind: 'video',
  visualQuery: `${narration} query`,
  visualIntent: `show ${narration}`
})

describe('cutScriptIntoBeats', () => {
  beforeEach(() => {
    streamObject.mockReset()
    generateText.mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('builds a storyboard from streamed shots with sequential timings', async () => {
    mockStream([shot('First beat here'), shot('Second beat here')])

    const sb = await cutScriptIntoBeats('google:gemini-2.5-flash', {
      script: 'First beat here Second beat here',
      topic: 'Test'
    })

    expect(sb.shots).toHaveLength(2)
    expect(sb.shots[0].start).toBe(0)
    // Each shot starts where the previous one ended — no gaps, no overlap.
    expect(sb.shots[1].start).toBeCloseTo(sb.shots[0].duration, 3)
    expect(sb.totalSeconds).toBeCloseTo(
      sb.shots[1].start + sb.shots[1].duration,
      2
    )
    expect(sb.estimatedTimings).toBe(true)
    // Word timings stay inside their shot so karaoke captions can't drift.
    const words = sb.shots[0].words
    expect(words.at(-1)!.end).toBeCloseTo(
      sb.shots[0].start + sb.shots[0].duration,
      3
    )
  })

  // The original bug: a truncated or stalled generation threw away everything and the
  // tool crashed after a long wait. Partial output must degrade to a shorter storyboard.
  it('keeps the shots already received when the stream fails partway', async () => {
    mockStream([shot('One'), shot('Two'), shot('Three')], 2)

    const sb = await cutScriptIntoBeats('google:gemini-2.5-flash', {
      script: 'One Two Three'
    })

    expect(sb.shots).toHaveLength(2)
    expect(sb.shots.map(s => s.narration)).toEqual(['One', 'Two'])
  })

  it('throws only when both streaming and the plain-generation fallback produce nothing', async () => {
    // Stream completes cleanly but produces nothing usable, and the plain-generation
    // fallback also comes up empty — only then should this throw.
    mockStream([{ narration: '   ' }, { narration: '' }])
    generateText.mockResolvedValue({ text: '[]' })
    await expect(
      cutScriptIntoBeats('google:gemini-2.5-flash', { script: 'One' })
    ).rejects.toThrow('produced no shots')
  })

  // The ModelArk bugs: some OpenAI-compatible providers stream zero elements for
  // schema-constrained array output without throwing, even though the same model
  // returns correct JSON via a plain (non-streaming) generation; others reject the
  // request outright (e.g. Ark 400s response_format:'json_object' unless the literal
  // word "json" appears in the prompt) before any element ever streams. Both must fall
  // back to the plain generation rather than failing the whole request.
  it('falls back to a plain generation when streaming yields nothing usable', async () => {
    mockStream([{ narration: '' }])
    generateText.mockResolvedValue({
      text: JSON.stringify([
        {
          narration: 'Recovered beat',
          kind: 'video',
          visualQuery: 'recovered query',
          visualIntent: 'show recovered beat'
        }
      ])
    })

    const sb = await cutScriptIntoBeats(
      'modelark:deepseek-v4-flash-ga-260731',
      {
        script: 'Recovered beat'
      }
    )

    expect(sb.shots).toHaveLength(1)
    expect(sb.shots[0].narration).toBe('Recovered beat')
  })

  it('uses forced tool output for ModelArk instead of structured streaming', async () => {
    generateText.mockResolvedValue({
      toolCalls: [
        {
          toolName: 'submit_shots',
          input: {
            shots: [
              {
                narration: 'Recovered through tool output',
                kind: 'video',
                visualQuery: 'La-5 fighter archival footage',
                visualIntent: 'Show the fighter crossing frame.'
              }
            ]
          }
        }
      ]
    })

    const sb = await cutScriptIntoBeats(
      'modelark:deepseek-v4-flash-ga-260731',
      { script: 'Recovered through tool output' }
    )

    expect(sb.shots).toHaveLength(1)
    expect(sb.shots[0].narration).toBe('Recovered through tool output')
    expect(streamObject).not.toHaveBeenCalled()
  })

  it('falls back to a plain generation when streaming throws before yielding anything', async () => {
    mockStream([shot('One')], 0) // throws on the very first element
    generateText.mockResolvedValue({
      text: JSON.stringify([
        {
          narration: 'Recovered from throw',
          kind: 'video',
          visualQuery: 'recovered query',
          visualIntent: 'show recovered beat'
        }
      ])
    })

    const sb = await cutScriptIntoBeats('google:gemini-2.5-flash', {
      script: 'One'
    })

    expect(sb.shots).toHaveLength(1)
    expect(sb.shots[0].narration).toBe('Recovered from throw')
  })

  it('reports progress as each shot lands', async () => {
    mockStream([shot('One'), shot('Two'), shot('Three')])
    const seen: number[] = []

    await cutScriptIntoBeats(
      'google:gemini-2.5-flash',
      { script: 'One Two Three' },
      undefined,
      n => seen.push(n)
    )

    expect(seen).toEqual([1, 2, 3])
  })

  it('defaults a missing kind to photo and backfills absent visual fields', async () => {
    mockStream([{ narration: 'Bare shot' }])

    const sb = await cutScriptIntoBeats('google:gemini-2.5-flash', {
      script: 'Bare shot',
      topic: 'Fallback topic'
    })

    expect(sb.shots[0].kind).toBe('photo')
    expect(sb.shots[0].visualQuery).toBe('Fallback topic')
    expect(sb.shots[0].visualIntent).toBe('Bare shot')
  })

  it('rejects an empty script without calling the model', async () => {
    await expect(
      cutScriptIntoBeats('google:gemini-2.5-flash', { script: '   ' })
    ).rejects.toThrow('no script to segment')
    expect(streamObject).not.toHaveBeenCalled()
  })

  it('locks shots to real voice timings when they are supplied', async () => {
    mockStream([shot('Hello there'), shot('Goodbye now')])

    const sb = await cutScriptIntoBeats('google:gemini-2.5-flash', {
      script: 'Hello there Goodbye now',
      voiceWords: [
        { word: 'Hello', start: 0, end: 0.5 },
        { word: 'there', start: 0.5, end: 1 },
        { word: 'Goodbye', start: 1.2, end: 1.8 },
        { word: 'now', start: 1.8, end: 2.4 }
      ] as any
    })

    expect(sb.estimatedTimings).toBe(false)
    // Shot 2 begins at its first spoken word; the pause folds into shot 1.
    expect(sb.shots[1].start).toBeCloseTo(1.2, 3)
    expect(sb.totalSeconds).toBeCloseTo(2.4, 2)
  })

  it.each([
    {
      name: 'documentary profile',
      profile: {
        niche: 'ww1_ww2' as const,
        format: 'documentary' as const,
        presetVersion: 1 as const
      },
      expectedShots: 2
    },
    { name: 'ordinary script', profile: undefined, expectedShots: 4 }
  ])(
    'normalizes timed cuts only for a $name',
    async ({ profile, expectedShots }) => {
      const narrations = [
        'Soviet defenders held ruined factories beside the Volga',
        'German infantry advanced through rubble under artillery fire',
        'Winter closed the steppe while reserves assembled outside',
        'Operation Uranus trapped the attacking army inside Stalingrad'
      ]
      mockStream(narrations.map(shot))
      const voiceWords = narrations
        .flatMap(narration => narration.split(/\s+/))
        .map((word, index) => ({
          word,
          start: index * 0.625,
          end: (index + 1) * 0.625
        }))

      const storyboard = await cutScriptIntoBeats('google:gemini-2.5-flash', {
        script: narrations.join(' '),
        voiceWords,
        ...(profile ? { profile } : {})
      })

      expect(storyboard.shots).toHaveLength(expectedShots)
      expect(storyboard.totalSeconds).toBe(20)
      expect(storyboard.shots.flatMap(beat => beat.words)).toEqual(voiceWords)
    }
  )

  it('adds documentary pacing guidance only to documentary model calls', async () => {
    const narration =
      'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen'

    mockStream([shot(narration)])
    await cutScriptIntoBeats('google:gemini-2.5-flash', {
      script: narration
    })
    const ordinarySystem = streamObject.mock.calls[0][0].system as string

    mockStream([shot(narration)])
    await cutScriptIntoBeats('google:gemini-2.5-flash', {
      script: narration,
      profile: {
        niche: 'ww1_ww2',
        format: 'documentary',
        presetVersion: 1
      }
    })
    const documentarySystem = streamObject.mock.calls[1][0].system as string

    expect(ordinarySystem).not.toContain(
      'at least 15 narrated words and at least 10 seconds'
    )
    expect(documentarySystem).toContain(
      'at least 15 narrated words and at least 10 seconds'
    )
  })
})

describe('bindVoiceTimings', () => {
  const core = (narration: string) => ({
    narration,
    kind: 'photo' as const,
    visualQuery: 'q',
    visualIntent: 'i'
  })

  it('tiles shot boundaries across the audio with no drift', () => {
    const shots = bindVoiceTimings([core('a b'), core('c d')], [
      { word: 'a', start: 0, end: 0.4 },
      { word: 'b', start: 0.4, end: 0.8 },
      { word: 'c', start: 1, end: 1.4 },
      { word: 'd', start: 1.4, end: 2 }
    ] as any)

    expect(shots[0].start).toBe(0)
    expect(shots[0].start + shots[0].duration).toBeCloseTo(shots[1].start, 3)
    expect(shots[1].start + shots[1].duration).toBeCloseTo(2, 3)
  })

  it('gives leftover words to the last shot so none are dropped', () => {
    const shots = bindVoiceTimings([core('a'), core('b')], [
      { word: 'a', start: 0, end: 0.5 },
      { word: 'b', start: 0.5, end: 1 },
      { word: 'extra', start: 1, end: 1.5 }
    ] as any)

    expect(shots.at(-1)!.words.map(w => w.word)).toEqual(['b', 'extra'])
    expect(shots.at(-1)!.start + shots.at(-1)!.duration).toBeCloseTo(1.5, 3)
  })
})
