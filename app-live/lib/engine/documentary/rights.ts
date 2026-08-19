import type { FootageAsset } from '@/lib/engine/sourcing'

import {
  type AssetRights,
  type DocumentaryAsset,
  documentaryAssetSchema,
  type DocumentaryBeat
} from './schema'

export interface ReconstructionContext {
  date: string
  location: string
  uniforms?: string[]
  equipment?: string[]
  weather?: string
  operationalContext: string
  claimIds: string[]
}

type RightsCandidate = Partial<FootageAsset> & {
  source?: string
  url?: string
  title?: string
  providerMetadata?: FootageAsset['providerMetadata']
}

const REUSABLE_LICENSES = new Set<AssetRights['license']>([
  'public-domain',
  'cc0',
  'cc-by',
  'cc-by-sa',
  'permission'
])

function inferProvider(candidate: RightsCandidate): AssetRights['provider'] {
  const source = candidate.source?.toLowerCase() ?? ''
  const url = candidate.url?.toLowerCase() ?? ''
  if (source.includes('wikimedia')) return 'wikimedia'
  if (source.includes('internet archive')) return 'internet-archive'
  if (source.includes('national archives') || source.includes('nara'))
    return 'nara'
  if (source.includes('youtube') || /(?:youtube\.com|youtu\.be)/u.test(url)) {
    return 'youtube'
  }
  if (source.includes('user-provided')) return 'user-provided'
  if (source.includes('ai-generated')) return 'ai-generated'
  return 'web'
}

function parseLicense(
  candidate: RightsCandidate,
  provider: AssetRights['provider']
): AssetRights['license'] {
  if (provider === 'youtube') {
    return candidate.providerMetadata?.youtubeLicense === 'creativeCommon'
      ? 'cc-by'
      : 'standard-youtube'
  }
  if (provider === 'user-provided') {
    return candidate.providerMetadata?.userConfirmedRights
      ? 'permission'
      : 'unknown'
  }
  if (provider === 'ai-generated') return 'permission'

  const text =
    `${candidate.licenseText ?? ''} ${candidate.credit ?? ''}`.toLowerCase()
  if (
    /public domain|\bpd[-_ ]?(?:us|old|gov)?\b|no known copyright/iu.test(text)
  ) {
    return 'public-domain'
  }
  if (/\bcc0\b/iu.test(text)) return 'cc0'
  if (/cc[- ]?by[- ]?sa|creative commons attribution-sharealike/iu.test(text)) {
    return 'cc-by-sa'
  }
  if (/cc[- ]?by\b|creative commons attribution/iu.test(text)) return 'cc-by'
  if (/permission granted|used with permission/iu.test(text))
    return 'permission'
  return 'unknown'
}

export function classifyAssetRights(
  candidate: RightsCandidate,
  accessedAt: string
): AssetRights {
  const provider = inferProvider(candidate)
  const license = parseLicense(candidate, provider)
  const reusable = REUSABLE_LICENSES.has(license)
  return {
    provider,
    sourceUrl: candidate.url,
    creator: candidate.creator,
    institution:
      candidate.institution ??
      (provider === 'nara'
        ? 'U.S. National Archives'
        : provider === 'wikimedia'
          ? 'Wikimedia Commons'
          : provider === 'internet-archive'
            ? 'Internet Archive'
            : undefined),
    license,
    attribution: candidate.credit,
    reusable,
    reviewRequired: !reusable,
    accessedAt
  }
}

export function canUseInFinalRender(rights: AssetRights) {
  return rights.reusable && REUSABLE_LICENSES.has(rights.license)
}

const PROVIDER_PRIORITY: Record<AssetRights['provider'], number> = {
  nara: 0,
  wikimedia: 1,
  'internet-archive': 2,
  youtube: 3,
  'user-provided': 4,
  'ai-generated': 5,
  web: 6
}

export function selectDocumentaryAsset(
  beat: DocumentaryBeat,
  candidates: FootageAsset[],
  accessedAt: string
): DocumentaryAsset | null {
  const selected = candidates
    .map(candidate => ({
      candidate,
      rights: classifyAssetRights(candidate, accessedAt)
    }))
    .filter(
      ({ candidate, rights }) =>
        Boolean(candidate.src) &&
        !candidate.needsResolve &&
        canUseInFinalRender(rights)
    )
    .sort(
      (left, right) =>
        PROVIDER_PRIORITY[left.rights.provider] -
          PROVIDER_PRIORITY[right.rights.provider] ||
        (right.candidate.score ?? 0) - (left.candidate.score ?? 0)
    )[0]

  if (!selected) return null
  return documentaryAssetSchema.parse({
    id: `${beat.id}-asset-${selected.rights.provider}`,
    beatId: beat.id,
    kind: selected.candidate.kind,
    src: selected.candidate.src,
    title: selected.candidate.title,
    visualIntent: beat.visualIntent,
    claimIds: beat.claimIds,
    rights: selected.rights,
    usedInFinalRender: true
  })
}

export function createReconstructionAsset(
  beat: DocumentaryBeat,
  context: ReconstructionContext
): DocumentaryAsset {
  if (
    !context.date.trim() ||
    !context.location.trim() ||
    !context.operationalContext.trim() ||
    context.claimIds.length === 0
  ) {
    throw new Error(
      'Reconstruction requires verified claims, date, location, and operational context'
    )
  }
  const details = [
    `Date: ${context.date}`,
    `Location: ${context.location}`,
    context.uniforms?.length ? `Uniforms: ${context.uniforms.join(', ')}` : '',
    context.equipment?.length
      ? `Equipment: ${context.equipment.join(', ')}`
      : '',
    context.weather ? `Weather: ${context.weather}` : '',
    `Operational context: ${context.operationalContext}`
  ].filter(Boolean)

  return documentaryAssetSchema.parse({
    id: `${beat.id}-asset-ai-reconstruction`,
    beatId: beat.id,
    kind: 'reconstruction',
    title: `Reconstruction for ${beat.visualQuery}`,
    visualIntent: beat.visualIntent,
    claimIds: context.claimIds,
    rights: {
      provider: 'ai-generated',
      license: 'permission',
      reusable: true,
      reviewRequired: false,
      accessedAt: new Date().toISOString()
    },
    reconstructionPrompt: [
      'Historically grounded cinematic reconstruction. Do not add text or labels.',
      ...details,
      `Scene: ${beat.visualIntent}`
    ].join('\n'),
    usedInFinalRender: true
  })
}
