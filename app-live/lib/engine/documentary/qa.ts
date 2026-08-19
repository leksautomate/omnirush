import { extractOpeningDate } from './parse-script'
import { validateDossier } from './research'
import { canUseInFinalRender } from './rights'
import type {
  DocumentaryBeat,
  DocumentaryProject,
  DocumentaryQaIssue,
  DocumentaryQaReport
} from './schema'

import type { StoryboardInput } from '@/remotion/schema'

function issue(
  value: Pick<
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
    ...value
  }
}

function checkOpeningDate(project: DocumentaryProject) {
  if (extractOpeningDate(project.narration)) return []
  return [
    issue({
      code: 'opening-date-missing',
      severity: 'blocking',
      message:
        'The documentary does not begin with a concrete historical date.',
      suggestedAction:
        'Add a sourced year/date to the first narration sentence without changing other narration.'
    })
  ]
}

function checkQuotesAndEvidence(project: DocumentaryProject) {
  const issues: DocumentaryQaIssue[] = []
  const citations = new Map(
    project.dossier.citations.map(citation => [citation.id, citation])
  )
  for (const beat of project.beats) {
    const graphic = beat.graphic
    if (graphic?.type === 'evidence-card') {
      const citation = citations.get(graphic.citationId)
      if (!citation || citation.url !== graphic.sourceUrl) {
        issues.push(
          issue({
            code: 'evidence-source-missing',
            severity: 'blocking',
            message: `Evidence card ${beat.id} has no matching source record.`,
            beatIds: [beat.id],
            suggestedAction:
              'Attach the matching citation ID and source URL or remove the evidence card.'
          })
        )
      }
    }
    if (graphic?.type === 'quote-card') {
      const citation = citations.get(graphic.citationId)
      if (!citation || citation.url !== graphic.sourceUrl) {
        issues.push(
          issue({
            code: 'quotation-citation-missing',
            severity: 'blocking',
            message: `Quote card ${beat.id} has no exact matching citation.`,
            beatIds: [beat.id],
            suggestedAction:
              'Attach the exact quotation source or render the words as a paraphrase.'
          })
        )
      }
    }
  }
  return issues
}

function checkAssetRights(project: DocumentaryProject) {
  return project.assets.flatMap(asset => {
    if (!asset.usedInFinalRender || canUseInFinalRender(asset.rights)) return []
    return [
      issue({
        code: 'asset-rights-not-reusable',
        severity: 'blocking',
        message: `Final-render asset ${asset.id} is not licensed for reuse.`,
        assetIds: [asset.id],
        beatIds: [asset.beatId],
        evidence: `${asset.rights.provider}: ${asset.rights.license}`,
        suggestedAction:
          'Replace it with reusable archival media, an explanatory graphic, or a grounded reconstruction.'
      })
    ]
  })
}

function meaningfulWords(value: string) {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .filter(word => word.length >= 5)
  )
}

function sharesMeaning(left: string, right: string) {
  const leftWords = meaningfulWords(left)
  const rightWords = meaningfulWords(right)
  return [...leftWords].some(word => rightWords.has(word))
}

function yearIn(value: string | undefined) {
  return value?.match(/\b(1[89]\d{2}|20\d{2})\b/u)?.[1]
}

function checkRepeatedAndMismatchedVisuals(project: DocumentaryProject) {
  const issues: DocumentaryQaIssue[] = []
  const assets = new Map(project.assets.map(asset => [asset.id, asset]))
  for (let index = 0; index < project.beats.length; index += 1) {
    const beat = project.beats[index]
    const previous = project.beats[index - 1]
    if (
      previous &&
      ((beat.assetId && beat.assetId === previous.assetId) ||
        beat.visualQuery === previous.visualQuery)
    ) {
      issues.push(
        issue({
          code: 'repeated-visual',
          severity: 'warning',
          message: `Adjacent beats ${previous.id} and ${beat.id} repeat the same visual.`,
          beatIds: [previous.id, beat.id],
          suggestedAction:
            'Replace one scene with a map, document, statistic, or different archival angle.'
        })
      )
    }

    if (!sharesMeaning(beat.narration, beat.visualIntent)) {
      issues.push(
        issue({
          code: 'visual-narration-mismatch',
          severity: 'warning',
          message: `Beat ${beat.id} visual intent has weak subject overlap with its narration.`,
          beatIds: [beat.id],
          suggestedAction:
            'Revise the visual intent or choose an asset that directly supports the spoken subject.'
        })
      )
    }

    const asset = beat.assetId ? assets.get(beat.assetId) : undefined
    const narrationYear = yearIn(beat.dateLabel ?? beat.narration)
    const assetYear = yearIn(asset?.title)
    if (narrationYear && assetYear && narrationYear !== assetYear) {
      issues.push(
        issue({
          code: 'visual-subject-mismatch',
          severity: 'warning',
          message: `Beat ${beat.id} is dated ${narrationYear}, but its asset title indicates ${assetYear}.`,
          beatIds: [beat.id],
          assetIds: asset ? [asset.id] : [],
          suggestedAction:
            'Verify the subject/model/year or replace the asset with the correct historical material.'
        })
      )
    }
  }
  return issues
}

function progressionSignature(beat: DocumentaryBeat) {
  return JSON.stringify({
    chapterId: beat.chapterId,
    type: beat.type,
    claimIds: beat.claimIds,
    locationIds: beat.locationIds,
    visualQuery: beat.visualQuery
  })
}

function checkRetentionProgression(project: DocumentaryProject) {
  if (project.beats.length < 2) return []
  let signature = progressionSignature(project.beats[0])
  let runStart = project.beats[0].start

  for (let index = 1; index < project.beats.length; index += 1) {
    const beat = project.beats[index]
    const nextSignature = progressionSignature(beat)
    if (nextSignature !== signature) {
      signature = nextSignature
      runStart = beat.start
      continue
    }
    if (beat.start + beat.duration - runStart > 90) {
      return [
        issue({
          code: 'retention-gap',
          severity: 'warning',
          message:
            'More than 90 seconds pass without meaningful visual or narrative progression.',
          beatIds: project.beats.slice(0, index + 1).map(item => item.id),
          suggestedAction:
            'Add a new claim, location, chapter turn, statistic, document, or explanatory graphic.'
        })
      ]
    }
  }
  return []
}

function checkReconstructionRuns(project: DocumentaryProject) {
  let run: DocumentaryBeat[] = []
  for (const beat of project.beats) {
    if (beat.type === 'reconstruction') {
      run.push(beat)
      if (run.length === 3) {
        return [
          issue({
            code: 'excessive-reconstruction',
            severity: 'warning',
            message:
              'Three consecutive reconstruction beats reduce archival credibility.',
            beatIds: run.map(item => item.id),
            suggestedAction:
              'Break the sequence with a map, document, photograph, timeline, or statistics scene.'
          })
        ]
      }
    } else {
      run = []
    }
  }
  return []
}

function checkAttribution(project: DocumentaryProject) {
  return project.assets.flatMap(asset => {
    const requiresAttribution = ['cc-by', 'cc-by-sa'].includes(
      asset.rights.license
    )
    if (
      !asset.usedInFinalRender ||
      !requiresAttribution ||
      asset.rights.attribution ||
      asset.rights.creator
    ) {
      return []
    }
    return [
      issue({
        code: 'attribution-detail-missing',
        severity: 'warning',
        message: `Asset ${asset.id} requires attribution details.`,
        assetIds: [asset.id],
        suggestedAction:
          'Record the creator and required attribution text before publishing.'
      })
    ]
  })
}

function deduplicateIssues(issues: DocumentaryQaIssue[]) {
  const seen = new Set<string>()
  return issues.filter(item => {
    const key = [
      item.code,
      ...item.claimIds,
      ...item.beatIds,
      ...item.assetIds
    ].join(':')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function runDocumentaryQa(
  project: DocumentaryProject,
  _storyboard?: StoryboardInput
): DocumentaryQaReport {
  const issues = deduplicateIssues([
    ...project.qa.issues,
    ...checkOpeningDate(project),
    ...validateDossier(project.dossier),
    ...checkQuotesAndEvidence(project),
    ...checkAssetRights(project),
    ...checkRepeatedAndMismatchedVisuals(project),
    ...checkRetentionProgression(project),
    ...checkReconstructionRuns(project),
    ...checkAttribution(project)
  ])
  return {
    publishReady: !issues.some(item => item.severity === 'blocking'),
    issues
  }
}
