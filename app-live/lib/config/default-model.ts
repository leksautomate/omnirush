import { Model } from '@/lib/types/models'

const isGoogleEnabled =
  !!process.env.GOOGLE_GENERATIVE_AI_API_KEY || !!process.env.GEMINI_API_KEY

export const DEFAULT_MODEL: Model = isGoogleEnabled
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
