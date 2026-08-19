import { describe, expect, it } from 'vitest'

import { buildSourceCredits, exportYouTubeCredits } from '../credits'

import type { StoryboardInput } from '@/remotion/schema'

describe('documentary source credits', () => {
  it('includes each used asset once and retains distinct citations', () => {
    const now = '2026-08-14T00:00:00.000Z'
    const storyboard: StoryboardInput = {
      width: 1920,
      height: 1080,
      fps: 30,
      brand: { accent: '#B6924A' },
      shots: [0, 5].map(start => ({
        kind: 'video' as const,
        src: 'https://catalog.archives.gov/midway.mp4',
        start,
        duration: 5,
        documentary: {
          beatType: 'archival-video' as const,
          chapterId: 'chapter-1',
          claimIds: ['claim-1'],
          entityIds: [],
          locationIds: ['midway'],
          reconstruction: false,
          rights: {
            provider: 'nara' as const,
            sourceUrl: 'https://catalog.archives.gov/id/123',
            institution: 'U.S. National Archives',
            license: 'public-domain' as const,
            attribution: 'Battle of Midway footage — NARA',
            reusable: true,
            reviewRequired: false,
            accessedAt: now
          }
        }
      })),
      documentaryProject: {
        id: 'doc-1',
        chapters: [],
        citations: [
          {
            id: 'citation-1',
            title: 'Official Midway history',
            authorOrInstitution: 'US Navy',
            url: 'https://www.history.navy.mil/midway',
            accessedAt: now,
            sourceClass: 'institutional',
            supportingNote: 'Battle chronology.',
            reliability: 'high'
          },
          {
            id: 'citation-2',
            title: 'Midway action report',
            authorOrInstitution: 'U.S. National Archives',
            url: 'https://catalog.archives.gov/id/456',
            accessedAt: now,
            sourceClass: 'primary',
            supportingNote: 'Contemporary action report.',
            reliability: 'high'
          }
        ],
        qa: { publishReady: true, issues: [] }
      }
    }

    const credits = buildSourceCredits(storyboard)
    expect(credits.filter(credit => credit.kind === 'asset')).toHaveLength(1)
    expect(credits.filter(credit => credit.kind === 'citation')).toHaveLength(2)
    expect(new Set(credits.map(credit => credit.key)).size).toBe(credits.length)
    expect(exportYouTubeCredits(storyboard)).toContain(
      'Battle of Midway footage — NARA'
    )
  })
})
