import { generateObject } from 'ai'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

describe('ModelArk registry model', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('uses JSON Schema structured output for documentary objects', async () => {
    vi.stubEnv('MODELARK_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as {
          response_format?: { type?: string }
        }
        if (body.response_format?.type !== 'json_schema') {
          return new Response(
            JSON.stringify({ error: { message: 'json_schema is required' } }),
            { status: 400, headers: { 'content-type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: 1,
            model: 'deepseek-test',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: '{"answer":"OK"}'
                },
                finish_reason: 'stop'
              }
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15
            }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      })
    )

    const { getModel } = await import('../registry')
    const result = await generateObject({
      model: getModel('modelark:deepseek-test'),
      schema: z.object({ answer: z.string() }),
      prompt: 'Return OK.'
    })

    expect(result.object).toEqual({ answer: 'OK' })
  })
})
