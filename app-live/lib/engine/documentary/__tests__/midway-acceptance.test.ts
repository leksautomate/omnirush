import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildSourceCredits } from '../credits'
import { parseDocumentaryScript } from '../parse-script'
import { runDocumentaryQa } from '../qa'
import {
  type DocumentaryAct,
  type DocumentaryBeat,
  type DocumentaryProject,
  documentaryProjectSchema
} from '../schema'

import { type StoryboardInput, storyboardInputSchema } from '@/remotion/schema'

const fixture = readFileSync(
  join(
    process.cwd(),
    'lib/engine/documentary/__tests__/fixtures/midway-vidrush.txt'
  ),
  'utf8'
)

const now = '2026-08-14T00:00:00.000Z'
const acts: DocumentaryAct[] = [
  'cold-open',
  'strategic-context',
  'build-up',
  'conflict',
  'turning-point',
  'aftermath',
  'epilogue'
]
const claimTexts = [
  'Pearl Harbor began six months of Japanese victories.',
  'The Coral Sea left Shokaku and Zuikaku unavailable for Midway.',
  'Station HYPO confirmed that target AF was Midway.',
  'Yorktown returned to service after roughly seventy-two hours of repair.',
  'American dive bombers struck the Japanese carriers on June 4, 1942.',
  'Japan lost four fleet carriers at Midway.',
  'The battle transferred the strategic initiative to the United States.'
]

function makeBeat(
  index: number,
  type: DocumentaryBeat['type'],
  graphic?: DocumentaryBeat['graphic']
): DocumentaryBeat {
  const narration = claimTexts[index]
  return {
    id: `beat-${index + 1}`,
    chapterId: `chapter-${index + 1}`,
    type,
    narration,
    start: index * 5,
    duration: 5,
    words: [],
    claimIds: [`claim-${index + 1}`],
    dateLabel: index === 0 ? 'June 1942' : undefined,
    locationIds: ['midway'],
    entityIds: [],
    visualQuery: `Midway ${type} ${index + 1}`,
    visualIntent: `${narration} shown through a Midway ${type} visual.`,
    graphic,
    assetId: `asset-${index + 1}`,
    transitionOut: {
      type: index % 2 === 0 ? 'crossfade' : 'film-burn',
      duration: 0.25
    }
  }
}

function makeProject(parsed: ReturnType<typeof parseDocumentaryScript>) {
  const citation = {
    id: 'citation-navy-midway',
    title: 'Battle of Midway historical overview',
    url: 'https://www.history.navy.mil/research/library/online-reading-room/title-list-alphabetically/b/battle-of-midway-4-7-june-1942.html',
    authorOrInstitution: 'Naval History and Heritage Command',
    accessedAt: now,
    sourceClass: 'institutional' as const,
    supportingNote:
      'Institutional overview supporting the chronology and outcome of Midway.',
    reliability: 'high' as const
  }
  const beats: DocumentaryBeat[] = [
    makeBeat(0, 'archival-photo', {
      type: 'date-location',
      date: 'June 1942',
      location: 'Midway Atoll',
      theatre: 'Pacific Ocean',
      backgroundId: 'bg1'
    }),
    makeBeat(1, 'battle-map', {
      type: 'battle-map',
      theatre: 'Central Pacific',
      dateLabel: 'June 4, 1942',
      units: [
        {
          id: 'us-carriers',
          name: 'U.S. carrier force',
          allegiance: 'allied',
          unitType: 'carrier group',
          position: [28, 64],
          claimIds: ['claim-2']
        },
        {
          id: 'japanese-carriers',
          name: 'First Air Fleet',
          allegiance: 'axis',
          unitType: 'carrier group',
          position: [72, 36],
          claimIds: ['claim-2']
        }
      ],
      routes: [
        {
          id: 'route-1',
          label: 'Japanese approach',
          kind: 'attack',
          points: [
            [90, 20],
            [72, 36],
            [55, 50]
          ],
          allegiance: 'axis',
          claimIds: ['claim-2']
        }
      ],
      frontLines: [],
      objectives: [
        {
          id: 'midway-objective',
          label: 'Midway Atoll',
          position: [52, 52],
          allegiance: 'allied',
          claimIds: ['claim-2']
        }
      ],
      annotations: ['Carrier positions are schematic.'],
      backgroundId: 'bg4'
    }),
    makeBeat(2, 'force-comparison', {
      type: 'force-comparison',
      sides: [
        {
          name: 'United States',
          allegiance: 'allied',
          ships: 3,
          highlightedAdvantage: 'Advance warning from Station HYPO',
          claimIds: ['claim-3']
        },
        {
          name: 'Japan',
          allegiance: 'axis',
          ships: 4,
          highlightedAdvantage: 'Experienced carrier air groups',
          claimIds: ['claim-3']
        }
      ],
      backgroundId: 'bg4'
    }),
    makeBeat(3, 'evidence-card', {
      type: 'evidence-card',
      documentTitle: 'Battle of Midway historical overview',
      institution: 'Naval History and Heritage Command',
      date: 'June 1942',
      excerpt: 'Yorktown returned to the Pacific in time for the battle.',
      citationId: citation.id,
      sourceUrl: citation.url,
      backgroundId: 'bg2'
    }),
    makeBeat(4, 'military-timeline', {
      type: 'military-timeline',
      events: [
        {
          id: 'event-1',
          date: 'June 4, 1942 · 10:22',
          title: 'Dive bombers begin their attacks',
          description: 'The carrier decks were caught at a decisive moment.',
          importance: 'critical',
          claimIds: ['claim-5']
        },
        {
          id: 'event-2',
          date: 'June 4, 1942 · evening',
          title: 'Hiryu is disabled',
          importance: 'supporting',
          claimIds: ['claim-5']
        }
      ],
      backgroundId: 'bg2'
    }),
    makeBeat(5, 'reconstruction', {
      type: 'statistics',
      title: 'Japanese fleet carriers lost',
      display: 'counter',
      values: [
        {
          label: 'Fleet carriers',
          value: 4,
          unit: 'ships',
          side: 'axis',
          claimId: 'claim-6'
        }
      ],
      backgroundId: 'bg4'
    }),
    makeBeat(6, 'archival-photo')
  ]

  const project: DocumentaryProject = {
    id: 'doc-midway-acceptance',
    profile: { niche: 'ww1_ww2', format: 'documentary', presetVersion: 1 },
    inputMode: 'script',
    topic: 'The Battle of Midway',
    targetMinutes: 8,
    language: 'English',
    brief: parsed.brief,
    narration: parsed.narration,
    rotationLog: parsed.rotationLog,
    dossier: {
      thesis:
        'Intelligence, emergency repair, and a brief tactical opening reversed the Pacific balance.',
      chronology: claimTexts.map((text, index) => ({
        id: `event-${index + 1}`,
        date: index < 4 ? 'Before June 4, 1942' : 'June 4, 1942',
        title: `Midway development ${index + 1}`,
        description: text,
        importance:
          index >= 4 ? ('critical' as const) : ('supporting' as const),
        claimIds: [`claim-${index + 1}`],
        locationIds: ['midway']
      })),
      claims: claimTexts.map((text, index) => ({
        id: `claim-${index + 1}`,
        text,
        importance: 'critical' as const,
        verification: 'verified' as const,
        citationIds: [citation.id]
      })),
      citations: [citation],
      people: [],
      militaryUnits: [],
      equipment: [],
      locations: [
        {
          id: 'midway',
          name: 'Midway Atoll',
          theatre: 'Pacific Ocean',
          coordinates: [-177.3761, 28.2072],
          claimIds: claimTexts.map((_, index) => `claim-${index + 1}`)
        }
      ],
      quotations: []
    },
    chapters: acts.map((act, index) => ({
      id: `chapter-${index + 1}`,
      title: act
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      act,
      startNarrationOffset: index * 100,
      endNarrationOffset: index * 100 + 99,
      dateRange: index < 4 ? 'Before June 4, 1942' : 'June 4, 1942',
      locationIds: ['midway'],
      claimIds: [`claim-${index + 1}`],
      entityIds: [],
      emotionalObjective: `Deliver the ${act} turn.`,
      retentionHook: `Reveal why ${act} changed the battle.`
    })),
    beats,
    assets: beats.map((beat, index) => {
      const reconstruction = beat.type === 'reconstruction'
      return {
        id: `asset-${index + 1}`,
        beatId: beat.id,
        kind: reconstruction ? ('reconstruction' as const) : ('photo' as const),
        src: reconstruction
          ? undefined
          : `https://catalog.archives.gov/id/${1000 + index}`,
        title: reconstruction
          ? 'Grounded Midway carrier-deck reconstruction'
          : `Midway archival image ${index + 1}`,
        visualIntent: beat.visualIntent,
        claimIds: beat.claimIds,
        rights: {
          provider: reconstruction
            ? ('ai-generated' as const)
            : ('nara' as const),
          sourceUrl: reconstruction
            ? undefined
            : `https://catalog.archives.gov/id/${1000 + index}`,
          institution: reconstruction ? undefined : 'U.S. National Archives',
          license: reconstruction
            ? ('permission' as const)
            : ('public-domain' as const),
          reusable: true,
          reviewRequired: false,
          accessedAt: now
        },
        reconstructionPrompt: reconstruction
          ? 'June 4, 1942, Midway Atoll, accurate 1942 carrier-deck equipment and operational context.'
          : undefined,
        usedInFinalRender: true
      }
    }),
    qa: { publishReady: false, issues: [] },
    createdAt: now,
    updatedAt: now
  }
  return documentaryProjectSchema.parse(project)
}

function makeStoryboard(project: DocumentaryProject): StoryboardInput {
  const qa = runDocumentaryQa(project)
  return storyboardInputSchema.parse({
    width: 1920,
    height: 1080,
    fps: 30,
    brand: { channel: 'Kakkao', accent: '#B6924A' },
    shots: project.beats.map((beat, index) => ({
      id: beat.id,
      kind: 'photo',
      src: project.assets[index].src,
      start: beat.start,
      duration: beat.duration,
      narration: beat.narration,
      transitionOut: beat.transitionOut,
      documentary: {
        beatType: beat.type,
        chapterId: beat.chapterId,
        claimIds: beat.claimIds,
        entityIds: beat.entityIds,
        locationIds: beat.locationIds,
        dateLabel: beat.dateLabel,
        graphic: beat.graphic,
        assetId: beat.assetId,
        rights: project.assets[index].rights,
        reconstruction: beat.type === 'reconstruction',
        filmTreatmentBackgroundId: index === 5 ? 'bg3' : undefined
      }
    })),
    showCaptions: false,
    showSubscribeCta: false,
    documentaryProject: {
      id: project.id,
      chapters: project.chapters,
      citations: project.dossier.citations,
      qa
    }
  })
}

describe('Midway documentary acceptance', () => {
  it('builds the approved evidence-led documentary contract', () => {
    const parsed = parseDocumentaryScript(fixture)
    const project = makeProject(parsed)
    const storyboard = makeStoryboard(project)
    const credits = buildSourceCredits(storyboard)
    const qa = runDocumentaryQa(project, storyboard)

    expect(parsed.openingDate?.year).toBe(1942)
    expect(parsed.narration).not.toMatch(
      /What the Video Is About|Rotation Log/u
    )
    expect(project.chapters.map(chapter => chapter.act)).toEqual(acts)
    expect(project.dossier.claims.map(claim => claim.text).join(' ')).toMatch(
      /Pearl Harbor|Coral Sea|Station HYPO|Yorktown|June 4|four fleet carriers|strategic initiative/iu
    )
    expect(project.beats.map(beat => beat.graphic?.type)).toEqual(
      expect.arrayContaining([
        'date-location',
        'battle-map',
        'force-comparison',
        'evidence-card',
        'military-timeline',
        'statistics'
      ])
    )
    expect(project.assets.every(asset => asset.rights.reusable)).toBe(true)
    expect(
      storyboard.shots.some(shot => shot.documentary?.reconstruction)
    ).toBe(true)
    expect(JSON.stringify(storyboard)).not.toContain('AI-generated scene')
    const backgroundIds = storyboard.shots.flatMap(shot => [
      shot.documentary?.graphic?.backgroundId,
      shot.documentary?.filmTreatmentBackgroundId
    ])
    expect(backgroundIds).toEqual(
      expect.arrayContaining(['bg1', 'bg2', 'bg3', 'bg4'])
    )
    expect(credits.length).toBe(new Set(credits.map(credit => credit.key)).size)
    expect(qa.publishReady).toBe(true)
  })
})
