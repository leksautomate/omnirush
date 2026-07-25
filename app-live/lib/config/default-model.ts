import { Model } from '@/lib/types/models'

const isAgentRouterEnabled =
  !!process.env.AGENTROUTER_API_KEY ||
  (!!process.env.OPENAI_COMPATIBLE_API_KEY &&
    (process.env.OPENAI_COMPATIBLE_API_BASE_URL || '').includes('agentrouter'))
const isGroqEnabled = !!process.env.GROQ_API_KEY
const isGoogleEnabled =
  !!process.env.GOOGLE_GENERATIVE_AI_API_KEY || !!process.env.GEMINI_API_KEY

export const DEFAULT_MODEL: Model = isAgentRouterEnabled
  ? {
      id: 'claude-opus-4-8',
      name: 'Claude Opus 4.8',
      provider: 'AgentRouter',
      providerId: 'agentrouter'
    }
  : isGroqEnabled
    ? {
        id: 'deepseek-r1-distill-llama-70b',
        name: 'DeepSeek R1 (Groq)',
        provider: 'Groq',
        providerId: 'groq'
      }
    : isGoogleEnabled
      ? {
          id: 'gemini-2.0-flash',
          name: 'Gemini 2.0 Flash',
          provider: 'Google',
          providerId: 'google'
        }
      : {
          id: 'claude-sonnet-5',
          name: 'Claude Sonnet 5',
          provider: 'Anthropic',
          providerId: 'anthropic'
        }
