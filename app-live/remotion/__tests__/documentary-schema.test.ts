import { describe, expect, it } from 'vitest'

import { DOCUMENTARY_BACKGROUNDS } from '@/lib/engine/documentary/backgrounds'

import { documentaryGraphicSchema } from '@/remotion/documentary-schema'
import { storyboardInputSchema } from '@/remotion/schema'

function everyGraphicFixture() {
  const claimIds = ['claim-1']
  return [
    {
      type: 'date-location',
      date: 'June 1942',
      location: 'Midway Atoll',
      backgroundId: 'bg1'
    },
    {
      type: 'battle-map',
      theatre: 'Pacific',
      units: [],
      routes: [],
      frontLines: [],
      objectives: [],
      annotations: [],
      backgroundId: 'bg4'
    },
    {
      type: 'military-timeline',
      events: [
        {
          id: 'event-1',
          date: '1942-05-30',
          title: 'Yorktown sails',
          importance: 'critical',
          claimIds
        }
      ],
      backgroundId: 'bg2'
    },
    {
      type: 'force-comparison',
      sides: [
        { name: 'US Task Forces', allegiance: 'allied', claimIds },
        { name: 'First Air Fleet', allegiance: 'axis', claimIds }
      ],
      backgroundId: 'bg4'
    },
    {
      type: 'equipment-spec',
      name: 'Mitsubishi A6M2 Zero',
      role: 'Carrier fighter',
      specifications: [
        { label: 'Top speed', value: 331, unit: 'mph', claimId: 'claim-1' }
      ],
      backgroundId: 'bg4'
    },
    {
      type: 'strategic-overlay',
      theatre: 'Pacific',
      objectives: [],
      routes: [],
      detectionRanges: [],
      defensiveZones: [],
      formations: [],
      backgroundId: 'bg4'
    },
    {
      type: 'evidence-card',
      documentTitle: 'Station HYPO intercept',
      institution: 'US Navy',
      excerpt: 'AF is short of water.',
      citationId: 'citation-1',
      sourceUrl: 'https://www.history.navy.mil/midway',
      backgroundId: 'bg2'
    },
    {
      type: 'quote-card',
      quote: 'They had no right to win.',
      speaker: 'Chester Nimitz',
      citationId: 'citation-1',
      sourceUrl: 'https://www.history.navy.mil/midway',
      backgroundId: 'bg1'
    },
    {
      type: 'statistics',
      title: 'Carrier losses',
      display: 'opposing-sides',
      values: [{ label: 'Carriers', value: 4, claimId: 'claim-1' }],
      backgroundId: 'bg4'
    }
  ]
}

describe('documentary render contract', () => {
  it('parses every documentary graphic variant', () => {
    for (const graphic of everyGraphicFixture()) {
      expect(documentaryGraphicSchema.safeParse(graphic).success).toBe(true)
    }
  })

  it('keeps force comparison generic', () => {
    const parsed = documentaryGraphicSchema.parse(
      everyGraphicFixture().find(item => item.type === 'force-comparison')
    )
    expect(parsed).not.toHaveProperty('lifespan')
    expect(parsed).not.toHaveProperty('cause')
  })

  it('registers all four backgrounds as muted public videos', () => {
    expect(Object.values(DOCUMENTARY_BACKGROUNDS)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'bg1', muted: true }),
        expect.objectContaining({ id: 'bg2', muted: true }),
        expect.objectContaining({ id: 'bg3', muted: true }),
        expect.objectContaining({ id: 'bg4', muted: true })
      ])
    )
  })

  it('accepts documentary metadata without breaking generic storyboards', () => {
    const generic = storyboardInputSchema.parse({
      shots: [{ kind: 'photo', start: 0, duration: 3 }]
    })
    expect(generic.shots).toHaveLength(1)

    const documentary = storyboardInputSchema.parse({
      shots: [
        {
          id: 'beat-1',
          kind: 'photo',
          start: 0,
          duration: 3,
          documentary: {
            beatType: 'archival-photo',
            chapterId: 'chapter-1',
            claimIds: ['claim-1'],
            entityIds: [],
            locationIds: ['midway'],
            graphic: everyGraphicFixture()[0]
          }
        }
      ],
      documentaryProject: {
        id: 'doc-1',
        chapters: [],
        citations: [],
        qa: { publishReady: true, issues: [] }
      }
    })
    expect(documentary.shots[0].documentary?.chapterId).toBe('chapter-1')
  })
})
