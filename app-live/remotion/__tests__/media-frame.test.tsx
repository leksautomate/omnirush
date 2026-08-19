import React from 'react'

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MediaFrame } from '../MediaFrame'
import type { Shot } from '../schema'
import { Storyboard } from '../Storyboard'

vi.mock('remotion', async importOriginal => {
  const actual = await importOriginal<typeof import('remotion')>()
  return {
    ...actual,
    AbsoluteFill: ({ children, ...props }: React.ComponentProps<'div'>) => (
      <div {...props}>{children}</div>
    ),
    Audio: () => null,
    Img: ({ alt, ...props }: React.ComponentProps<'img'>) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={alt ?? ''} {...props} />
    ),
    OffthreadVideo: ({
      trimBefore,
      trimAfter,
      ...props
    }: React.ComponentProps<'video'> & {
      trimBefore?: number
      trimAfter?: number
    }) => (
      <video
        {...props}
        data-trim-before={trimBefore}
        data-trim-after={trimAfter}
      />
    ),
    Sequence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    staticFile: (src: string) => `/static/${src}`,
    useCurrentFrame: () => 0,
    useVideoConfig: () => ({
      durationInFrames: 90,
      fps: 30,
      height: 1080,
      width: 1920
    })
  }
})

function renderShot(shot: Shot) {
  return render(
    <Storyboard
      width={1920}
      height={1080}
      fps={30}
      shots={[shot]}
      showCaptions={false}
      showSubscribeCta={false}
    />
  )
}

describe('Storyboard source-media fit', () => {
  it('keeps a contained researched still uncropped over a blurred dark copy', () => {
    const { container } = renderShot({
      kind: 'photo',
      src: 'https://catalog.archives.gov/portrait.jpg',
      start: 0,
      duration: 3,
      mediaFit: 'contain'
    })

    const frame = container.querySelector('[data-media-frame]')
    const foreground = container.querySelector(
      '[data-media-layer="foreground"]'
    )
    const background = container.querySelector(
      '[data-media-layer="background"]'
    )

    expect(frame).toHaveAttribute('data-media-fit', 'contain')
    expect(foreground).toHaveStyle({ objectFit: 'contain' })
    expect(background).toHaveStyle({
      filter: 'blur(28px) brightness(0.35) saturate(0.75)',
      objectFit: 'cover'
    })
  })

  it('keeps a contained researched MP4 uncropped and mutes its background copy', () => {
    const { container } = renderShot({
      kind: 'video',
      src: 'https://archive.org/download/reel/vertical.mp4',
      start: 0,
      duration: 3,
      mediaFit: 'contain',
      videoVolume: 0.5
    })

    const foreground = container.querySelector(
      'video[data-media-layer="foreground"]'
    )
    const background = container.querySelector(
      'video[data-media-layer="background"]'
    )

    expect(foreground).toHaveStyle({ objectFit: 'contain' })
    expect((foreground as HTMLVideoElement).muted).toBe(false)
    expect(background).toHaveStyle({ objectFit: 'cover' })
    expect((background as HTMLVideoElement).muted).toBe(true)
  })

  it('gives contained MP4 background and foreground the same source window', () => {
    const { container } = render(
      <MediaFrame
        src="https://archive.org/download/reel/vertical.mp4"
        mediaType="video"
        fit="contain"
        muted={false}
        volume={0.5}
        videoProps={{ trimBefore: 45, trimAfter: 90 }}
      />
    )

    const foreground = container.querySelector(
      'video[data-media-layer="foreground"]'
    ) as HTMLVideoElement
    const background = container.querySelector(
      'video[data-media-layer="background"]'
    ) as HTMLVideoElement

    for (const media of [background, foreground]) {
      expect(media).toHaveAttribute(
        'src',
        'https://archive.org/download/reel/vertical.mp4'
      )
      expect(media).toHaveAttribute('data-trim-before', '45')
      expect(media).toHaveAttribute('data-trim-after', '90')
    }
    expect(background.muted).toBe(true)
    expect(foreground.muted).toBe(false)
  })

  it('keeps generated or manual full-frame media in cover mode by default', () => {
    const { container } = renderShot({
      kind: 'photo',
      src: '/generated/images/cinematic-background.jpg',
      start: 0,
      duration: 3
    })

    const frame = container.querySelector('[data-media-frame]')
    const foreground = container.querySelector(
      '[data-media-layer="foreground"]'
    )

    expect(frame).toHaveAttribute('data-media-fit', 'cover')
    expect(foreground).toHaveStyle({ objectFit: 'cover' })
    expect(
      container.querySelector('[data-media-layer="background"]')
    ).not.toBeInTheDocument()
  })

  it('lets explicit Fill override archival-photo containment', () => {
    const { container } = renderShot({
      kind: 'photo',
      src: 'https://catalog.archives.gov/photo.jpg',
      start: 0,
      duration: 3,
      mediaFit: 'cover',
      documentary: {
        beatType: 'archival-photo',
        chapterId: 'chapter-1',
        claimIds: [],
        entityIds: [],
        locationIds: [],
        reconstruction: false
      }
    })

    const frame = container.querySelector('[data-media-frame]')
    const foreground = container.querySelector(
      '[data-media-layer="foreground"]'
    )

    expect(frame).toHaveAttribute('data-media-fit', 'cover')
    expect(foreground).toHaveStyle({ objectFit: 'cover' })
    expect(
      container.querySelector('[data-media-layer="background"]')
    ).not.toBeInTheDocument()
  })

  it('defaults archival-photo treatment to contain without scaling the foreground', () => {
    const { container } = renderShot({
      kind: 'photo',
      src: 'https://catalog.archives.gov/photo.jpg',
      start: 0,
      duration: 3,
      documentary: {
        beatType: 'archival-photo',
        chapterId: 'chapter-1',
        claimIds: [],
        entityIds: [],
        locationIds: [],
        reconstruction: false
      }
    })

    const frame = container.querySelector('[data-media-frame]')
    const foreground = container.querySelector(
      '[data-media-layer="foreground"]'
    )

    expect(frame).toHaveAttribute('data-media-fit', 'contain')
    expect(foreground).toHaveStyle({ objectFit: 'contain' })
    expect((foreground as HTMLElement).style.scale).toBe('')
    expect((foreground as HTMLElement).style.translate).toBe('')
  })
})
