import { describe, expect, it, vi } from 'vitest'

const { kvGetJSON } = vi.hoisted(() => ({ kvGetJSON: vi.fn() }))
const { startLambdaRender } = vi.hoisted(() => ({
  startLambdaRender: vi.fn()
}))
vi.mock('@/lib/engine/kv', () => ({ kvGetJSON }))
vi.mock('@/lib/remotion/lambda', () => ({
  isLambdaConfigured: () => true,
  startLambdaRender,
  getLambdaProgress: vi.fn()
}))

import { POST } from '../route'

describe('documentary final render gate', () => {
  it('refuses Lambda rendering while documentary blockers remain', async () => {
    kvGetJSON.mockResolvedValue({
      width: 1280,
      height: 720,
      fps: 30,
      brand: { accent: '#B6924A' },
      shots: [{ kind: 'photo', start: 0, duration: 3 }],
      documentaryProject: {
        id: 'doc-1',
        chapters: [],
        citations: [],
        qa: {
          publishReady: false,
          issues: [
            {
              code: 'asset-rights-not-reusable',
              severity: 'blocking',
              message: 'Unsafe YouTube upload.',
              claimIds: [],
              beatIds: ['beat-1'],
              assetIds: ['asset-1'],
              suggestedAction: 'Replace the asset.'
            }
          ]
        }
      }
    })
    const response = await POST(
      new Request('http://localhost/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'storyboard-1' })
      })
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: 'documentary is not publish-ready',
      issues: expect.any(Array)
    })
    expect(startLambdaRender).not.toHaveBeenCalled()
  })
})
