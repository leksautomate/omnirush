import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { kvGetJSON, kvSetJSON, store } = vi.hoisted(() => {
  const values = new Map<string, unknown>()
  return {
    store: values,
    kvGetJSON: vi.fn(async (key: string) => values.get(key) ?? null),
    kvSetJSON: vi.fn(async (key: string, value: unknown) => {
      values.set(key, value)
    })
  }
})
const { planDocumentaryBeats } = vi.hoisted(() => ({
  planDocumentaryBeats: vi.fn()
}))
const { loadDocumentaryProject } = vi.hoisted(() => ({
  loadDocumentaryProject: vi.fn()
}))
vi.mock('@/lib/engine/kv', () => ({ kvGetJSON, kvSetJSON }))
vi.mock('@/lib/engine/documentary/planner', () => ({
  planDocumentaryBeats,
  documentaryBeatKind: (type: string) =>
    type === 'battle-map' ? 'photo' : 'video'
}))
vi.mock('@/lib/engine/documentary/project', () => ({ loadDocumentaryProject }))

import { createCutBeatsTool } from '../cut-beats'

describe('cutBeats documentary path', () => {
  beforeEach(() => {
    store.clear()
    kvGetJSON.mockClear()
    kvSetJSON.mockClear()
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    vi.spyOn(Math, 'random').mockReturnValue(0.123456)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('keeps the selected ModelArk model when a Gemini key is also configured', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'configured-gemini-key')
    const project = {
      id: 'doc-model',
      topic: 'La-5 over Kursk',
      narration: 'July 1943, Kursk. The air battle begins.',
      profile: { niche: 'ww1_ww2', format: 'documentary', presetVersion: 1 },
      language: 'English',
      targetMinutes: 1,
      inputMode: 'script',
      brief: {},
      dossier: {},
      chapters: [],
      beats: [],
      assets: [],
      qa: { publishReady: true, issues: [] },
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z'
    }
    loadDocumentaryProject.mockResolvedValue(project)
    planDocumentaryBeats.mockResolvedValue([])
    const tool = createCutBeatsTool(
      'modelark:deepseek-v4-flash-ga-260731'
    )

    await tool.execute!(
      { documentaryId: 'doc-model' } as never,
      { toolCallId: 'tool-model', messages: [] } as never
    )

    expect(planDocumentaryBeats).toHaveBeenCalledWith(
      'modelark:deepseek-v4-flash-ga-260731',
      project,
      expect.any(Object)
    )
  })

  it('retains documentary metadata and updates the project', async () => {
    const project = {
      id: 'doc-1',
      topic: 'Battle of Midway',
      narration: 'By June 1942, the battle began.',
      profile: { niche: 'ww1_ww2', format: 'documentary', presetVersion: 1 },
      language: 'English',
      targetMinutes: 1,
      inputMode: 'script',
      brief: {},
      dossier: {},
      chapters: [],
      beats: [],
      assets: [],
      qa: { publishReady: true, issues: [] },
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z'
    }
    store.set('documentary:doc-1', project)
    loadDocumentaryProject.mockResolvedValue(project)
    planDocumentaryBeats.mockResolvedValue([
      {
        id: 'beat-1',
        chapterId: 'chapter-1',
        type: 'battle-map',
        narration: 'By June 1942, the battle began.',
        start: 0,
        duration: 4,
        words: [],
        claimIds: ['claim-1'],
        entityIds: ['unit-1'],
        locationIds: ['midway'],
        dateLabel: 'June 1942',
        visualQuery: 'Midway June 1942',
        visualIntent: 'Show the opposing movements.',
        graphic: { type: 'battle-map', backgroundId: 'bg4' }
      }
    ])
    const tool = createCutBeatsTool('test-model')

    const result = (await tool.execute!(
      { documentaryId: 'doc-1' } as never,
      { toolCallId: 'tool-1', messages: [] } as never
    )) as any

    expect(result.shots[0]).toEqual(
      expect.objectContaining({
        chapterId: 'chapter-1',
        claimIds: ['claim-1'],
        entityIds: ['unit-1'],
        locationIds: ['midway'],
        graphic: expect.objectContaining({ type: 'battle-map' })
      })
    )
    const storedBeats = [...store.entries()].find(([key]) =>
      key.startsWith('beats:')
    )?.[1] as any
    expect(storedBeats.shots[0].documentary).toMatchObject({
      chapterId: 'chapter-1',
      claimIds: ['claim-1']
    })
    expect((store.get('documentary:doc-1') as any).beats).toHaveLength(1)
  })
})
