import { existsSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

import {
  parseAudioCatalog,
  selectAudioTrack,
  toCatalogAudioUrl
} from '../audio-catalog'

import installedCatalog from '@/public/audio/catalog.json'

const PIXABAY_LICENSE = 'https://pixabay.com/service/license-summary/'

function track(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dark-documentary',
    kind: 'music',
    title: 'Dark Documentary',
    creator: 'Example Artist',
    file: 'music/dark-documentary.mp3',
    source: 'pixabay',
    sourceUrl: 'https://pixabay.com/music/main-title-dark-documentary-12345/',
    license: 'Pixabay Content License',
    licenseUrl: PIXABAY_LICENSE,
    downloadedAt: '2026-08-14',
    durationSec: 158,
    instrumental: true,
    contentIdRegistered: false,
    genres: ['cinematic'],
    moods: ['dark', 'suspense'],
    tags: ['documentary', 'true crime', 'investigation'],
    ...overrides
  }
}

describe('curated audio catalogue', () => {
  it('accepts a complete Pixabay track and rejects missing provenance', () => {
    const parsed = parseAudioCatalog({ version: 1, tracks: [track()] })
    expect(parsed.tracks[0].sourceUrl).toContain('pixabay.com/music/')

    expect(() =>
      parseAudioCatalog({
        version: 1,
        tracks: [track({ sourceUrl: '' })]
      })
    ).toThrow()

    const { contentIdRegistered: _contentIdRegistered, ...withoutContentId } =
      track()
    expect(() =>
      parseAudioCatalog({ version: 1, tracks: [withoutContentId] })
    ).toThrow()
  })

  it('rejects paths that could escape the public audio directory', () => {
    expect(() =>
      parseAudioCatalog({
        version: 1,
        tracks: [track({ file: '../private/track.mp3' })]
      })
    ).toThrow()
  })

  it('chooses the track whose metadata best matches the requested video mood', () => {
    const catalogue = parseAudioCatalog({
      version: 1,
      tracks: [
        track(),
        track({
          id: 'upbeat-business',
          title: 'Upbeat Business',
          file: 'music/upbeat-business.mp3',
          sourceUrl:
            'https://pixabay.com/music/corporate-upbeat-business-67890/',
          genres: ['corporate'],
          moods: ['upbeat', 'positive'],
          tags: ['finance', 'business', 'explainer']
        })
      ]
    })

    expect(
      selectAudioTrack(catalogue, {
        prompt: 'upbeat finance and business explainer'
      })?.id
    ).toBe('upbeat-business')
  })

  it('avoids Content ID registered tracks unless explicitly allowed', () => {
    const catalogue = parseAudioCatalog({
      version: 1,
      tracks: [
        track({ contentIdRegistered: true }),
        track({
          id: 'safe-ambient',
          title: 'Safe Ambient',
          file: 'music/safe-ambient.mp3',
          sourceUrl: 'https://pixabay.com/music/ambient-safe-ambient-54321/',
          genres: ['ambient'],
          moods: ['calm'],
          tags: ['background']
        })
      ]
    })

    expect(
      selectAudioTrack(catalogue, { prompt: 'dark documentary suspense' })?.id
    ).toBe('safe-ambient')
    expect(
      selectAudioTrack(catalogue, {
        prompt: 'dark documentary suspense',
        allowContentId: true
      })?.id
    ).toBe('dark-documentary')
  })

  it('builds a public URL for a bundled catalogue file', () => {
    expect(toCatalogAudioUrl(track() as any)).toBe(
      '/audio/music/dark-documentary.mp3'
    )
  })

  it('keeps every installed catalogue record paired with its bundled file', () => {
    const catalogue = parseAudioCatalog(installedCatalog)

    expect(catalogue.tracks.length).toBeGreaterThan(0)
    for (const installed of catalogue.tracks) {
      expect(
        existsSync(path.join(process.cwd(), 'public', 'audio', installed.file)),
        `missing bundled audio file for ${installed.id}`
      ).toBe(true)
    }
  })
})
