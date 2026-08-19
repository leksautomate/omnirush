import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ResizableTimelinePane } from '../resizable-timeline-pane'

const originalInnerHeight = window.innerHeight

function setViewportHeight(height: number) {
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: height
  })
}

afterEach(() => setViewportHeight(originalInnerHeight))

describe('ResizableTimelinePane', () => {
  it('gives its child the full safe content height', async () => {
    setViewportHeight(900)
    render(
      <ResizableTimelinePane>
        <div data-testid="timeline-child" className="h-full" />
      </ResizableTimelinePane>
    )

    const content = screen.getByTestId('timeline-pane-content')
    await waitFor(() => expect(content.style.height).toBe('336px'))
    expect(screen.getByTestId('timeline-child').className).toContain('h-full')
    expect(content.className).toContain('min-h-0')
  })

  it('supports drag, keyboard, reset, and safe clamping', async () => {
    setViewportHeight(900)
    render(
      <ResizableTimelinePane>
        <div />
      </ResizableTimelinePane>
    )
    const separator = screen.getByRole('separator', {
      name: 'Resize timeline'
    })
    const content = screen.getByTestId('timeline-pane-content')

    fireEvent.mouseDown(separator, { clientY: 500 })
    fireEvent.mouseMove(window, { clientY: 300 })
    expect(content.style.height).toBe('480px')
    expect(separator.getAttribute('aria-valuenow')).toBe('480')
    fireEvent.mouseUp(window)

    for (let index = 0; index < 20; index += 1) {
      fireEvent.keyDown(separator, { key: 'ArrowDown' })
    }
    expect(content.style.height).toBe('320px')

    fireEvent.keyDown(separator, { key: 'ArrowUp' })
    expect(content.style.height).toBe('336px')
    fireEvent.doubleClick(separator)
    expect(content.style.height).toBe('336px')
  })

  it('clamps initial, reset, and current height when the viewport changes', async () => {
    setViewportHeight(500)
    render(
      <ResizableTimelinePane>
        <div />
      </ResizableTimelinePane>
    )
    const separator = screen.getByRole('separator', {
      name: 'Resize timeline'
    })
    const content = screen.getByTestId('timeline-pane-content')

    await waitFor(() => expect(content.style.height).toBe('320px'))
    fireEvent.doubleClick(separator)
    expect(content.style.height).toBe('320px')

    setViewportHeight(1000)
    fireEvent(window, new Event('resize'))
    fireEvent.doubleClick(separator)
    expect(content.style.height).toBe('336px')

    for (let index = 0; index < 20; index += 1) {
      fireEvent.keyDown(separator, { key: 'ArrowUp' })
    }
    expect(content.style.height).toBe('480px')
    setViewportHeight(600)
    fireEvent(window, new Event('resize'))
    expect(content.style.height).toBe('330px')
  })
})
