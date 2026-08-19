import { beforeEach, describe, expect, it, vi } from 'vitest'

const { generateText } = vi.hoisted(() => ({ generateText: vi.fn() }))
vi.mock('ai', async importOriginal => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText
}))

import {
  buildResearchDossier,
  citationCanVerifyCriticalClaim,
  validateDossier
} from '../research'
import type {
  CitationRecord,
  DocumentarySource,
  ResearchDossier
} from '../schema'

const now = '2026-08-14T00:00:00.000Z'

function makeCitation(
  id: string,
  overrides: Partial<CitationRecord> = {}
): CitationRecord {
  return {
    id,
    title: 'The Battle of Midway',
    url: 'https://www.history.navy.mil/browse-by-topic/wars-conflicts-and-operations/world-war-ii/1942/battle-of-midway.html',
    authorOrInstitution: 'Naval History and Heritage Command',
    accessedAt: now,
    sourceClass: 'institutional',
    supportingNote: 'Documents the carrier losses and strategic result.',
    reliability: 'high',
    ...overrides
  }
}

function makeSource(url: string): DocumentarySource {
  return {
    ...makeCitation('source-1'),
    url
  }
}

function makeDossier(
  overrides: Partial<ResearchDossier> = {}
): ResearchDossier {
  return {
    thesis: 'Intelligence and timing changed the balance in the Pacific.',
    chronology: [],
    claims: [],
    citations: [],
    people: [],
    militaryUnits: [],
    equipment: [],
    locations: [],
    quotations: [],
    ...overrides
  }
}

describe('documentary research', () => {
  beforeEach(() => generateText.mockReset())

  it('does not let discovery-only sources verify critical claims', () => {
    expect(
      citationCanVerifyCriticalClaim({
        sourceClass: 'discovery-only',
        reliability: 'medium'
      })
    ).toBe(false)
  })

  it('flags a critical claim whose citations cannot verify it', () => {
    const dossier = makeDossier({
      claims: [
        {
          id: 'claim-1',
          text: 'Japan lost four fleet carriers.',
          importance: 'critical',
          verification: 'verified',
          citationIds: ['citation-1']
        }
      ],
      citations: [
        makeCitation('citation-1', {
          sourceClass: 'discovery-only',
          reliability: 'medium'
        })
      ]
    })

    expect(validateDossier(dossier)).toContainEqual(
      expect.objectContaining({
        code: 'critical-claim-unsupported',
        claimIds: ['claim-1']
      })
    )
  })

  it('flags quotations whose citation URL does not match the exact source', () => {
    const dossier = makeDossier({
      citations: [makeCitation('citation-1')],
      quotations: [
        {
          id: 'quote-1',
          quote: 'They had no right to win.',
          speaker: 'Chester Nimitz',
          citationId: 'citation-1',
          sourceUrl: 'https://example.com/unsourced-quote'
        }
      ]
    })

    expect(validateDossier(dossier)).toContainEqual(
      expect.objectContaining({ code: 'quotation-citation-missing' })
    )
  })

  it('passes only supplied source records to dossier generation', async () => {
    generateText.mockResolvedValue({
      toolCalls: [
        { toolName: 'submit_documentary_object', input: makeDossier() }
      ]
    })
    const source = makeSource('https://www.history.navy.mil/midway')

    await buildResearchDossier('test-model' as never, {
      topic: 'Battle of Midway',
      sources: [source]
    })

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(source.url)
      })
    )
  })
})
