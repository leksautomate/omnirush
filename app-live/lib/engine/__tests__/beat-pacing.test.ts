import { describe, expect, it } from 'vitest'

import { normalizeDocumentaryBeatPacing } from '../beat-pacing'

interface TestBeat {
  id: string
  chapterId: string
  type: string
  narration: string
  start: number
  duration: number
  words: Array<{ word: string; start: number; end: number }>
  claimIds: string[]
  entityIds: string[]
  locationIds: string[]
  visualQuery: string
  visualIntent: string
  graphic?: { type: string }
  transitionOut?: { type: string; duration: number }
}

function makeBeat(
  id: string,
  start: number,
  duration: number,
  wordCount: number,
  overrides: Partial<TestBeat> = {}
): TestBeat {
  const words = Array.from({ length: wordCount }, (_, index) => ({
    word: `${id}-word-${index + 1}`,
    start: +(start + (index * duration) / wordCount).toFixed(3),
    end: +(start + ((index + 1) * duration) / wordCount).toFixed(3)
  }))
  return {
    id,
    chapterId: `chapter-${id}`,
    type: 'archival-photo',
    narration: words.map(word => word.word).join(' '),
    start,
    duration,
    words,
    claimIds: [`claim-${id}`],
    entityIds: [`entity-${id}`],
    locationIds: [`location-${id}`],
    visualQuery: `query ${id}`,
    visualIntent: `Show ${id}.`,
    ...overrides
  }
}

describe('normalizeDocumentaryBeatPacing', () => {
  it.each([
    {
      name: 'merges adjacent short beats until both minimums are met',
      input: [makeBeat('a', 0, 6, 8), makeBeat('b', 6, 6, 8)],
      durations: [12],
      wordCounts: [16]
    },
    {
      name: 'does not accept adequate duration with too few narrated words',
      input: [makeBeat('a', 0, 12, 8), makeBeat('b', 12, 10, 7)],
      durations: [22],
      wordCounts: [15]
    },
    {
      name: 'merges a short final remainder backward',
      input: [
        makeBeat('a', 0, 10, 15),
        makeBeat('b', 10, 10, 15),
        makeBeat('c', 20, 4, 5)
      ],
      durations: [10, 14],
      wordCounts: [15, 20]
    },
    {
      name: 'exempts an entire project shorter than ten seconds',
      input: [makeBeat('a', 0, 4, 5), makeBeat('b', 4, 4, 5)],
      durations: [4, 4],
      wordCounts: [5, 5]
    }
  ])('$name', ({ input, durations, wordCounts }) => {
    const normalized = normalizeDocumentaryBeatPacing(input)

    expect(normalized.map(beat => beat.duration)).toEqual(durations)
    expect(normalized.map(beat => beat.words.length)).toEqual(wordCounts)
    expect(normalized.map(beat => beat.id)).toEqual(
      durations.map((_, index) => `beat-${index + 1}`)
    )
  })

  it('unions documentary IDs and retains source intent from every merged beat', () => {
    const normalized = normalizeDocumentaryBeatPacing([
      makeBeat('a', 0, 6, 8, {
        claimIds: ['claim-shared', 'claim-a'],
        entityIds: ['entity-a'],
        locationIds: ['location-shared'],
        graphic: { type: 'battle-map' },
        transitionOut: { type: 'cut', duration: 0 }
      }),
      makeBeat('b', 6, 6, 8, {
        claimIds: ['claim-shared', 'claim-b'],
        entityIds: ['entity-a', 'entity-b'],
        locationIds: ['location-shared', 'location-b'],
        transitionOut: { type: 'film-burn', duration: 0.4 }
      })
    ])

    expect(normalized[0]).toEqual(
      expect.objectContaining({
        claimIds: ['claim-shared', 'claim-a', 'claim-b'],
        entityIds: ['entity-a', 'entity-b'],
        locationIds: ['location-shared', 'location-b'],
        graphic: { type: 'battle-map' },
        transitionOut: { type: 'film-burn', duration: 0.4 },
        visualQuery: 'query a | query b',
        visualIntent: 'Show a. Show b.'
      })
    )
  })

  it('preserves all narration, timed words, continuity, and the project end', () => {
    const input = [
      makeBeat('a', 0, 7, 9),
      makeBeat('b', 7, 5, 7),
      makeBeat('c', 12, 10, 15),
      makeBeat('d', 22, 3, 4)
    ]
    const originalNarration = input.map(beat => beat.narration).join(' ')
    const originalWords = input.flatMap(beat => beat.words)
    const originalEnd = 25

    const normalized = normalizeDocumentaryBeatPacing(input)

    expect(normalized.map(beat => beat.narration).join(' ')).toBe(
      originalNarration
    )
    expect(normalized.flatMap(beat => beat.words)).toEqual(originalWords)
    expect(normalized.at(-1)!.start + normalized.at(-1)!.duration).toBe(
      originalEnd
    )
    for (let index = 1; index < normalized.length; index++) {
      expect(normalized[index].start).toBe(
        normalized[index - 1].start + normalized[index - 1].duration
      )
    }
  })

  it('deterministically normalizes a 180-second Stalingrad-shaped timeline', () => {
    const input = Array.from({ length: 30 }, (_, index) =>
      makeBeat(`stalingrad-${index + 1}`, index * 6, 6, 9)
    )

    const normalized = normalizeDocumentaryBeatPacing(input)

    expect(normalized).toHaveLength(15)
    expect(normalized.every(beat => beat.duration === 12)).toBe(true)
    expect(normalized.every(beat => beat.words.length === 18)).toBe(true)
    expect(normalized.at(-1)!.start + normalized.at(-1)!.duration).toBe(180)
  })

  it('rejects a normal-length project with fewer than 15 total timed words', () => {
    expect(() =>
      normalizeDocumentaryBeatPacing([makeBeat('a', 0, 12, 14)])
    ).toThrow(
      'documentary beat pacing is unsatisfiable: a project of at least 10 seconds must contain at least 15 timed words'
    )
  })
})
