import { describe, expect, it, vi } from 'vitest'

// Regression coverage for a real production bug: web-search video candidates (from
// kakkaoMedia, e.g. Tavily) carry needsResolve:true but no `identifier` — that field
// only exists for Internet Archive candidates. archiveResolveFile used to treat
// "no identifier" as "already resolved" and hand the candidate back unchanged, so a
// watch/page URL ended up as a shot's `src`. OffthreadVideo can't play a webpage, so
// the shot rendered as a black gap for its whole duration.
import {
  archiveResolveFile,
  type FootageAsset,
  selectPlayableFootage,
  wikimediaMedia
} from '../sourcing'

describe('archiveResolveFile', () => {
  it('fails to resolve a candidate with no identifier instead of returning it unchanged', async () => {
    const webVideoCandidate: FootageAsset = {
      kind: 'video',
      src: 'https://news.example.com/watch?id=123', // a page URL, not a direct file
      thumb: 'https://news.example.com/thumb.jpg',
      title: 'Some web video',
      credit: 'Some web video, via Web (Tavily) search',
      url: 'https://news.example.com/watch?id=123',
      source: 'Web (Tavily)',
      needsResolve: true
      // no `identifier` — this is the case that used to slip through
    }

    const result = await archiveResolveFile(webVideoCandidate)

    expect(result).toBeNull()
  })

  it('still resolves a real Internet Archive candidate to its direct file URL', async () => {
    const archiveCandidate: FootageAsset = {
      kind: 'video',
      src: '',
      thumb: 'https://archive.org/services/img/some_reel',
      title: 'Some Reel',
      credit: 'Some Reel — Internet Archive',
      url: 'https://archive.org/details/some_reel',
      source: 'Internet Archive',
      needsResolve: true,
      identifier: 'some_reel'
    }

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        files: [
          {
            name: 'some_reel.mp4',
            source: 'derivative',
            length: '00:01:42.500'
          }
        ]
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await archiveResolveFile(archiveCandidate)

    expect(result).not.toBeNull()
    expect(result!.src).toBe(
      'https://archive.org/download/some_reel/some_reel.mp4'
    )
    expect(result!.needsResolve).toBe(false)
    expect(result!.sourceDuration).toBe(102.5)

    vi.unstubAllGlobals()
  })
})

describe('selectPlayableFootage', () => {
  it('continues after archive resolution reveals that the first file is too short', async () => {
    const shortUnresolved: FootageAsset = {
      kind: 'video',
      src: '',
      thumb: 'https://archive.org/services/img/short-reel',
      title: 'Short reel',
      credit: 'Internet Archive',
      url: 'https://archive.org/details/short-reel',
      source: 'Internet Archive',
      needsResolve: true,
      identifier: 'short-reel'
    }
    const longResolved: FootageAsset = {
      kind: 'video',
      src: 'https://archive.org/download/long-reel/long-reel.mp4',
      thumb: 'https://archive.org/services/img/long-reel',
      title: 'Long reel',
      credit: 'Internet Archive',
      url: 'https://archive.org/details/long-reel',
      source: 'Internet Archive',
      needsResolve: false,
      sourceDuration: 12
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          files: [
            {
              name: 'short-reel.mp4',
              source: 'derivative',
              length: '3.5'
            }
          ]
        })
      })
    )

    const selected = await selectPlayableFootage(
      [shortUnresolved, longResolved],
      [0, 1],
      5
    )

    expect(selected?.src).toBe(
      'https://archive.org/download/long-reel/long-reel.mp4'
    )
    vi.unstubAllGlobals()
  })
})

describe('wikimediaMedia', () => {
  it('keeps the original image as src and the resized URL only as thumb', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          query: {
            pages: {
              1: {
                title: 'File:Lavochkin_La-5.jpg',
                imageinfo: [
                  {
                    mime: 'image/jpeg',
                    url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Lavochkin_La-5.jpg',
                    thumburl:
                      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Lavochkin_La-5.jpg/1280px-Lavochkin_La-5.jpg',
                    descriptionurl:
                      'https://commons.wikimedia.org/wiki/File:Lavochkin_La-5.jpg',
                    extmetadata: {}
                  }
                ]
              }
            }
          }
        })
      })
    )

    const [asset] = await wikimediaMedia('Lavochkin La-5', 1)

    expect(asset.src).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/a/ab/Lavochkin_La-5.jpg'
    )
    expect(asset.thumb).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Lavochkin_La-5.jpg/1280px-Lavochkin_La-5.jpg'
    )

    vi.unstubAllGlobals()
  })
})
