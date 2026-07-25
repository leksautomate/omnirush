import { Model } from '@/lib/types/models'

const isGroqEnabled = !!process.env.GROQ_API_KEY
const isGoogleEnabled =
  !!process.env.GOOGLE_GENERATIVE_AI_API_KEY || !!process.env.GEMINI_API_KEY

export const DEFAULT_MODEL: Model = isGroqEnabled
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
