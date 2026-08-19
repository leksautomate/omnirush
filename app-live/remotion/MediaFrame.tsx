import React from 'react'

import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  type OffthreadVideoProps
} from 'remotion'

import type { Shot } from './schema'

export type MediaFit = NonNullable<Shot['mediaFit']>

export function mediaFitForShot(shot: Shot): MediaFit {
  if (shot.mediaFit) return shot.mediaFit

  if (shot.mediaOrigin) {
    return shot.mediaOrigin === 'researched' || shot.mediaOrigin === 'archival'
      ? 'contain'
      : 'cover'
  }

  const documentary = shot.documentary
  if (
    documentary?.beatType === 'archival-photo' ||
    (documentary &&
      !documentary.reconstruction &&
      documentary.rights?.provider !== 'ai-generated')
  ) {
    return 'contain'
  }

  return 'cover'
}

type SourceWindowProps = Pick<OffthreadVideoProps, 'trimBefore' | 'trimAfter'>

interface MediaFrameProps {
  src: string
  mediaType?: 'image' | 'video'
  fit?: MediaFit
  muted?: boolean
  volume?: OffthreadVideoProps['volume']
  foregroundStyle?: React.CSSProperties
  videoProps?: SourceWindowProps
}

const fillStyle: React.CSSProperties = {
  width: '100%',
  height: '100%'
}

const backgroundStyle: React.CSSProperties = {
  ...fillStyle,
  objectFit: 'cover',
  filter: 'blur(28px) brightness(0.35) saturate(0.75)',
  transform: 'scale(1.12)'
}

export const MediaFrame: React.FC<MediaFrameProps> = ({
  src,
  mediaType = 'image',
  fit = 'cover',
  muted = true,
  volume = 0,
  foregroundStyle,
  videoProps
}) => {
  const foregroundMediaStyle: React.CSSProperties = {
    ...foregroundStyle,
    ...fillStyle,
    objectFit: fit
  }

  const background =
    fit === 'contain' ? (
      mediaType === 'video' ? (
        <OffthreadVideo
          {...videoProps}
          src={src}
          muted
          volume={0}
          aria-hidden="true"
          data-media-layer="background"
          style={backgroundStyle}
        />
      ) : (
        <Img
          src={src}
          aria-hidden="true"
          data-media-layer="background"
          style={backgroundStyle}
        />
      )
    ) : null

  const foreground =
    mediaType === 'video' ? (
      <OffthreadVideo
        {...videoProps}
        src={src}
        muted={muted}
        volume={volume}
        data-media-layer="foreground"
        style={foregroundMediaStyle}
      />
    ) : (
      <Img
        src={src}
        data-media-layer="foreground"
        style={foregroundMediaStyle}
      />
    )

  return (
    <AbsoluteFill
      data-media-frame="true"
      data-media-fit={fit}
      style={{ overflow: 'hidden', backgroundColor: '#080808' }}
    >
      {background}
      <AbsoluteFill>{foreground}</AbsoluteFill>
    </AbsoluteFill>
  )
}
