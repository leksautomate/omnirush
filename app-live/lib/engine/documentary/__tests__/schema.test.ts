import { describe, expect, it } from 'vitest'

import { resolveContentProfile } from '../preset'
import {
  documentaryProjectSchema,
  evidenceGraphicSchema,
  quoteGraphicSchema
} from '../schema'

function makeValidDocumentaryProject(targetMinutes = 12) {
  const now = '2026-08-14T00:00:00.000Z'
  return {
    id: 'documentary-1',
    profile: {
      niche: 'ww1_ww2',
      format: 'documentary',
      presetVersion: 1
    },
    inputMode: 'script',
    topic: 'The Battle of Midway',
    targetMinutes,
    language: 'English',
    brief: {
      whatTheVideoIsAbout: 'The decisive carrier battle in June 1942.',
      styleOfTalking: 'Cinematic and evidence-led.',
      whoThisVideoIsFor: 'History documentary viewers.',
      keyFacts: ['Station HYPO identified Midway as AF.'],
      inferredFields: []
    },
    narration: 'By June 1942, the Pacific war had reached a turning point.',
    dossier: {
      thesis: 'Intelligence and timing changed the balance in the Pacific.',
      chronology: [],
      claims: [],
      citations: [],
      people: [],
      militaryUnits: [],
      equipment: [],
      locations: [],
      quotations: []
    },
    chapters: [
      {
        id: 'chapter-1',
        title: 'The Trap',
        act: 'cold-open',
        startNarrationOffset: 0,
        endNarrationOffset: 63,
        dateRange: 'June 1942',
        locationIds: [],
        claimIds: [],
        entityIds: [],
        emotionalObjective: 'Establish danger and uncertainty.',
        retentionHook:
          'Could the smaller American force turn the ambush around?'
      }
    ],
    beats: [
      {
        id: 'beat-1',
        chapterId: 'chapter-1',
        type: 'archival-photo',
        narration: 'By June 1942, the Pacific war had reached a turning point.',
        start: 0,
        duration: 5,
        words: [],
        claimIds: [],
        locationIds: [],
        entityIds: [],
        visualQuery: 'Battle of Midway June 1942 archival photograph',
        visualIntent: 'Establish date and theatre.'
      }
    ],
    assets: [],
    qa: { publishReady: true, issues: [] },
    createdAt: now,
    updatedAt: now
  }
}

describe('documentary contract', () => {
  it('resolves niche and format as independent fields', () => {
    expect(resolveContentProfile('ww1_ww2', 'documentary')).toEqual({
      niche: 'ww1_ww2',
      format: 'documentary',
      presetVersion: 1
    })
  })

  it('rejects an evidence card without a citation id', () => {
    expect(
      evidenceGraphicSchema.safeParse({
        type: 'evidence-card',
        documentTitle: 'Station HYPO report',
        institution: 'US Navy',
        date: '1942-05-28',
        excerpt: 'AF is short of water',
        sourceUrl: 'https://www.history.navy.mil/midway',
        backgroundId: 'bg2'
      }).success
    ).toBe(false)
  })

  it('rejects a quotation card without an exact source URL', () => {
    expect(
      quoteGraphicSchema.safeParse({
        type: 'quote-card',
        quote: 'AF is short of water',
        speaker: 'Station HYPO',
        citationId: 'citation-1',
        backgroundId: 'bg1'
      }).success
    ).toBe(false)
  })

  it('accepts projects from thirty seconds through sixty minutes', () => {
    expect(
      documentaryProjectSchema.safeParse(makeValidDocumentaryProject(0.5))
        .success
    ).toBe(true)
    expect(
      documentaryProjectSchema.safeParse(makeValidDocumentaryProject(60))
        .success
    ).toBe(true)
    expect(
      documentaryProjectSchema.safeParse(makeValidDocumentaryProject(60.1))
        .success
    ).toBe(false)
  })
})
