export interface TimedBeatForPacing {
  id?: string
  narration: string
  start: number
  duration: number
  words: Array<{ word: string; start: number; end: number }>
  claimIds?: string[]
  entityIds?: string[]
  locationIds?: string[]
  visualQuery?: string
  visualIntent?: string
}

export const DOCUMENTARY_MIN_BEAT_SECONDS = 10
export const DOCUMENTARY_MIN_BEAT_WORDS = 15

function stableUnion(values: Array<readonly string[] | undefined>): string[] {
  return [...new Set(values.flatMap(value => value ?? []))]
}

function joinDistinct(
  values: Array<string | undefined>,
  separator: string
): string {
  return [...new Set(values.filter((value): value is string => !!value))].join(
    separator
  )
}

function groupDuration<Beat extends TimedBeatForPacing>(beats: Beat[]) {
  const first = beats[0]
  const last = beats.at(-1)!
  return last.start + last.duration - first.start
}

function mergeGroup<Beat extends TimedBeatForPacing>(beats: Beat[]): Beat {
  const first = beats[0]
  const last = beats.at(-1)!
  const merged = {
    ...first,
    narration: beats.map(beat => beat.narration).join(' '),
    start: first.start,
    duration: groupDuration(beats),
    words: beats.flatMap(beat => beat.words)
  } as Beat
  const record = merged as Record<string, unknown>

  for (const key of ['claimIds', 'entityIds', 'locationIds'] as const) {
    if (beats.some(beat => key in beat)) {
      record[key] = stableUnion(beats.map(beat => beat[key]))
    }
  }

  if (beats.some(beat => 'visualQuery' in beat)) {
    record.visualQuery = joinDistinct(
      beats.map(beat => beat.visualQuery),
      ' | '
    )
  }
  if (beats.some(beat => 'visualIntent' in beat)) {
    record.visualIntent = joinDistinct(
      beats.map(beat => beat.visualIntent),
      ' '
    )
  }

  // A transition belongs at the end of a rendered beat. When multiple beats collapse,
  // the final beat's transition remains meaningful; an earlier one no longer does.
  if ('transitionOut' in last) record.transitionOut = last.transitionOut
  else delete record.transitionOut

  return merged
}

function reindex<Beat extends TimedBeatForPacing>(beats: Beat[]): Beat[] {
  return beats.map((beat, index) => {
    if (!('id' in beat)) return beat
    return { ...beat, id: `beat-${index + 1}` }
  })
}

export function normalizeDocumentaryBeatPacing<Beat extends TimedBeatForPacing>(
  beats: readonly Beat[]
): Beat[] {
  if (!beats.length) return []

  const copies = beats.map(beat => ({ ...beat }))
  const projectStart = copies[0].start
  const projectEnd = copies.at(-1)!.start + copies.at(-1)!.duration

  // A sub-ten-second video cannot satisfy the duration minimum. Leave its existing
  // semantic cuts intact and only make shot IDs deterministic.
  if (projectEnd - projectStart < DOCUMENTARY_MIN_BEAT_SECONDS) {
    return reindex(copies)
  }

  const groups: Beat[][] = []
  let pending: Beat[] = []
  for (const beat of copies) {
    pending.push(beat)
    if (
      groupDuration(pending) >= DOCUMENTARY_MIN_BEAT_SECONDS &&
      pending.reduce((count, item) => count + item.words.length, 0) >=
        DOCUMENTARY_MIN_BEAT_WORDS
    ) {
      groups.push(pending)
      pending = []
    }
  }

  if (pending.length) {
    if (groups.length) groups.at(-1)!.push(...pending)
    else groups.push(pending)
  }

  const normalized = reindex(groups.map(mergeGroup))
  if (
    normalized.some(
      beat =>
        beat.duration < DOCUMENTARY_MIN_BEAT_SECONDS ||
        beat.words.length < DOCUMENTARY_MIN_BEAT_WORDS
    )
  ) {
    throw new Error(
      'documentary beat pacing is unsatisfiable: a project of at least 10 seconds must contain at least 15 timed words'
    )
  }
  return normalized
}
