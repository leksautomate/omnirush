import React from 'react'

import { Audio, Sequence, staticFile, useVideoConfig } from 'remotion'

export const SFX_LIBRARY = {
  whoosh: {
    url: '/audio/sfx/dragon-studio-whoosh-effect-382717.mp3',
    durationSec: 0.575
  },
  whip: {
    url: '/audio/sfx/dragon-studio-whoosh-effect-382717.mp3',
    durationSec: 0.575
  },
  pop: {
    url: '/audio/sfx/lucadialessandro-cinematic-impact-464937.mp3',
    durationSec: 4.833
  },
  bell: {
    url: '/audio/sfx/lucadialessandro-cinematic-impact-464937.mp3',
    durationSec: 4.833
  }
} as const

export type SfxType = keyof typeof SFX_LIBRARY

interface SoundEffectProps {
  type: SfxType
  from?: number
  volume?: number
}

export const SoundEffect: React.FC<SoundEffectProps> = ({
  type,
  from = 0,
  volume = 0.5
}) => {
  const { fps } = useVideoConfig()
  const sound = SFX_LIBRARY[type]
  if (!sound || volume <= 0) return null

  return (
    <Sequence
      from={from}
      durationInFrames={Math.max(1, Math.ceil(sound.durationSec * fps))}
      layout="none"
    >
      <Audio
        src={
          sound.url.startsWith('/audio/')
            ? staticFile(sound.url.slice(1))
            : sound.url
        }
        volume={volume}
      />
    </Sequence>
  )
}
