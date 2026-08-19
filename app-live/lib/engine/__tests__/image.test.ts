import { beforeEach, describe, expect, it, vi } from 'vitest'

// Regression coverage for a real production bug: generateImageModelArk used to hand
// back ModelArk's raw response URL, which is a short-lived presigned link, not
// permanent hosting. By the time a storyboard was actually rendered/viewed, the link
// had expired and the shot showed as a black gap in the Studio. It should now be
// rehosted immediately, same as TTS audio already is in lib/engine/voice.ts.
const kvStore = vi.hoisted(() => new Map<string, unknown>())
vi.mock('@/lib/engine/kv', () => ({
  kvGetJSON: vi.fn(async (key: string) => kvStore.get(key) ?? null),
  kvSetJSON: vi.fn(async (key: string, value: unknown) => {
    kvStore.set(key, value)
  })
}))

const hostGeneratedBytes = vi.hoisted(() =>
  vi.fn(async (_bytes: Buffer, opts: { r2KeyPrefix: string; filename: string }) =>
    `https://cdn.example.com/${opts.r2KeyPrefix}/${opts.filename}`
  )
)
vi.mock('@/lib/storage/host-bytes', () => ({ hostGeneratedBytes }))

import { generateImageModelArk } from '../image'

const ORIGINAL_ENV = { ...process.env }

describe('generateImageModelArk', () => {
  beforeEach(() => {
    kvStore.clear()
    hostGeneratedBytes.mockClear()
    process.env = { ...ORIGINAL_ENV, MODELARK_API_KEY: 'test-key' }
  })

  it('rehosts the generated image instead of returning ModelArk\'s short-lived URL', async () => {
    const arkImageUrl = 'https://ark-tos.example.com/presigned/abc?sig=xyz&expires=123'
    const fetchMock = vi
      .fn()
      // 1) POST /images/generations
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ url: arkImageUrl, revised_prompt: 'a cat' }] })
      })
      // 2) GET the image bytes to rehost them
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: async () => new ArrayBuffer(8)
      })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateImageModelArk('a cat')

    expect(result.imageUrl).not.toBe(arkImageUrl)
    expect(result.imageUrl).toBe(
      `https://cdn.example.com/images/${result.model}-${result.imageUrl.match(/-(\d+)\./)![1]}.png`
    )
    expect(hostGeneratedBytes).toHaveBeenCalledTimes(1)
    expect(hostGeneratedBytes.mock.calls[0][1]).toMatchObject({
      r2KeyPrefix: 'images',
      localSubdir: 'images',
      contentType: 'image/png'
    })

    vi.unstubAllGlobals()
  })

  it('falls back to the original URL if rehosting the fetch fails', async () => {
    const arkImageUrl = 'https://ark-tos.example.com/presigned/abc?sig=xyz'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ url: arkImageUrl }] })
      })
      .mockResolvedValueOnce({ ok: false, status: 404 })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateImageModelArk('a dog')

    expect(result.imageUrl).toBe(arkImageUrl)

    vi.unstubAllGlobals()
  })
})
