import { type LanguageModel } from 'ai'

import {
  type CitationRecord,
  type DocumentaryQaIssue,
  type DocumentarySource,
  documentarySourceSchema,
  type ResearchDossier,
  researchDossierSchema
} from './schema'
import { generateDocumentaryObject } from './structured-output'

const RESEARCH_SYSTEM = `Build a structured WW1/WW2 research dossier using only the supplied sources.
Never invent a citation, URL, quotation, date, unit, person, location, or equipment model.
Every critical factual claim needs at least one non-discovery source of medium or high reliability.
Use exact quotations only when the supplied source directly supports the words and speaker.
Mark unsupported material unverified and contradictory material contradicted.`

function makeIssue(
  issue: Pick<
    DocumentaryQaIssue,
    'code' | 'severity' | 'message' | 'suggestedAction'
  > &
    Partial<
      Pick<DocumentaryQaIssue, 'claimIds' | 'beatIds' | 'assetIds' | 'evidence'>
    >
): DocumentaryQaIssue {
  return {
    claimIds: [],
    beatIds: [],
    assetIds: [],
    ...issue
  }
}

export function citationCanVerifyCriticalClaim(
  citation: Pick<CitationRecord, 'sourceClass' | 'reliability'>
) {
  return (
    citation.sourceClass !== 'discovery-only' && citation.reliability !== 'low'
  )
}

export function validateDossier(
  dossier: ResearchDossier
): DocumentaryQaIssue[] {
  const issues: DocumentaryQaIssue[] = []
  const citationsById = new Map(
    dossier.citations.map(citation => [citation.id, citation])
  )

  for (const claim of dossier.claims) {
    const citations = claim.citationIds.flatMap(id => {
      const citation = citationsById.get(id)
      return citation ? [citation] : []
    })
    const hasVerifyingCitation = citations.some(citationCanVerifyCriticalClaim)

    if (
      claim.importance === 'critical' &&
      (claim.verification !== 'verified' || !hasVerifyingCitation)
    ) {
      issues.push(
        makeIssue({
          code: 'critical-claim-unsupported',
          severity: 'blocking',
          message: `Critical claim is not supported by a qualifying source: ${claim.text}`,
          claimIds: [claim.id],
          evidence:
            citations.map(citation => citation.url).join('\n') || undefined,
          suggestedAction:
            'Add a primary, institutional, or reliable secondary citation, or correct the claim.'
        })
      )
    }

    if (claim.verification === 'contradicted') {
      issues.push(
        makeIssue({
          code: 'historical-entity-contradiction',
          severity: 'blocking',
          message: `A researched claim is contradicted: ${claim.text}`,
          claimIds: [claim.id],
          suggestedAction:
            claim.suggestedCorrection ??
            'Resolve the contradiction against the cited historical record.'
        })
      )
    } else if (claim.verification === 'disputed') {
      issues.push(
        makeIssue({
          code: 'disputed-claim',
          severity: 'warning',
          message: `A researched claim is disputed: ${claim.text}`,
          claimIds: [claim.id],
          suggestedAction:
            'Present the disagreement in narration or remove the disputed claim.'
        })
      )
    }
  }

  for (const quotation of dossier.quotations) {
    const citation = citationsById.get(quotation.citationId)
    if (!citation || citation.url !== quotation.sourceUrl) {
      issues.push(
        makeIssue({
          code: 'quotation-citation-missing',
          severity: 'blocking',
          message: `Quotation from ${quotation.speaker} lacks a matching exact source.`,
          claimIds: [],
          evidence: quotation.quote,
          suggestedAction:
            'Attach the exact citation URL for the quotation or render the statement as a paraphrase.'
        })
      )
    }
  }

  return issues
}

export async function buildResearchDossier(
  model: LanguageModel,
  input: {
    topic: string
    narration?: string
    sources: DocumentarySource[]
  }
): Promise<ResearchDossier> {
  const sources = input.sources.map(source =>
    documentarySourceSchema.parse(source)
  )
  const object = await generateDocumentaryObject({
    model,
    schema: researchDossierSchema,
    system: RESEARCH_SYSTEM,
    prompt: JSON.stringify({
      topic: input.topic,
      narration: input.narration,
      sources
    }),
    maxOutputTokens: 8000
  })
  const dossier = researchDossierSchema.parse(object)
  const suppliedUrls = new Set(sources.map(source => source.url))
  const inventedCitation = dossier.citations.find(
    citation => !suppliedUrls.has(citation.url)
  )

  if (inventedCitation) {
    throw new Error(
      `Dossier contains a citation URL that was not supplied: ${inventedCitation.url}`
    )
  }

  return dossier
}
