import { describe, expect, it, vi } from 'vitest'

const { sourceFootage } = vi.hoisted(() => ({ sourceFootage: vi.fn() }))
const { loadDocumentaryProject } = vi.hoisted(() => ({
  loadDocumentaryProject: vi.fn()
}))
const { kvSetJSON, kvGetJSON } = vi.hoisted(() => ({
  kvSetJSON: vi.fn(),
  kvGetJSON: vi.fn().mockResolvedValue(null)
}))

vi.mock('@/lib/engine/sourcing', () => ({ sourceFootage }))
vi.mock('@/lib/engine/documentary/project', () => ({ loadDocumentaryProject }))
vi.mock('@/lib/engine/kv', () => ({ kvSetJSON, kvGetJSON }))
vi.mock('@paralleldrive/cuid2', () => ({ createId: () => 'selection-1' }))

import { createSourceFootageTool } from '../source-footage'

function project() {
  return {
    id: 'doc-1',
    topic: 'Battle of Midway',
    beats: [
      {
        id: 'beat-1',
        chapterId: 'chapter-1',
        type: 'archival-video',
        narration: 'By June 1942, carriers approached Midway.',
        start: 0,
        duration: 5,
        words: [],
        claimIds: ['claim-1'],
        dateLabel: 'June 1942',
        locationIds: ['midway'],
        entityIds: ['carrier-force'],
        visualQuery: 'Midway carriers June 1942',
        visualIntent: 'Show carriers approaching Midway.'
      }
    ],
    assets: [],
    chapters: [{ id: 'chapter-1', dateRange: 'June 1942' }],
    dossier: {
      locations: [{ id: 'midway', name: 'Midway Atoll', theatre: 'Pacific' }],
      militaryUnits: [
        { id: 'carrier-force', name: 'Carrier force', role: 'naval aviation' }
      ],
      equipment: [{ id: 'zero', name: 'A6M2 Zero' }]
    }
  }
}

describe('sourceFootage documentary final-render mode', () => {
  it('returns unsafe YouTube as reference and creates a grounded fallback', async () => {
    loadDocumentaryProject.mockResolvedValue(project())
    sourceFootage.mockResolvedValue({
      visionVerified: true,
      best: {
        kind: 'video',
        src: 'https://youtube.com/watch?v=abc',
        thumb: 'https://youtube.com/thumb.jpg',
        title: 'Midway archival upload',
        credit: 'Uploader',
        url: 'https://youtube.com/watch?v=abc',
        source: 'YouTube',
        needsResolve: true
      },
      candidates: [
        {
          kind: 'video',
          src: 'https://youtube.com/watch?v=abc',
          thumb: 'https://youtube.com/thumb.jpg',
          title: 'Midway archival upload',
          credit: 'Uploader',
          url: 'https://youtube.com/watch?v=abc',
          source: 'YouTube',
          needsResolve: true
        }
      ]
    })
    const tool = createSourceFootageTool()

    const result = (await tool.execute!(
      {
        queries: ['Midway carrier footage June 1942'],
        intent: 'Show carriers approaching Midway.',
        documentaryId: 'doc-1',
        beatId: 'beat-1',
        finalRender: true
      },
      { toolCallId: 'tool-1', messages: [] } as never
    )) as any

    expect(result.selectedAsset.rights.provider).toBe('ai-generated')
    expect(result.referenceCandidates[0].rights.license).toBe(
      'standard-youtube'
    )
    expect(result.selectedAsset).not.toHaveProperty('visibleAiLabel')
    expect(kvSetJSON).toHaveBeenCalledWith(
      'documentary:doc-1',
      expect.objectContaining({ assets: [result.selectedAsset] })
    )
  })
})

describe('sourceFootage reusable selection handle', () => {
  it('stores the exact selected asset for composeRender instead of requiring URL retyping', async () => {
    sourceFootage.mockResolvedValue({
      visionVerified: true,
      best: {
        kind: 'video',
        src: 'https://archive.org/download/kursk/kursk.mp4',
        thumb: 'https://archive.org/services/img/kursk',
        title: 'Battle of Kursk archival film',
        credit: 'Internet Archive',
        url: 'https://archive.org/details/kursk',
        source: 'Internet Archive',
        needsResolve: false
      },
      candidates: []
    })
    const tool = createSourceFootageTool()

    const result = (await tool.execute!(
      {
        queries: ['Battle of Kursk 1943'],
        intent: 'Show real archival footage over the Kursk battlefield.'
      },
      { toolCallId: 'tool-1', messages: [] } as never
    )) as any

    expect(result.footageId).toBe('ft_selection-1')
    expect(kvSetJSON).toHaveBeenCalledWith(
      'footage:ft_selection-1',
      expect.objectContaining({
        kind: 'video',
        src: 'https://archive.org/download/kursk/kursk.mp4'
      })
    )
  })
})
