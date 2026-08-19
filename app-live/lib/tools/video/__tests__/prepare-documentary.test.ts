import { describe, expect, it, vi } from 'vitest'

const { prepareDocumentaryProject } = vi.hoisted(() => ({
  prepareDocumentaryProject: vi.fn()
}))
const { getModel, resolvedModel } = vi.hoisted(() => {
  const resolvedModel = { provider: 'modelark', modelId: 'deepseek-test' }
  return { getModel: vi.fn(() => resolvedModel), resolvedModel }
})
vi.mock('@/lib/engine/documentary/project', () => ({
  prepareDocumentaryProject
}))
vi.mock('@/lib/utils/registry', () => ({ getModel }))

import { createPrepareDocumentaryTool } from '../prepare-documentary'

describe('createPrepareDocumentaryTool', () => {
  it('returns a compact persisted-project handle', async () => {
    prepareDocumentaryProject.mockImplementation(async model => {
      if (model !== resolvedModel) {
        throw new Error('documentary engine received an unresolved model id')
      }
      return {
        id: 'doc-1',
        topic: 'Battle of Midway',
        inputMode: 'script',
        targetMinutes: 12,
        chapters: [{ id: 'chapter-1' }],
        qa: {
          publishReady: false,
          issues: [{ code: 'critical-claim-unsupported' }]
        }
      }
    })
    const tool = createPrepareDocumentaryTool('test-model')

    const result = await tool.execute!(
      {
        mode: 'script',
        script: 'By June 1942, the battle began.',
        targetMinutes: 12,
        language: 'English',
        sources: []
      } as never,
      { toolCallId: 'tool-1', messages: [] } as never
    )

    expect(result).toEqual(
      expect.objectContaining({
        state: 'complete',
        documentaryId: 'doc-1',
        chapterCount: 1,
        publishReady: false
      })
    )
  })
})
