import { afterEach, describe, expect, it, vi } from 'vitest'

const { sourceFootage } = vi.hoisted(() => ({ sourceFootage: vi.fn() }))
const { selectRelevantVideoSegment } = vi.hoisted(() => ({
  selectRelevantVideoSegment: vi.fn()
}))
const { kvSetJSON } = vi.hoisted(() => ({ kvSetJSON: vi.fn() }))

vi.mock('@/lib/engine/sourcing', () => ({ sourceFootage }))
vi.mock('@/lib/engine/video-segments', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/engine/video-segments')>()),
  selectRelevantVideoSegment
}))
vi.mock('@/lib/engine/kv', () => ({ kvSetJSON }))
vi.mock('@/lib/engine/documentary/project', () => ({
  loadDocumentaryProject: vi.fn()
}))
vi.mock('@paralleldrive/cuid2', () => ({ createId: () => 'segment-1' }))

import { createSourceFootageTool } from '../source-footage'

describe('sourceFootage video segment selection', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('persists the selected source window and muted-audio default with the resolved MP4', async () => {
    vi.stubEnv('MODELARK_API_KEY', 'test-key')
    sourceFootage.mockResolvedValue({
      visionVerified: true,
      best: {
        kind: 'video',
        src: 'https://archive.org/download/reel/reel.mp4',
        thumb: 'https://archive.org/services/img/reel',
        title: 'Armoured advance',
        credit: 'Internet Archive',
        url: 'https://archive.org/details/reel',
        source: 'Internet Archive',
        sourceDuration: 18,
        needsResolve: false
      },
      candidates: []
    })
    selectRelevantVideoSegment.mockResolvedValue({
      start: 3,
      end: 9.5,
      reason: 'The tanks remain visible throughout.'
    })

    const result = (await createSourceFootageTool().execute!(
      {
        queries: ['armoured advance archival footage'],
        intent: 'Show the tanks advancing through smoke.',
        narration: 'The advance began before dawn.',
        minimumDuration: 6
      },
      { toolCallId: 'tool-1', messages: [] } as never
    )) as any

    expect(result.best).toMatchObject({
      mediaStart: 3,
      mediaEnd: 9.5,
      mediaMuted: true,
      segmentReason: 'The tanks remain visible throughout.'
    })
    expect(kvSetJSON).toHaveBeenCalledWith(
      'footage:ft_segment-1',
      expect.objectContaining({
        src: 'https://archive.org/download/reel/reel.mp4',
        mediaStart: 3,
        mediaEnd: 9.5,
        mediaMuted: true
      })
    )
  })

  it('still stores a sourced video muted when segment metadata is unavailable', async () => {
    sourceFootage.mockResolvedValue({
      visionVerified: false,
      best: {
        kind: 'video',
        src: 'https://media.example.com/resolved.mp4',
        thumb: 'https://media.example.com/thumb.jpg',
        title: 'Resolved clip',
        credit: 'Reusable media',
        url: 'https://media.example.com/source',
        source: 'Web archive',
        needsResolve: false
      },
      candidates: []
    })

    const result = (await createSourceFootageTool().execute!(
      {
        queries: ['resolved reusable clip'],
        intent: 'Show the subject.'
      },
      { toolCallId: 'tool-1', messages: [] } as never
    )) as any

    expect(result.best.mediaMuted).toBe(true)
    expect(selectRelevantVideoSegment).not.toHaveBeenCalled()
  })

  it.each([
    ['video/webm', 'https://media.example.com/resolved.webm'],
    ['video/ogg', 'https://media.example.com/resolved.ogv'],
    ['video/quicktime', 'https://media.example.com/resolved.mov']
  ])(
    'keeps a resolved %s clip muted without sending it to MP4 semantic selection',
    async (mimeType, src) => {
      vi.stubEnv('MODELARK_API_KEY', 'test-key')
      sourceFootage.mockResolvedValue({
        visionVerified: true,
        best: {
          kind: 'video',
          src,
          mimeType,
          thumb: 'https://media.example.com/thumb.jpg',
          title: 'Resolved non-MP4 clip',
          credit: 'Reusable media',
          url: 'https://media.example.com/source',
          source: 'Web archive',
          sourceDuration: 18,
          needsResolve: false
        },
        candidates: []
      })

      const result = (await createSourceFootageTool().execute!(
        {
          queries: ['resolved reusable clip'],
          intent: 'Show the subject.',
          narration: 'The subject moves through frame.',
          minimumDuration: 6
        },
        { toolCallId: 'tool-1', messages: [] } as never
      )) as any

      expect(result.best).toMatchObject({ src, mediaMuted: true })
      expect(selectRelevantVideoSegment).not.toHaveBeenCalled()
    }
  )
})
