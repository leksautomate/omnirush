import { Model } from '@/lib/types/models'

// ModelArk (BytePlus Ark) takes priority when configured — it doesn't need
// OpenAI/Anthropic keys. Falls back to DeepSeek's own API via the
// openai-compatible slot otherwise.
export const DEFAULT_MODEL: Model = process.env.MODELARK_API_KEY
  ? {
      id: process.env.MODELARK_MODEL || 'deepseek-v4-flash-ga-260731',
      name: 'DeepSeek V4 Flash (ModelArk)',
      provider: 'ModelArk',
      providerId: 'modelark'
    }
  : {
      id: 'deepseek-v4-flash',
      name: 'DeepSeek V4 Flash',
      provider: 'DeepSeek',
      providerId: 'openai-compatible'
    }
