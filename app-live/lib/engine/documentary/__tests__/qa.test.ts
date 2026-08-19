import { describe, expect, it } from 'vitest'

import { runDocumentaryQa } from '../qa'
import type { DocumentaryProject } from '../schema'

const now = '2026-08-14T00:00:00.000Z'

function validProject(): DocumentaryProject {
  return {
    id: 'doc-1',
    profile: { niche: 'ww1_ww2', format: 'documentary', presetVersion: 1 },
    inputMode: 'script',
    topic: 'Battle of Midway',
    targetMinutes: 10,
    language: 'English',
    brief: {
      whatTheVideoIsAbout: 'Battle of Midway',
      styleOfTalking: 'Grounded',
      whoThisVideoIsFor: 'History viewers',
      keyFacts: [],
      inferredFields: []
    },
    narration:
      'By June 1942, American intelligence had identified Midway as the target.',
    dossier: {
      thesis: 'Intelligence changed the battle.',
      chronology: [],
      claims: [
        {
          id: 'claim-1',
          text: 'American intelligence identified Midway as the target.',
          importance: 'critical',
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
          supportingNote: 'Documents the intelligence operation.',
          reliability: 'high'
        }
      ],
      people: [],
      militaryUnits: [],
      equipment: [],
      locations: [
        {
          id: 'midway',
          name: 'Midway Atoll',
          coordinates: undefined,
          theatre: 'Pacific',
          claimIds: ['claim-1']
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
        endNarrationOffset: 75,
        dateRange: 'June 1942',
        locationIds: ['midway'],
        claimIds: ['claim-1'],
        entityIds: [],
        emotionalObjective: 'Establish the intelligence advantage.',
        retentionHook: 'Reveal how the code was confirmed.'
      }
    ],
    beats: [
      {
        id: 'beat-1',
        chapterId: 'chapter-1',
        type: 'evidence-card',
        narration:
          'By June 1942, American intelligence had identified Midway as the target.',
        start: 0,
        duration: 8,
        words: [],
        claimIds: ['claim-1'],
        dateLabel: 'June 1942',
        locationIds: ['midway'],
        entityIds: [],
        visualQuery: 'Station HYPO Midway intelligence report',
        visualIntent: 'Show the US Navy evidence identifying Midway.',
        assetId: 'asset-1',
        graphic: {
          type: 'evidence-card',
          documentTitle: 'Station HYPO report',
          institution: 'US Navy',
          excerpt: 'AF was identified as Midway.',
          citationId: 'citation-1',
          sourceUrl: 'https://www.history.navy.mil/midway',
          backgroundId: 'bg2'
        }
      }
    ],
    assets: [
      {
        id: 'asset-1',
        beatId: 'beat-1',
        kind: 'document',
        src: 'https://www.history.navy.mil/midway.jpg',
        title: 'Station HYPO report 1942',
        visualIntent: 'Show the US Navy evidence identifying Midway.',
        claimIds: ['claim-1'],
        rights: {
          provider: 'nara',
          sourceUrl: 'https://catalog.archives.gov/id/123',
          institution: 'U.S. National Archives',
          license: 'public-domain',
          attribution: 'Station HYPO report — NARA',
          reusable: true,
          reviewRequired: false,
          accessedAt: now
        },
        usedInFinalRender: true
      }
    ],
    qa: { publishReady: true, issues: [] },
    createdAt: now,
    updatedAt: now
  }
}

function clone() {
  return structuredClone(validProject())
}

describe('documentary editorial QA', () => {
  it('blocks a missing opening date', () => {
    const project = clone()
    project.narration =
      'American intelligence had identified Midway as the target.'
    expect(runDocumentaryQa(project).issues).toContainEqual(
      expect.objectContaining({
        code: 'opening-date-missing',
        severity: 'blocking'
      })
    )
  })

  it('blocks unsupported and contradicted critical claims', () => {
    const project = clone()
    project.dossier.claims[0].verification = 'contradicted'
    project.dossier.claims[0].citationIds = []
    const report = runDocumentaryQa(project)
    expect(report.publishReady).toBe(false)
    expect(report.issues.map(issue => issue.code)).toEqual(
      expect.arrayContaining([
        'critical-claim-unsupported',
        'historical-entity-contradiction'
      ])
    )
  })

  it('blocks quotation, evidence, and final-asset source failures', () => {
    const project = clone()
    project.dossier.quotations.push({
      id: 'quote-1',
      quote: 'They had no right to win.',
      speaker: 'Chester Nimitz',
      citationId: 'missing-citation',
      sourceUrl: 'https://example.com/missing'
    })
    const graphic = project.beats[0].graphic
    if (graphic?.type === 'evidence-card')
      graphic.citationId = 'missing-citation'
    project.assets[0].rights = {
      provider: 'youtube',
      sourceUrl: 'https://youtube.com/watch?v=abc',
      license: 'standard-youtube',
      reusable: false,
      reviewRequired: true,
      accessedAt: now
    }
    const codes = runDocumentaryQa(project).issues.map(issue => issue.code)
    expect(codes).toEqual(
      expect.arrayContaining([
        'quotation-citation-missing',
        'evidence-source-missing',
        'asset-rights-not-reusable'
      ])
    )
  })

  it('warns for repeated visuals and three consecutive reconstructions', () => {
    const project = clone()
    project.beats = [0, 35, 70].map((start, index) => ({
      ...project.beats[0],
      id: `beat-${index + 1}`,
      type: 'reconstruction' as const,
      start,
      duration: 35,
      assetId: 'asset-1',
      visualQuery: 'same reconstruction'
    }))
    const report = runDocumentaryQa(project)
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'repeated-visual',
          severity: 'warning'
        }),
        expect.objectContaining({
          code: 'excessive-reconstruction',
          severity: 'warning'
        })
      ])
    )
  })

  it('warns after more than ninety seconds without meaningful progression', () => {
    const project = clone()
    project.beats = [0, 50].map((start, index) => ({
      ...project.beats[0],
      id: `beat-${index + 1}`,
      start,
      duration: 50,
      visualQuery: 'same evidence view'
    }))
    expect(runDocumentaryQa(project).issues).toContainEqual(
      expect.objectContaining({ code: 'retention-gap', severity: 'warning' })
    )
  })

  it('leaves a valid project publish-ready', () => {
    expect(runDocumentaryQa(validProject())).toMatchObject({
      publishReady: true,
      issues: []
    })
  })
})
