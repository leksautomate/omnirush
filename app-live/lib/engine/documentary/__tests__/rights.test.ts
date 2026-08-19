import { describe, expect, it } from 'vitest'

import {
  canUseInFinalRender,
  classifyAssetRights,
  createReconstructionAsset,
  selectDocumentaryAsset
} from '../rights'
import type { AssetRights, DocumentaryBeat } from '../schema'

const accessedAt = '2026-08-14T00:00:00.000Z'

function rights(
  license: AssetRights['license'],
  reusable: boolean
): AssetRights {
  return {
    provider: 'web',
    license,
    reusable,
    reviewRequired: !reusable,
    accessedAt
  }
}

function beat(): DocumentaryBeat {
  return {
    id: 'beat-1',
    chapterId: 'chapter-1',
    type: 'archival-video',
    narration: 'By June 1942, the carrier forces approached Midway.',
    start: 0,
    duration: 5,
    words: [],
    claimIds: ['claim-1'],
    dateLabel: 'June 1942',
    locationIds: ['midway'],
    entityIds: ['carrier-force'],
    visualQuery: 'Battle of Midway carrier footage June 1942',
    visualIntent: 'Show carrier forces approaching Midway.'
  }
}

describe('documentary asset rights', () => {
  it.each([
    ['public-domain', true],
    ['cc0', true],
    ['cc-by', true],
    ['cc-by-sa', true],
    ['permission', true],
    ['standard-youtube', false],
    ['unknown', false]
  ] as const)('classifies %s final-render use as %s', (license, reusable) => {
    expect(canUseInFinalRender(rights(license, reusable))).toBe(reusable)
  })

  it('treats ordinary YouTube search results as reference-only', () => {
    const result = classifyAssetRights(
      {
        source: 'Web (Tavily)',
        url: 'https://youtube.com/watch?v=abc',
        title: 'Midway footage'
      },
      accessedAt
    )

    expect(result).toMatchObject({
      provider: 'youtube',
      license: 'standard-youtube',
      reusable: false,
      reviewRequired: true
    })
  })

  it('accepts YouTube only with explicit Creative Commons API evidence', () => {
    const result = classifyAssetRights(
      {
        source: 'YouTube',
        url: 'https://youtube.com/watch?v=cc',
        providerMetadata: { youtubeLicense: 'creativeCommon' }
      },
      accessedAt
    )

    expect(result).toMatchObject({
      provider: 'youtube',
      license: 'cc-by',
      reusable: true
    })
  })

  it('rejects unknown web media and selects explicit public-domain archives', () => {
    const selected = selectDocumentaryAsset(
      beat(),
      [
        {
          kind: 'video',
          src: 'https://example.com/watch',
          thumb: 'https://example.com/thumb.jpg',
          title: 'Unknown clip',
          credit: 'Unknown',
          url: 'https://example.com/watch',
          source: 'Web (Tavily)'
        },
        {
          kind: 'video',
          src: 'https://catalog.archives.gov/midway.mp4',
          thumb: 'https://catalog.archives.gov/midway.jpg',
          title: 'Midway combat footage',
          credit: 'U.S. National Archives',
          url: 'https://catalog.archives.gov/id/123',
          source: 'U.S. National Archives',
          licenseText: 'Public domain'
        }
      ],
      accessedAt
    )

    expect(selected?.rights).toMatchObject({
      provider: 'nara',
      license: 'public-domain',
      reusable: true
    })
  })

  it('creates a grounded internal reconstruction without a visible label field', () => {
    const asset = createReconstructionAsset(beat(), {
      date: 'June 1942',
      location: 'Midway Atoll, Central Pacific',
      uniforms: ['Imperial Japanese Navy flight-deck clothing'],
      equipment: ['A6M2 Zero', 'Japanese fleet carrier deck'],
      weather: 'high cloud over the Pacific',
      operationalContext:
        'Aircraft being refuelled and rearmed during combat operations',
      claimIds: ['claim-1']
    })

    expect(asset.rights).toMatchObject({
      provider: 'ai-generated',
      reusable: true
    })
    expect(asset.reconstructionPrompt).toContain('June 1942')
    expect(asset).not.toHaveProperty('visibleAiLabel')
  })
})
