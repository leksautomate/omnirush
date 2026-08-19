import { describe, expect, it } from 'vitest'

import { audioCueVolumeAtTime, transitionPresentation } from '../audio-mix'

describe('audioCueVolumeAtTime', () => {
  const cue = {
    volume: 0.6,
    duration: 10,
    fadeIn: 2,
    fadeOut: 2
  }

  it('applies independent fade-in, steady-state, and fade-out gain', () => {
    expect(audioCueVolumeAtTime(cue, 0)).toBe(0)
    expect(audioCueVolumeAtTime(cue, 1)).toBeCloseTo(0.3)
    expect(audioCueVolumeAtTime(cue, 4)).toBeCloseTo(0.6)
    expect(audioCueVolumeAtTime(cue, 9)).toBeCloseTo(0.3)
    expect(audioCueVolumeAtTime(cue, 10)).toBe(0)
  })
})

describe('transitionPresentation', () => {
  it('turns a transition type into deterministic visual values', () => {
    expect(transitionPresentation('cut', 0)).toEqual({
      opacity: 1,
      translateX: 0,
      scale: 1,
      blur: 0,
      burnOpacity: 0
    })
    expect(transitionPresentation('slide', 0).translateX).toBe(100)
    expect(transitionPresentation('slide', 1).translateX).toBe(0)
    expect(transitionPresentation('zoom-blur', 0)).toMatchObject({
      opacity: 0,
      scale: 1.16,
      blur: 14
    })
    expect(transitionPresentation('film-burn', 0.5).burnOpacity).toBe(1)
  })
})
