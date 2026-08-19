import { describe, expect, it } from 'vitest'

import { clampTimelineHeight, fitPixelsPerSecond } from '../timeline-scale'

describe('fitPixelsPerSecond', () => {
  it.each([
    { duration: 30, expected: 27.733333333333334 },
    { duration: 180, expected: 4.622222222222222 },
    { duration: 3600, expected: 0.2311111111111111 }
  ])(
    'fits a $duration second project into the available track width',
    ({ duration, expected }) => {
      expect(fitPixelsPerSecond(duration, 1000, 144, 24)).toBeCloseTo(
        expected,
        10
      )
    }
  )

  it('can fit an hour into a narrow viewport without the old 40 px/s floor', () => {
    expect(fitPixelsPerSecond(3600, 200, 144, 24)).toBeCloseTo(
      0.008888888888888889,
      10
    )
  })

  it('returns finite safe limits when no usable duration or width exists', () => {
    expect(fitPixelsPerSecond(0, 1000, 144, 24)).toBe(180)
    expect(fitPixelsPerSecond(180, 150, 144, 24)).toBe(0.001)
  })
})

describe('clampTimelineHeight', () => {
  it('keeps resizing within track-safe viewport-relative limits', () => {
    expect(clampTimelineHeight(100, 900)).toBe(320)
    expect(clampTimelineHeight(900, 900)).toBe(480)
    expect(clampTimelineHeight(300, 400)).toBe(320)
  })
})
