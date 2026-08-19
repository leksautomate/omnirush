import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DocumentaryInspector } from '../documentary-inspector'

import type { StoryboardInput } from '@/remotion/schema'

function storyboard(reconstruction = false): StoryboardInput {
  const now = '2026-08-14T00:00:00.000Z'
  return {
    width: 1920,
    height: 1080,
    fps: 30,
    brand: { accent: '#B6924A' },
    shots: [
      {
        id: 'beat-1',
        kind: 'photo',
        start: 0,
        duration: 5,
        narration: 'By June 1942, the battle approached Midway.',
        documentary: {
          beatType: reconstruction ? 'reconstruction' : 'archival-photo',
          chapterId: 'chapter-1',
          claimIds: ['claim-1'],
          entityIds: [],
          locationIds: ['midway'],
          reconstruction,
          rights: {
            provider: reconstruction ? 'ai-generated' : 'nara',
            sourceUrl: reconstruction
              ? undefined
              : 'https://catalog.archives.gov/id/123',
            institution: reconstruction ? undefined : 'U.S. National Archives',
            license: reconstruction ? 'permission' : 'public-domain',
            reusable: true,
            reviewRequired: false,
            accessedAt: now
          },
          graphic: {
            type: 'date-location',
            date: 'June 1942',
            location: 'Midway Atoll',
            backgroundId: 'bg1'
          }
        }
      }
    ],
    documentaryProject: {
      id: 'doc-1',
      chapters: [
        {
          id: 'chapter-1',
          title: 'Cold Open',
          act: 'cold-open',
          startNarrationOffset: 0,
          endNarrationOffset: 50,
          dateRange: 'June 1942',
          locationIds: ['midway'],
          claimIds: ['claim-1'],
          entityIds: [],
          emotionalObjective: 'Establish the trap.',
          retentionHook: 'Reveal the imbalance.'
        }
      ],
      citations: [
        {
          id: 'citation-1',
          title: 'Battle of Midway',
          url: 'https://www.history.navy.mil/midway',
          authorOrInstitution: 'US Navy',
          accessedAt: now,
          sourceClass: 'institutional',
          supportingNote: 'Documents the battle.',
          reliability: 'high'
        }
      ],
      qa: { publishReady: true, issues: [] }
    }
  }
}

describe('DocumentaryInspector', () => {
  it('shows chapters, claims, rights, QA, and all four backgrounds', () => {
    render(
      <DocumentaryInspector
        storyboard={storyboard()}
        selectedShotIndex={0}
        onUpdateShot={vi.fn()}
      />
    )
    expect(screen.getByText('Cold Open')).toBeTruthy()
    expect(screen.getByText('claim-1')).toBeTruthy()
    expect(screen.getByText('Public domain')).toBeTruthy()
    expect(screen.getByText('Publish ready')).toBeTruthy()
    for (const label of [
      'Dark sepia',
      'Archival parchment',
      'Film gate',
      'Tactical grid'
    ]) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })

  it('edits the opening date without changing narration', () => {
    const onUpdateShot = vi.fn()
    render(
      <DocumentaryInspector
        storyboard={storyboard()}
        selectedShotIndex={0}
        onUpdateShot={onUpdateShot}
      />
    )
    fireEvent.change(screen.getByLabelText('Date label'), {
      target: { value: 'June 4, 1942' }
    })
    expect(onUpdateShot).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        documentary: expect.objectContaining({
          graphic: expect.objectContaining({
            type: 'date-location',
            date: 'June 4, 1942'
          })
        })
      })
    )
    expect(onUpdateShot.mock.calls[0][1]).not.toHaveProperty('narration')
  })

  it('shows reconstruction origin only in the inspector', () => {
    render(
      <DocumentaryInspector
        storyboard={storyboard(true)}
        selectedShotIndex={0}
        onUpdateShot={vi.fn()}
      />
    )
    expect(screen.getByText('AI reconstruction')).toBeTruthy()
  })
})
