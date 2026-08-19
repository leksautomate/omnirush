import type { TransitionType } from './schema'

export interface CueEnvelope {
  volume: number
  duration?: number
  fadeIn?: number
  fadeOut?: number
}

export function audioCueVolumeAtTime(
  cue: CueEnvelope,
  localSeconds: number
): number {
  const fadeIn = cue.fadeIn ?? 0
  const fadeOut = cue.fadeOut ?? 0
  if (localSeconds < 0) return 0
  if (cue.duration != null && localSeconds >= cue.duration) return 0

  const fadeInGain = fadeIn > 0 ? Math.min(1, localSeconds / fadeIn) : 1
  const remaining =
    cue.duration == null ? Number.POSITIVE_INFINITY : cue.duration - localSeconds
  const fadeOutGain = fadeOut > 0 ? Math.min(1, remaining / fadeOut) : 1
  return cue.volume * Math.max(0, Math.min(fadeInGain, fadeOutGain))
}

export interface TransitionPresentation {
  opacity: number
  translateX: number
  scale: number
  blur: number
  burnOpacity: number
}

export function transitionPresentation(
  type: TransitionType,
  rawProgress: number
): TransitionPresentation {
  const progress = Math.max(0, Math.min(1, rawProgress))
  const base: TransitionPresentation = {
    opacity: progress,
    translateX: 0,
    scale: 1,
    blur: 0,
    burnOpacity: 0
  }

  if (type === 'cut') return { ...base, opacity: 1 }
  if (type === 'slide') {
    return { ...base, opacity: 1, translateX: (1 - progress) * 100 }
  }
  if (type === 'whip-pan') {
    return {
      ...base,
      translateX: (1 - progress) * 115,
      blur: (1 - progress) * 18
    }
  }
  if (type === 'zoom-blur') {
    return {
      ...base,
      scale: 1 + (1 - progress) * 0.16,
      blur: (1 - progress) * 14
    }
  }
  if (type === 'film-burn') {
    return {
      ...base,
      burnOpacity: Math.max(0, 1 - Math.abs(progress - 0.5) * 2)
    }
  }
  return base
}
