import { anthropic } from '@ai-sdk/anthropic'
import { createGateway } from '@ai-sdk/gateway'
import { google } from '@ai-sdk/google'
import { openai } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createProviderRegistry, LanguageModel } from 'ai'
import { createOllama } from 'ai-sdk-ollama'

// Ensure GOOGLE_GENERATIVE_AI_API_KEY is set if GEMINI_API_KEY is provided
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GEMINI_API_KEY) {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY
}

// Strip a trailing /v1 from the configured base URL, then re-append it,
// so both shapes work for OpenAI-compatible hosts:
//   OPENAI_COMPATIBLE_API_BASE_URL=https://api.deepseek.com
//   OPENAI_COMPATIBLE_API_BASE_URL=https://api.deepseek.com/v1
function normalizeOpenAICompatibleBaseURL(raw: string): string {
  return raw.replace(/\/+$/, '').replace(/\/v1$/, '') + '/v1'
}

function getAgentRouterApiKey(): string {
  const raw = process.env.AGENTROUTER_API_KEY || process.env.OPENAI_COMPATIBLE_API_KEY || 'sk-GRKoBCGsQlCqVWG028It7QqaBuVPGD10DpvBdN13nhLGGyu4'
  const cleaned = raw.replace(/^["']|["']$/g, '').trim()
  return cleaned || 'sk-GRKoBCGsQlCqVWG028It7QqaBuVPGD10DpvBdN13nhLGGyu4'
}

// Build providers object conditionally
const providers: Record<string, any> = {
  openai,
  anthropic,
  google,
  agentrouter: createOpenAICompatible({
    name: 'agentrouter',
    apiKey: getAgentRouterApiKey(),
    baseURL: normalizeOpenAICompatibleBaseURL(
      process.env.AGENTROUTER_BASE_URL || 'https://agentrouter.org/v1'
    ),
    headers: {
      'X-Stainless-OS': 'Linux',
      'X-Stainless-Arch': 'x64',
      'X-Stainless-Lang': 'js',
      'X-Stainless-Runtime': 'node',
      'X-Stainless-Runtime-Version': 'v22.22.1',
      'HTTP-Referer': 'https://github.com/RooVetGit/Roo-Cline',
      'X-Title': 'Roo Code',
      'User-Agent': 'RooCode/3.53.0'
    },
    fetch: async (url, init) => {
      const reqHeaders = new Headers(init?.headers || {})
      reqHeaders.set('X-Stainless-OS', 'Linux')
      reqHeaders.set('X-Stainless-Arch', 'x64')
      reqHeaders.set('X-Stainless-Lang', 'js')
      reqHeaders.set('X-Stainless-Runtime', 'node')
      reqHeaders.set('X-Stainless-Runtime-Version', 'v22.22.1')
      reqHeaders.set('HTTP-Referer', 'https://github.com/RooVetGit/Roo-Cline')
      reqHeaders.set('X-Title', 'Roo Code')
      reqHeaders.set('User-Agent', 'RooCode/3.53.0')
      const urlStr = String(url)
      let reqInit = init
      if (typeof init?.body === 'string' && urlStr.includes('/chat/completions')) {
        try {
          const bodyJson = JSON.parse(init.body)
          if (Array.isArray(bodyJson.messages)) {
            bodyJson.messages = bodyJson.messages.map((m: any) => {
              if (Array.isArray(m.content)) {
                const str = m.content
                  .filter((part: any) => part && (part.type === 'text' || typeof part.text === 'string'))
                  .map((part: any) => part.text || '')
                  .join('')
                return { ...m, content: str }
              }
              return m
            })
            reqInit = { ...init, body: JSON.stringify(bodyJson) }
          }
        } catch (e) {}
      }

      const response = await fetch(url, { ...reqInit, headers: reqHeaders })

      const isStreamReq = typeof init?.body === 'string' && init.body.includes('"stream":true')
      if (isStreamReq && response.ok && response.body) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        const encoder = new TextEncoder()
        let buffer = ''

        const stream = new ReadableStream({
          async start(controller) {
            while (true) {
              const { done, value } = await reader.read()
              if (done) {
                if (buffer.trim() && buffer.trim() !== 'data: null' && buffer.trim() !== 'data:null') {
                  controller.enqueue(encoder.encode(buffer))
                }
                controller.close()
                break
              }
              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''

              for (const line of lines) {
                const trimmed = line.trim()
                if (trimmed === 'data: null' || trimmed === 'data:null') {
                  continue
                }
                controller.enqueue(encoder.encode(line + '\n'))
              }
            }
          }
        })

        const resHeaders = new Headers(response.headers)
        resHeaders.set('content-type', 'text/event-stream')
        return new Response(stream, {
          status: response.status,
          statusText: response.statusText,
          headers: resHeaders
        })
      }

      if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
        const text = await response.text()
        const resHeaders = new Headers(response.headers)
        if (!resHeaders.get('content-type')?.includes('application/json')) {
          resHeaders.set('content-type', 'application/json')
        }
        return new Response(text, {
          status: response.status,
          statusText: response.statusText,
          headers: resHeaders
        })
      }
      return response
    }
  }),
  groq: createOpenAICompatible({
    name: 'groq',
    apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_COMPATIBLE_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1'
  }),
  'openai-compatible': createOpenAICompatible({
    // Keep the SDK provider key stable. OPENAI_COMPATIBLE_PROVIDER_NAME is
    // only a UI label used by the model selector.
    name: 'openai-compatible',
    apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
    baseURL: normalizeOpenAICompatibleBaseURL(
      process.env.OPENAI_COMPATIBLE_API_BASE_URL || ''
    )
  }),
  gateway: createGateway({
    apiKey: process.env.AI_GATEWAY_API_KEY
  })
}

// Only add Ollama if OLLAMA_BASE_URL is configured
const ollamaProvider = process.env.OLLAMA_BASE_URL
  ? createOllama({ baseURL: process.env.OLLAMA_BASE_URL })
  : null

if (ollamaProvider) {
  providers.ollama = ollamaProvider
}

export const registry = createProviderRegistry(providers)

export function getModel(model: string): LanguageModel {
  let targetModel = (model || '').trim()

  // Ensure target model starts with a provider prefix if missing
  if (!targetModel.includes(':')) {
    if (targetModel.includes('opus') || targetModel.startsWith('claude')) {
      targetModel = `agentrouter:${targetModel}`
    } else if (
      targetModel.startsWith('gpt') ||
      targetModel.startsWith('o1') ||
      targetModel.startsWith('o3') ||
      targetModel.startsWith('o4')
    ) {
      targetModel = `openai:${targetModel}`
    } else if (targetModel.startsWith('gemini')) {
      targetModel = `google:${targetModel}`
    } else if (targetModel.startsWith('deepseek')) {
      targetModel = `groq:${targetModel}`
    } else {
      // Default prefix
      targetModel = `agentrouter:${targetModel}`
    }
  }

  // Normalize AgentRouter model aliases
  if (targetModel.startsWith('agentrouter:')) {
    const rawId = targetModel.slice('agentrouter:'.length)
    if (
      rawId === 'claude-opus-5' ||
      rawId === 'opus-5' ||
      rawId === 'opus5'
    ) {
      targetModel = 'agentrouter:claude-opus-5'
    } else if (
      rawId === 'claude-opus-4-6' ||
      rawId === 'claude-opus-4-8' ||
      rawId === 'opus' ||
      rawId === 'claude-opus' ||
      rawId === 'opus-4-6' ||
      rawId === 'opus-4-8' ||
      rawId.startsWith('claude')
    ) {
      targetModel = 'agentrouter:claude-opus-4-6'
    }
  }

  // Normalize Anthropic model aliases to AgentRouter
  if (targetModel.startsWith('anthropic:')) {
    targetModel = 'agentrouter:claude-opus-4-6'
  }

  // Normalize DeepSeek model aliases on Groq
  if (targetModel.startsWith('groq:')) {
    const rawId = targetModel.slice('groq:'.length)
    if (
      rawId === 'deepseek' ||
      rawId === 'deepseek-r1' ||
      rawId === 'deepseek-70b'
    ) {
      targetModel = 'groq:deepseek-r1-distill-llama-70b'
    }
  }

  // Provider fallback: prioritize active key (Groq -> AgentRouter -> Gemini -> OpenAI)
  const provider = targetModel.split(':')[0]
  if (!isProviderEnabled(provider)) {
    if (process.env.GROQ_API_KEY) {
      targetModel = 'groq:deepseek-r1-distill-llama-70b'
    } else if (getAgentRouterApiKey()) {
      targetModel = 'agentrouter:claude-opus-4-6'
    } else if (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY) {
      targetModel = 'google:gemini-2.0-flash'
    } else if (process.env.OPENAI_API_KEY) {
      targetModel = 'openai:gpt-4o'
    }
  }

  // For Ollama models, bypass the registry to pass model-level settings
  if (targetModel.startsWith('ollama:') && ollamaProvider) {
    const modelId = targetModel.slice('ollama:'.length)
    const lm = ollamaProvider(modelId, { think: true })

    Object.defineProperty(lm, 'supportedUrls', {
      value: {},
      configurable: true
    })

    return lm
  }

  console.error('[getModel resolved]:', targetModel)
  return registry.languageModel(
    targetModel as Parameters<typeof registry.languageModel>[0]
  )
}

export function isProviderEnabled(providerId: string): boolean {
  switch (providerId) {
    case 'agentrouter':
      return !!getAgentRouterApiKey()
    case 'groq':
      return !!process.env.GROQ_API_KEY
    case 'openai':
      return !!process.env.OPENAI_API_KEY
    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY
    case 'google':
      return (
        !!process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
        !!process.env.GEMINI_API_KEY
      )
    case 'openai-compatible':
      return (
        !!process.env.OPENAI_COMPATIBLE_API_KEY &&
        !!process.env.OPENAI_COMPATIBLE_API_BASE_URL
      )
    case 'gateway':
      return !!process.env.AI_GATEWAY_API_KEY
    case 'ollama':
      return !!process.env.OLLAMA_BASE_URL
    default:
      return false
  }
}
