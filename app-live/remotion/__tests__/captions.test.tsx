import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Captions } from '../Captions'
import type { CaptionStyle, Shot } from '../schema'

const remotionState = vi.hoisted(() => ({ frame: 15 }))

vi.mock('remotion', async importOriginal => {
  const actual = await importOriginal<typeof import('remotion')>()
  return {
    ...actual,
    useCurrentFrame: () => remotionState.frame,
    useVideoConfig: () => ({ fps: 30, height: 1080, width: 1920 })
  }
})

const shot: Shot = {
  kind: 'photo',
  start: 0,
  duration: 4,
  words: [
    { word: 'Every', start: 0, end: 0.4 },
    { word: 'frame', start: 0.4, end: 0.8 },
    { word: 'tells', start: 0.8, end: 1.2 },
    { word: 'the', start: 1.2, end: 1.5 },
    { word: 'story', start: 1.5, end: 2 }
  ]
}

const segmentedShot: Shot = {
  kind: 'photo',
  start: 0,
  duration: 5,
  words: [
    { word: 'First', start: 0.1, end: 0.35 },
    { word: 'sentence.', start: 0.35, end: 0.7 },
    { word: 'Second', start: 1.4, end: 1.75 },
    { word: 'sentence.', start: 1.75, end: 2.1 }
  ]
}

function renderCaptions(captionStyle: CaptionStyle) {
  return render(
    <Captions shots={[shot]} accent="#ff6b00" captionStyle={captionStyle} />
  )
}

afterEach(() => {
  cleanup()
  remotionState.frame = 15
})

describe('Captions', () => {
  it.each([
    'documentary',
    'karaoke',
    'minimal',
    'tiktok',
    'full-sentence'
  ] as const)(
    'marks the %s treatment on its rendered wrapper',
    captionStyle => {
      const { container } = renderCaptions(captionStyle)

      expect(
        container.querySelector(`[data-caption-style="${captionStyle}"]`)
      ).toBeInTheDocument()
    }
  )

  it('renders legacy normal captions with full-sentence behavior', () => {
    const { container } = renderCaptions('normal')

    expect(
      container.querySelector('[data-caption-style="full-sentence"]')
    ).toBeInTheDocument()
    expect(screen.getByText('Every frame tells the story')).toBeInTheDocument()
  })

  it('advances the karaoke highlight from Remotion frames', () => {
    const { rerender } = renderCaptions('karaoke')
    expect(screen.getByText('frame')).toHaveAttribute(
      'data-word-state',
      'active'
    )

    remotionState.frame = 27
    rerender(
      <Captions shots={[shot]} accent="#ff6b00" captionStyle="karaoke" />
    )

    expect(screen.getByText('tells')).toHaveAttribute(
      'data-word-state',
      'active'
    )
    expect(screen.getByText('frame')).toHaveAttribute(
      'data-word-state',
      'spoken'
    )
  })

  it('does not activate or reveal a caption group before its first word starts', () => {
    remotionState.frame = 0

    for (const captionStyle of ['documentary', 'minimal', 'tiktok'] as const) {
      const { container, unmount } = render(
        <Captions
          shots={[segmentedShot]}
          accent="#ff6b00"
          captionStyle={captionStyle}
        />
      )
      expect(
        container.querySelector(`[data-caption-style="${captionStyle}"]`)
      ).not.toBeInTheDocument()
      unmount()
    }

    const { container } = render(
      <Captions
        shots={[segmentedShot]}
        accent="#ff6b00"
        captionStyle="karaoke"
      />
    )
    expect(
      container.querySelector('[data-word-state="active"]')
    ).not.toBeInTheDocument()
  })

  it('keeps the previous karaoke phrase without an active word during a pause', () => {
    remotionState.frame = 30
    const { container } = render(
      <Captions
        shots={[segmentedShot]}
        accent="#ff6b00"
        captionStyle="karaoke"
      />
    )

    expect(
      container.querySelector('[data-word-state="active"]')
    ).not.toBeInTheDocument()
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.queryByText('Second')).not.toBeInTheDocument()
  })

  it('has no active karaoke or TikTok word after the final word ends', () => {
    remotionState.frame = 75

    for (const captionStyle of ['karaoke', 'tiktok'] as const) {
      const { container, unmount } = render(
        <Captions
          shots={[segmentedShot]}
          accent="#ff6b00"
          captionStyle={captionStyle}
        />
      )
      expect(
        container.querySelector('[data-word-state="active"]')
      ).not.toBeInTheDocument()
      unmount()
    }
  })

  it('splits full-sentence blocks at punctuation and advances by frame', () => {
    remotionState.frame = 12
    const { rerender } = render(
      <Captions
        shots={[segmentedShot]}
        accent="#ff6b00"
        captionStyle="full-sentence"
      />
    )

    expect(screen.getByText('First sentence.')).toBeInTheDocument()
    expect(screen.queryByText('Second sentence.')).not.toBeInTheDocument()

    remotionState.frame = 48
    rerender(
      <Captions
        shots={[segmentedShot]}
        accent="#ff6b00"
        captionStyle="full-sentence"
      />
    )

    expect(screen.getByText('Second sentence.')).toBeInTheDocument()
    expect(screen.queryByText('First sentence.')).not.toBeInTheDocument()
  })

  it('does not show a full-sentence block between timed blocks or after them', () => {
    remotionState.frame = 30
    const { container, rerender } = render(
      <Captions
        shots={[segmentedShot]}
        accent="#ff6b00"
        captionStyle="full-sentence"
      />
    )
    expect(
      container.querySelector('[data-caption-style="full-sentence"]')
    ).not.toBeInTheDocument()

    remotionState.frame = 75
    rerender(
      <Captions
        shots={[segmentedShot]}
        accent="#ff6b00"
        captionStyle="full-sentence"
      />
    )
    expect(
      container.querySelector('[data-caption-style="full-sentence"]')
    ).not.toBeInTheDocument()
  })

  it.each([
    'documentary',
    'karaoke',
    'minimal',
    'tiktok',
    'full-sentence'
  ] as const)('marks the %s wrapper as title-safe', captionStyle => {
    const { container } = renderCaptions(captionStyle)
    const wrapper = container.querySelector(
      `[data-caption-style="${captionStyle}"]`
    )

    expect(wrapper).toHaveAttribute('data-safe-area', 'title')
    expect(wrapper).toHaveStyle({ left: '115px', right: '115px' })
  })
})
