import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { VidrushMultiTrackTimeline } from '../vidrush-multi-track-timeline'

import type { Shot } from '@/remotion/schema'

const shots: Shot[] = [
  {
    id: 'opening',
    kind: 'photo',
    start: 0,
    duration: 90,
    narration: 'Opening'
  },
  {
    id: 'ending',
    kind: 'photo',
    start: 90,
    duration: 100,
    narration: 'Ending'
  }
]

function props(selectedShotIndex = 0) {
  return {
    shots,
    currentFrame: 0,
    fps: 30,
    totalDurationSec: 190,
    selectedShotIndex,
    accent: '#ff6b00',
    onSelectShot: vi.fn(),
    onSeekFrame: vi.fn(),
    onOpenTransitionModal: vi.fn(),
    onOpenAssetPicker: vi.fn(),
    onAddShot: vi.fn()
  }
}

function measureViewport(viewport: HTMLElement, width = 1000) {
  const trackBody = screen.getByTestId('timeline-track-body')
  Object.defineProperty(viewport, 'clientWidth', {
    configurable: true,
    value: width
  })
  Object.defineProperty(viewport, 'scrollWidth', {
    configurable: true,
    get: () => 144 + Number.parseFloat(trackBody.style.width || '0')
  })
  fireEvent(window, new Event('resize'))
}

describe('VidrushMultiTrackTimeline', () => {
  it('fits the complete 190-second project into the measured viewport', async () => {
    render(<VidrushMultiTrackTimeline {...props()} />)
    const viewport = screen.getByTestId('timeline-scroll-viewport')
    measureViewport(viewport)

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: 'Fit timeline' })
          .getAttribute('aria-pressed')
      ).toBe('true')
      expect(screen.getByTestId('timeline-track-body').style.width).toBe(
        '856px'
      )
      expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
      expect(screen.getByTestId('timeline-root').className).toContain('h-full')
    })
  })

  it('leaves Fit mode when zoom is changed manually', async () => {
    render(<VidrushMultiTrackTimeline {...props()} />)
    const viewport = screen.getByTestId('timeline-scroll-viewport')
    measureViewport(viewport)

    const fit = screen.getByRole('button', { name: 'Fit timeline' })
    await waitFor(() => expect(fit.getAttribute('aria-pressed')).toBe('true'))
    fireEvent.click(screen.getByTitle('Zoom In'))

    expect(fit.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('timeline-track-body').style.width).not.toBe(
      '856px'
    )

    fireEvent.click(fit)
    await waitFor(() => expect(fit.getAttribute('aria-pressed')).toBe('true'))
    expect(screen.getByTestId('timeline-track-body').style.width).toBe('856px')
  })

  it('centers the selected shot midpoint when the timeline is scrollable', async () => {
    const scrollTo = vi.fn()
    const { rerender } = render(<VidrushMultiTrackTimeline {...props(0)} />)
    const viewport = screen.getByTestId('timeline-scroll-viewport')
    Object.defineProperty(viewport, 'scrollTo', {
      configurable: true,
      value: scrollTo
    })
    measureViewport(viewport)
    fireEvent.click(screen.getByTitle('Zoom In'))
    scrollTo.mockClear()

    rerender(<VidrushMultiTrackTimeline {...props(1)} />)

    await waitFor(() => {
      expect(scrollTo).toHaveBeenCalledWith(
        expect.objectContaining({
          behavior: 'smooth',
          left: expect.any(Number)
        })
      )
    })
    expect(scrollTo.mock.calls.at(-1)?.[0].left).toBeGreaterThan(1500)
  })

  it('moves the compact overview range with horizontal scrolling', async () => {
    render(<VidrushMultiTrackTimeline {...props()} />)
    const viewport = screen.getByTestId('timeline-scroll-viewport')
    measureViewport(viewport)
    fireEvent.click(screen.getByTitle('Zoom In'))

    Object.defineProperty(viewport, 'scrollLeft', {
      configurable: true,
      value: 500
    })
    fireEvent.scroll(viewport)

    const range = screen.getByLabelText('Visible timeline range')
    await waitFor(() => {
      expect(Number.parseFloat(range.style.left)).toBeGreaterThan(10)
      expect(Number.parseFloat(range.style.width)).toBeLessThan(30)
    })
  })
})
