import React from 'react'

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Storyboard } from '../Storyboard'

vi.mock('remotion', async importOriginal => {
  const actual = await importOriginal<typeof import('remotion')>()
  return {
    ...actual,
    AbsoluteFill: ({ children, ...props }: React.ComponentProps<'div'>) => (
      <div {...props}>{children}</div>
    ),
    Audio: () => null,
    Img: (props: React.ComponentProps<'img'>) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt="" {...props} />
    ),
    OffthreadVideo: ({
      trimBefore,
      trimAfter,
      volume,
      ...props
    }: React.ComponentProps<'video'> & {
      trimBefore?: number
      trimAfter?: number
      volume?: number
    }) => (
      <video
        {...props}
        data-trim-before={trimBefore}
        data-trim-after={trimAfter}
        data-volume={volume}
      />
    ),
    Sequence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    staticFile: (src: string) => `/static/${src}`,
    useCurrentFrame: () => 0,
    useVideoConfig: () => ({
      durationInFrames: 144,
      fps: 24,
      height: 1080,
      width: 1920
    })
  }
})

function renderClip(mediaMuted?: boolean) {
  return render(
    <Storyboard
      width={1920}
      height={1080}
      fps={24}
      shots={[
        {
          kind: 'video',
          src: '/documentary/backgrounds/bg4.mp4',
          start: 0,
          duration: 6,
          mediaOrigin: 'researched',
          mediaFit: 'contain',
          mediaStart: 1.25,
          mediaEnd: 7.25,
          mediaMuted,
          videoVolume: 0.75
        }
      ]}
      showCaptions={false}
      showSubscribeCta={false}
    />
  )
}

describe('Storyboard video source window', () => {
  it('converts persisted source seconds to Remotion frames for both local MP4 layers', () => {
    const { container } = renderClip(true)
    const videos = container.querySelectorAll('video')

    expect(videos).toHaveLength(2)
    for (const video of videos) {
      expect(video).toHaveAttribute(
        'src',
        '/static/documentary/backgrounds/bg4.mp4'
      )
      expect(video).toHaveAttribute('data-trim-before', '30')
      expect(video).toHaveAttribute('data-trim-after', '174')
    }
    expect(
      container.querySelector<HTMLVideoElement>(
        'video[data-media-layer="foreground"]'
      )?.muted
    ).toBe(true)
  })

  it('defaults researched video to muted but honors an explicit unmuted choice', () => {
    const defaultRender = renderClip()
    expect(
      defaultRender.container.querySelector<HTMLVideoElement>(
        'video[data-media-layer="foreground"]'
      )?.muted
    ).toBe(true)
    defaultRender.unmount()

    const explicitRender = renderClip(false)
    expect(
      explicitRender.container.querySelector<HTMLVideoElement>(
        'video[data-media-layer="foreground"]'
      )?.muted
    ).toBe(false)
    expect(
      explicitRender.container.querySelector<HTMLVideoElement>(
        'video[data-media-layer="foreground"]'
      )
    ).toHaveAttribute('data-volume', '0.75')
  })
})
