import { beforeEach, describe, expect, it, vi } from 'vitest'

const { cutScriptIntoBeats } = vi.hoisted(() => ({
  cutScriptIntoBeats: vi.fn()
}))
vi.mock('@/lib/engine/beats', () => ({ cutScriptIntoBeats }))

import {
  chooseBackgroundRole,
  chooseGraphicInstruction,
  planDocumentaryBeats,
  type PlannerContext
} from '../planner'
import type { DocumentaryProject } from '../schema'

function makeProject(): DocumentaryProject {
  const now = '2026-08-14T00:00:00.000Z'
  return {
    id: 'doc-1',
    profile: { niche: 'ww1_ww2', format: 'documentary', presetVersion: 1 },
    inputMode: 'script',
    topic: 'Battle of Midway',
    targetMinutes: 12,
    language: 'English',
    brief: {
      whatTheVideoIsAbout: 'The Battle of Midway',
      styleOfTalking: 'Grounded documentary',
      whoThisVideoIsFor: 'Military history viewers',
      keyFacts: [],
      inferredFields: []
    },
    narration:
      'By June 1942, American forces were waiting at Midway Atoll. Four Japanese carriers faced three American carriers.',
    dossier: {
      thesis: 'Intelligence changed the battle.',
      chronology: [
        {
          id: 'event-1',
          date: '1942-05-27',
          title: 'Yorktown enters dry dock',
          description: 'Repairs begin.',
          importance: 'supporting',
          claimIds: ['claim-repair'],
          locationIds: ['pearl-harbor']
        },
        {
          id: 'event-2',
          date: '1942-05-30',
          title: 'Yorktown sails',
          description: 'The carrier returns to service.',
          importance: 'critical',
          claimIds: ['claim-repair'],
          locationIds: ['pearl-harbor']
        }
      ],
      claims: [
        {
          id: 'claim-forces',
          text: 'Four Japanese carriers faced three American carriers.',
          importance: 'critical',
          verification: 'verified',
          citationIds: ['citation-1']
        },
        {
          id: 'claim-repair',
          text: 'Yorktown was repaired between May 27 and May 30.',
          importance: 'supporting',
          verification: 'verified',
          citationIds: ['citation-1']
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
      people: [],
      militaryUnits: [
        {
          id: 'us-carriers',
          name: 'US carrier force',
          kind: 'military-unit',
          allegiance: 'allied',
          role: 'Carrier task forces',
          claimIds: ['claim-forces']
        },
        {
          id: 'japanese-carriers',
          name: 'First Air Fleet',
          kind: 'military-unit',
          allegiance: 'axis',
          role: 'Carrier striking force',
          claimIds: ['claim-forces']
        }
      ],
      equipment: [
        {
          id: 'zero',
          name: 'Mitsubishi A6M2 Zero',
          model: 'A6M2',
          serviceYear: 1940,
          role: 'Carrier fighter',
          specifications: [
            {
              label: 'Top speed',
              value: 331,
              unit: 'mph',
              claimId: 'claim-forces'
            }
          ],
          claimIds: ['claim-forces']
        }
      ],
      locations: [
        {
          id: 'midway',
          name: 'Midway Atoll',
          theatre: 'Pacific',
          coordinates: [-177.376, 28.207],
          claimIds: ['claim-forces']
        },
        {
          id: 'pearl-harbor',
          name: 'Pearl Harbor',
          theatre: 'Pacific',
          coordinates: [-157.95, 21.36],
          claimIds: ['claim-repair']
        }
      ],
      quotations: []
    },
    chapters: [
      {
        id: 'chapter-1',
        title: 'The Trap',
        act: 'cold-open',
        startNarrationOffset: 0,
        endNarrationOffset: 60,
        dateRange: 'June 1942',
        locationIds: ['midway'],
        claimIds: ['claim-forces'],
        entityIds: ['us-carriers', 'japanese-carriers'],
        emotionalObjective: 'Establish the trap.',
        retentionHook: 'Reveal the imbalance.'
      },
      {
        id: 'chapter-2',
        title: 'The Forces',
        act: 'strategic-context',
        startNarrationOffset: 60,
        endNarrationOffset: 116,
        locationIds: ['midway'],
        claimIds: ['claim-forces'],
        entityIds: ['us-carriers', 'japanese-carriers'],
        emotionalObjective: 'Compare the fleets.',
        retentionHook: 'Explain the hidden advantage.'
      }
    ],
    beats: [],
    assets: [],
    qa: { publishReady: true, issues: [] },
    createdAt: now,
    updatedAt: now
  }
}

function context(narration: string): PlannerContext {
  return {
    narration,
    project: makeProject(),
    chapter: makeProject().chapters[0],
    claimIds: ['claim-forces', 'claim-repair'],
    locationIds: ['midway', 'pearl-harbor'],
    entityIds: ['us-carriers', 'japanese-carriers', 'zero'],
    forceOpening: false
  }
}

describe('documentary graphic planning', () => {
  it.each([
    ['movement from Pearl Harbor toward Midway Atoll', 'battle-map'],
    ['repairs completed between May 27 and May 30', 'military-timeline'],
    [
      'four Japanese carriers faced three American carriers',
      'force-comparison'
    ],
    ['the Mitsubishi A6M2 Zero had a top speed of 331 mph', 'equipment-spec'],
    [
      'the decrypted Station HYPO message showed AF was Midway',
      'evidence-card'
    ],
    ['Japan lost four carriers and 248 aircraft', 'statistics']
  ])('maps narration to a %s treatment', (narration, expectedType) => {
    expect(chooseGraphicInstruction(context(narration))?.type).toBe(
      expectedType
    )
  })

  it('uses the dark opening background and tactical map backgrounds', () => {
    expect(chooseBackgroundRole('date-location')).toBe('bg1')
    expect(chooseBackgroundRole('battle-map')).toBe('bg4')
  })

  it('assigns date/location and semantic metadata to planned beats', async () => {
    cutScriptIntoBeats.mockResolvedValue({
      topic: 'Battle of Midway',
      format: '16:9',
      width: 1280,
      height: 720,
      fps: 30,
      brand: { channel: 'Kakkao', accent: '#B6924A' },
      totalSeconds: 8,
      estimatedTimings: true,
      shots: [
        {
          narration:
            'By June 1942, American forces were waiting at Midway Atoll.',
          kind: 'photo',
          visualQuery: 'Midway Atoll 1942',
          visualIntent: 'Establish Midway.',
          start: 0,
          duration: 4,
          words: []
        },
        {
          narration: 'Four Japanese carriers faced three American carriers.',
          kind: 'video',
          visualQuery: 'carrier forces Midway',
          visualIntent: 'Compare the carrier forces.',
          start: 4,
          duration: 4,
          words: []
        }
      ]
    })

    const beats = await planDocumentaryBeats('test-model', makeProject())

    expect(beats[0]).toEqual(
      expect.objectContaining({
        chapterId: 'chapter-1',
        dateLabel: expect.stringContaining('1942'),
        graphic: expect.objectContaining({ type: 'date-location' }),
        locationIds: ['midway']
      })
    )
    expect(beats[1]).toEqual(
      expect.objectContaining({
        chapterId: 'chapter-2',
        claimIds: ['claim-forces'],
        graphic: expect.objectContaining({ type: 'force-comparison' })
      })
    )
  })

  it('normalizes pacing after documentary metadata has been planned', async () => {
    const firstNarration =
      'By June 1942, American forces were waiting at Midway Atoll.'
    const secondNarration =
      'Four Japanese carriers faced three American carriers.'
    const timedWords = (narration: string, start: number, duration: number) => {
      const tokens = narration.split(/\s+/)
      return tokens.map((word, index) => ({
        word,
        start: start + (index * duration) / tokens.length,
        end: start + ((index + 1) * duration) / tokens.length
      }))
    }
    cutScriptIntoBeats.mockResolvedValue({
      topic: 'Battle of Midway',
      format: '16:9',
      width: 1280,
      height: 720,
      fps: 30,
      brand: { channel: 'Kakkao', accent: '#B6924A' },
      totalSeconds: 12,
      estimatedTimings: false,
      shots: [
        {
          narration: firstNarration,
          kind: 'photo',
          visualQuery: 'Midway Atoll 1942',
          visualIntent: 'Establish Midway.',
          start: 0,
          duration: 6,
          words: timedWords(firstNarration, 0, 6)
        },
        {
          narration: secondNarration,
          kind: 'video',
          visualQuery: 'carrier forces Midway',
          visualIntent: 'Compare the carrier forces.',
          start: 6,
          duration: 6,
          words: timedWords(secondNarration, 6, 6)
        }
      ]
    })

    const beats = await planDocumentaryBeats('test-model', makeProject())

    expect(cutScriptIntoBeats).toHaveBeenCalledWith(
      'test-model',
      expect.objectContaining({
        profile: {
          niche: 'ww1_ww2',
          format: 'documentary',
          presetVersion: 1
        },
        deferDocumentaryPacing: true
      }),
      undefined
    )
    expect(beats).toHaveLength(1)
    expect(beats[0]).toEqual(
      expect.objectContaining({
        id: 'beat-1',
        start: 0,
        duration: 12,
        narration: `${firstNarration} ${secondNarration}`,
        claimIds: ['claim-forces'],
        locationIds: ['midway'],
        entityIds: ['us-carriers', 'japanese-carriers'],
        visualQuery: 'Midway Atoll 1942 | carrier forces Midway',
        visualIntent: 'Establish Midway. Compare the carrier forces.'
      })
    )
    expect(beats[0].words).toHaveLength(17)
  })
})
