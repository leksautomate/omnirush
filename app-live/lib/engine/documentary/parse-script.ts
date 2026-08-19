import type {
  DocumentaryBrief,
  DocumentaryQaIssue,
  RotationLog
} from './schema'

const HEADING_DEFINITIONS = [
  {
    key: 'whatTheVideoIsAbout',
    pattern: /(?:🎥\s*)?What the Video Is About\s*/iu
  },
  {
    key: 'styleOfTalking',
    pattern: /(?:🗣️\s*)?Style of Talking\s*/iu
  },
  {
    key: 'whoThisVideoIsFor',
    pattern: /(?:🎯\s*)?Who This Video Is For\s*/iu
  },
  {
    key: 'keyFacts',
    pattern: /(?:📌\s*)?Key Facts Covered\s*/iu
  }
] as const

const ROTATION_PATTERN = /(?:🔄\s*)?Rotation Log\s*/iu
const MONTH_OR_SEASON =
  '(?:(?:the\\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december|spring|summer|autumn|fall|winter)(?:\\s+of)?(?:\\s+\\d{1,2}(?:st|nd|rd|th)?,?)?\\s+)?'
const OPENING_DATE = new RegExp(
  `\\b(?:(?:by|on|in|between|during)\\s+)?${MONTH_OR_SEASON}(1[89]\\d{2}|20\\d{2})\\b`,
  'i'
)

type BriefField =
  | 'whatTheVideoIsAbout'
  | 'styleOfTalking'
  | 'whoThisVideoIsFor'
  | 'keyFacts'

interface SectionMarker {
  key: BriefField
  index: number
  contentStart: number
}

export interface ParsedDocumentaryScript {
  originalText: string
  brief: DocumentaryBrief
  narration: string
  cta?: string
  rotationLog?: RotationLog
  inferredFields: BriefField[]
  openingDate: { label: string; year: number } | null
  issues: DocumentaryQaIssue[]
}

function normalizeLineEndings(value: string) {
  return value.replace(/^\uFEFF/u, '').replace(/\r\n?/gu, '\n')
}

function findMarkers(text: string): SectionMarker[] {
  return HEADING_DEFINITIONS.flatMap(definition => {
    const match = definition.pattern.exec(text)
    if (!match || match.index === undefined) return []
    return [
      {
        key: definition.key,
        index: match.index,
        contentStart: match.index + match[0].length
      }
    ]
  }).sort((left, right) => left.index - right.index)
}

function issueForMissingSection(field: BriefField): DocumentaryQaIssue {
  return {
    code: 'script-section-missing',
    severity: 'warning',
    message: `The imported script is missing ${field}.`,
    claimIds: [],
    beatIds: [],
    assetIds: [],
    suggestedAction: `Review the inferred ${field} value before rendering.`
  }
}

function parseRotationLog(raw: string): RotationLog | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined

  return {
    raw: trimmed,
    entries: trimmed
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const colon = line.indexOf(':')
        return colon === -1
          ? { label: line, value: '' }
          : {
              label: line.slice(0, colon).trim(),
              value: line.slice(colon + 1).trim()
            }
      })
  }
}

function extractFinalCta(narration: string) {
  const paragraphs = narration.trim().split(/\n\s*\n/gu)
  const finalParagraph = paragraphs.at(-1)?.trim()
  return finalParagraph &&
    /^(?:if\b|subscribe\b|like\b|comment\b)/iu.test(finalParagraph)
    ? finalParagraph
    : undefined
}

export function extractOpeningDate(narration: string) {
  const firstSentence = narration.trim().split(/(?<=[.!?])\s+/u, 1)[0] ?? ''
  const match = firstSentence.match(OPENING_DATE)
  return match ? { label: match[0].trim(), year: Number(match[1]) } : null
}

export function parseDocumentaryScript(text: string): ParsedDocumentaryScript {
  const originalText = text
  const normalized = normalizeLineEndings(text).trim()
  const rotationMatch = ROTATION_PATTERN.exec(normalized)
  const contentEnd = rotationMatch?.index ?? normalized.length
  const mainContent = normalized.slice(0, contentEnd).trim()
  const rotationLog = rotationMatch
    ? parseRotationLog(
        normalized.slice(rotationMatch.index + rotationMatch[0].length)
      )
    : undefined
  const markers = findMarkers(mainContent)
  const sections = new Map<BriefField, string>()

  for (const [position, marker] of markers.entries()) {
    const next = markers[position + 1]
    sections.set(
      marker.key,
      mainContent
        .slice(marker.contentStart, next?.index ?? mainContent.length)
        .trim()
    )
  }

  const allFields = HEADING_DEFINITIONS.map(definition => definition.key)
  const inferredFields = allFields.filter(field => !sections.has(field))
  const issues = inferredFields.map(issueForMissingSection)
  let narration = mainContent
  let keyFacts: string[] = []

  const factsAndNarration = sections.get('keyFacts')
  if (factsAndNarration !== undefined) {
    const blocks = factsAndNarration
      .split(/\n\s*\n/gu)
      .map(block => block.trim())
      .filter(Boolean)
    const factBlock = blocks.shift() ?? ''
    keyFacts = factBlock
      .split('\n')
      .map(fact => fact.replace(/^[-*•]\s*/u, '').trim())
      .filter(Boolean)
    narration = blocks.join('\n\n').trim()

    if (!narration) {
      narration = mainContent
      issues.push({
        code: 'script-parse-failed',
        severity: 'blocking',
        message:
          'The Four Pillars were found, but clean narration could not be separated.',
        claimIds: [],
        beatIds: [],
        assetIds: [],
        suggestedAction:
          'Add a blank line between Key Facts Covered and the narration.'
      })
    }
  }

  const brief: DocumentaryBrief = {
    whatTheVideoIsAbout:
      sections.get('whatTheVideoIsAbout') ??
      narration.split(/\n\s*\n/u, 1)[0] ??
      '',
    styleOfTalking:
      sections.get('styleOfTalking') ??
      'Grounded historical documentary narration.',
    whoThisVideoIsFor:
      sections.get('whoThisVideoIsFor') ??
      'Viewers interested in WW1 and WW2 history.',
    keyFacts,
    inferredFields
  }
  const openingDate = extractOpeningDate(narration)

  if (!openingDate) {
    issues.unshift({
      code: 'opening-date-missing',
      severity: 'blocking',
      message:
        'The documentary narration does not begin with a concrete historical date.',
      claimIds: [],
      beatIds: [],
      assetIds: [],
      evidence: narration.split(/(?<=[.!?])\s+/u, 1)[0] ?? narration,
      suggestedAction:
        'Add a first sentence containing at least a historical year, such as “By June 1942”.'
    })
  }

  return {
    originalText,
    brief,
    narration,
    cta: extractFinalCta(narration),
    rotationLog,
    inferredFields,
    openingDate,
    issues
  }
}
