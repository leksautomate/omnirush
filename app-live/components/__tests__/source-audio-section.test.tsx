import React from 'react'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SourceAudioSection } from '../source-audio-section'

describe('SourceAudioSection', () => {
  it('renders a completed audio cue while its streamed tool input is missing', () => {
    render(
      <SourceAudioSection
        tool={
          {
            state: 'output-available',
            output: {
              state: 'complete',
              audioCue: {
                id: 'airfield-ambience',
                kind: 'ambient',
                src: '/audio/ambience/airfield.mp3',
                start: 0,
                duration: 30,
                volume: 0.2,
                loop: true,
                fadeIn: 1,
                fadeOut: 2
              }
            }
          } as never
        }
        isOpen={false}
        onOpenChange={() => undefined}
      />
    )

    expect(screen.getByText('Ambience')).not.toBeNull()
    expect(screen.getByText('Added at 0.0s')).not.toBeNull()
  })
})
