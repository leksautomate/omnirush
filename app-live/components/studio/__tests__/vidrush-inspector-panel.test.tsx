import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { VidrushInspectorPanel } from '../vidrush-inspector-panel'

import type { CaptionStyle, StoryboardInput } from '@/remotion/schema'

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})

function storyboard(captionStyle: CaptionStyle = 'normal'): StoryboardInput {
  return {
    width: 1920,
    height: 1080,
    fps: 30,
    brand: { accent: '#ff6b00' },
    captionStyle,
    shots: [
      {
        kind: 'photo',
        start: 0,
        duration: 3,
        narration: 'Every frame tells the story.'
      }
    ]
  }
}

function renderInspector(
  captionStyle: CaptionStyle = 'normal',
  onUpdateStoryboard = vi.fn()
) {
  render(
    <VidrushInspectorPanel
      selectedShotIndex={0}
      storyboard={storyboard(captionStyle)}
      historySnapshots={[]}
      onUpdateShot={vi.fn()}
      onOpenAssetPicker={vi.fn()}
      onUpdateStoryboard={onUpdateStoryboard}
      onSeekToShot={vi.fn()}
      onRestoreSnapshot={vi.fn()}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Style' }))
  return onUpdateStoryboard
}

describe('VidrushInspectorPanel caption treatments', () => {
  it('shows five choices and treats a stored normal value as Full Sentence', () => {
    renderInspector('normal')

    const choices = document.querySelectorAll('[data-caption-choice]')
    expect(choices).toHaveLength(5)
    expect(
      Array.from(choices, choice => choice.getAttribute('data-caption-choice'))
    ).toEqual(['documentary', 'karaoke', 'minimal', 'tiktok', 'full-sentence'])

    for (const label of [
      'Documentary',
      'Karaoke',
      'Minimal',
      'TikTok',
      'Full Sentence'
    ]) {
      expect(
        screen.getByRole('button', { name: new RegExp(`^${label}`) })
      ).toBeInTheDocument()
    }
    expect(screen.queryByText('Normal Wrap')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^Full Sentence/ })
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it.each([
    ['Documentary', 'documentary'],
    ['Karaoke', 'karaoke'],
    ['Minimal', 'minimal'],
    ['TikTok', 'tiktok'],
    ['Full Sentence', 'full-sentence']
  ] as const)('stores the %s choice as %s', (label, captionStyle) => {
    const onUpdateStoryboard = renderInspector('normal')

    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(`^${label}`) })
    )

    expect(onUpdateStoryboard).toHaveBeenCalledWith({ captionStyle })
  })
})

describe('VidrushInspectorPanel media fit', () => {
  it('shows Fit as selected and stores Fill on the selected shot', () => {
    const onUpdateShot = vi.fn()
    const value = storyboard()
    value.shots[0] = {
      ...value.shots[0],
      src: 'https://catalog.archives.gov/portrait.jpg',
      mediaFit: 'contain'
    }

    render(
      <VidrushInspectorPanel
        selectedShotIndex={0}
        storyboard={value}
        historySnapshots={[]}
        onUpdateShot={onUpdateShot}
        onOpenAssetPicker={vi.fn()}
        onUpdateStoryboard={vi.fn()}
        onSeekToShot={vi.fn()}
        onRestoreSnapshot={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Fit' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Fill' }))
    expect(onUpdateShot).toHaveBeenCalledWith(0, { mediaFit: 'cover' })
  })
})

describe('VidrushInspectorPanel video source window', () => {
  it('rejects a too-short in/out range, then stores a valid muted source window', () => {
    const onUpdateShot = vi.fn()
    const value = storyboard()
    value.shots[0] = {
      ...value.shots[0],
      kind: 'video',
      src: '/documentary/backgrounds/bg4.mp4',
      mediaStart: 1,
      mediaEnd: 4,
      mediaMuted: true,
      sourceDuration: 6
    }

    render(
      <VidrushInspectorPanel
        selectedShotIndex={0}
        storyboard={value}
        historySnapshots={[]}
        onUpdateShot={onUpdateShot}
        onOpenAssetPicker={vi.fn()}
        onUpdateStoryboard={vi.fn()}
        onSeekToShot={vi.fn()}
        onRestoreSnapshot={vi.fn()}
      />
    )

    expect(
      screen.getByRole('switch', { name: 'Source audio' })
    ).not.toBeChecked()

    fireEvent.change(screen.getByLabelText('Out point (seconds)'), {
      target: { value: '3.5' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply source window' }))

    expect(screen.getByRole('alert')).toHaveTextContent('at least 3')
    expect(onUpdateShot).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Out point (seconds)'), {
      target: { value: '5' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply source window' }))

    expect(onUpdateShot).toHaveBeenCalledWith(0, {
      mediaStart: 1,
      mediaEnd: 5,
      mediaMuted: true
    })

    fireEvent.click(screen.getByRole('switch', { name: 'Source audio' }))
    expect(onUpdateShot).toHaveBeenCalledWith(0, {
      mediaMuted: false,
      videoVolume: 1
    })
  })

  it('rejects an out point beyond the known source duration', () => {
    const onUpdateShot = vi.fn()
    const value = storyboard()
    value.shots[0] = {
      ...value.shots[0],
      kind: 'video',
      src: '/documentary/backgrounds/bg4.mp4',
      mediaStart: 1,
      mediaEnd: 4,
      mediaMuted: true,
      sourceDuration: 6
    }

    render(
      <VidrushInspectorPanel
        selectedShotIndex={0}
        storyboard={value}
        historySnapshots={[]}
        onUpdateShot={onUpdateShot}
        onOpenAssetPicker={vi.fn()}
        onUpdateStoryboard={vi.fn()}
        onSeekToShot={vi.fn()}
        onRestoreSnapshot={vi.fn()}
      />
    )

    fireEvent.change(screen.getByLabelText('Out point (seconds)'), {
      target: { value: '7' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply source window' }))

    expect(screen.getByRole('alert')).toHaveTextContent('cannot exceed 6')
    expect(onUpdateShot).not.toHaveBeenCalled()
  })

  it('uses an existing positive clip volume when source audio is enabled', () => {
    const onUpdateShot = vi.fn()
    const value = storyboard()
    value.shots[0] = {
      ...value.shots[0],
      kind: 'video',
      src: '/documentary/backgrounds/bg4.mp4',
      mediaMuted: true,
      videoVolume: 0.35
    }

    render(
      <VidrushInspectorPanel
        selectedShotIndex={0}
        storyboard={value}
        historySnapshots={[]}
        onUpdateShot={onUpdateShot}
        onOpenAssetPicker={vi.fn()}
        onUpdateStoryboard={vi.fn()}
        onSeekToShot={vi.fn()}
        onRestoreSnapshot={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('switch', { name: 'Source audio' }))
    expect(onUpdateShot).toHaveBeenCalledWith(0, {
      mediaMuted: false,
      videoVolume: 0.35
    })
  })

  it('mutes source audio without discarding its positive clip volume', () => {
    const onUpdateShot = vi.fn()
    const value = storyboard()
    value.shots[0] = {
      ...value.shots[0],
      kind: 'video',
      src: '/documentary/backgrounds/bg4.mp4',
      mediaMuted: false,
      videoVolume: 0.35
    }

    render(
      <VidrushInspectorPanel
        selectedShotIndex={0}
        storyboard={value}
        historySnapshots={[]}
        onUpdateShot={onUpdateShot}
        onOpenAssetPicker={vi.fn()}
        onUpdateStoryboard={vi.fn()}
        onSeekToShot={vi.fn()}
        onRestoreSnapshot={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('switch', { name: 'Source audio' }))
    expect(onUpdateShot).toHaveBeenCalledWith(0, { mediaMuted: true })
  })
})
