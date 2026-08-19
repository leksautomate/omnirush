import React from 'react'

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { FootageSection } from '../footage-section'

function renderFootage(best: Record<string, unknown>) {
  return render(
    <FootageSection
      tool={
        {
          state: 'output-available',
          input: { queries: ['Battle of Kursk 1943'] },
          output: {
            state: 'complete',
            visionVerified: true,
            best,
            candidates: [best]
          }
        } as never
      }
      isOpen
      onOpenChange={() => undefined}
    />
  )
}

describe('FootageSection selected shot preview', () => {
  it('renders a resolved video selection as a playable clip', () => {
    const { container } = renderFootage({
      kind: 'video',
      src: 'https://archive.org/download/kursk/kursk.mp4',
      thumb: 'https://archive.org/services/img/kursk',
      title: 'Battle of Kursk archival film',
      source: 'Internet Archive',
      needsResolve: false
    })

    const video = container.querySelector('video')
    expect(video).not.toBeNull()
    expect(video?.getAttribute('src')).toBe(
      'https://archive.org/download/kursk/kursk.mp4'
    )
    expect(video?.getAttribute('poster')).toBe(
      'https://archive.org/services/img/kursk'
    )
    expect(video?.hasAttribute('controls')).toBe(true)
  })

  it('renders the selected photo from src instead of its thumbnail', () => {
    const { container } = renderFootage({
      kind: 'photo',
      src: 'https://upload.wikimedia.org/original-la5.jpg',
      thumb: 'https://upload.wikimedia.org/1280px-la5.jpg',
      title: 'Lavochkin La-5',
      source: 'Wikimedia Commons'
    })

    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://upload.wikimedia.org/original-la5.jpg'
    )
  })

  it('upgrades a saved Wikimedia thumbnail URL to the original file', () => {
    const { container } = renderFootage({
      kind: 'photo',
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Lavochkin_La-5.jpg/1280px-Lavochkin_La-5.jpg?utm_source=commons',
      thumb:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Lavochkin_La-5.jpg/1280px-Lavochkin_La-5.jpg',
      title: 'Lavochkin La-5',
      source: 'Wikimedia Commons'
    })

    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/a/ab/Lavochkin_La-5.jpg'
    )
  })
})
