// AI helpers for the Niche Finder — sub-niche ideation and per-niche verdicts.
import { generateText } from 'ai'

import { getModel } from '@/lib/utils/registry'

import 'server-only'

function getBestNicheModel() {
  const custom = process.env.NICHE_AI_MODEL
  if (custom && !custom.includes('claude-sonnet-5')) {
    try {
      return getModel(custom)
    } catch {}
  }
  if (process.env.AGENTROUTER_API_KEY) {
    return getModel('agentrouter:claude-opus-4-6')
  }
  if (process.env.GROQ_API_KEY) {
    return getModel('groq:deepseek-r1-distill-llama-70b')
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY) {
    return getModel('google:gemini-2.0-flash')
  }
  return getModel('agentrouter:claude-opus-4-6')
}

const SYS_SUBNICHES = `You are a YouTube niche strategist. Given a broad topic, return ONLY a JSON array of 8 specific, faceless-channel-friendly sub-niche search keywords (2-4 words each, English). Favor niches with strong search demand and story potential. Example: ["ancient rome mysteries","medieval castle secrets"]`
const SYS_VERDICT = `You are a YouTube niche analyst. For each niche you receive metrics for, write a 1-2 sentence sharp verdict (monetization potential, content angle, who wins here). Return ONLY JSON: {"<keyword>":"verdict", ...}`

function parseJson(text: string): unknown {
  try {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    const raw = fenced ? fenced[1] : text
    const firstBracket = raw.indexOf('[')
    const firstBrace = raw.indexOf('{')
    let start = -1
    if (firstBracket >= 0 && firstBrace >= 0) {
      start = Math.min(firstBracket, firstBrace)
    } else {
      start = Math.max(firstBracket, firstBrace)
    }
    if (start >= 0) {
      const candidate = raw.slice(start)
      const lastBracket = candidate.lastIndexOf(']')
      const lastBrace = candidate.lastIndexOf('}')
      const end = Math.max(lastBracket, lastBrace)
      if (end >= 0) {
        return JSON.parse(candidate.slice(0, end + 1))
      }
      return JSON.parse(candidate)
    }
    return JSON.parse(text)
  } catch (err) {
    console.warn('[NicheAI] parseJson failed to parse text:', text, err)
    return null
  }
}

export async function suggestSubNiches(topic: string): Promise<string[]> {
  try {
    const model = getBestNicheModel()
    const { text } = await generateText({
      model,
      system: SYS_SUBNICHES,
      prompt: `Broad topic: ${topic.trim()}`
    })
    const arr = parseJson(text)
    if (Array.isArray(arr) && arr.length) {
      return arr.map(a => String(a).toLowerCase())
    }
    const matches = text.match(/"([^"]+)"/g)
    if (matches && matches.length >= 3) {
      return matches.slice(0, 8).map(m => m.replace(/"/g, '').toLowerCase())
    }
  } catch (err) {
    console.warn('[NicheAI] suggestSubNiches model call failed:', err)
  }

  const cleanTopic = topic.trim().toLowerCase()
  return [
    `${cleanTopic} mysteries`,
    `${cleanTopic} origin secrets`,
    `${cleanTopic} unsolved cases`,
    `dark truth about ${cleanTopic}`,
    `ancient ${cleanTopic} discoveries`,
    `${cleanTopic} documentary deep dive`,
    `hidden ${cleanTopic} archives`,
    `the downfall of ${cleanTopic}`
  ]
}

export async function nicheVerdicts(
  summary: string
): Promise<Record<string, string>> {
  try {
    const model = getBestNicheModel()
    const { text } = await generateText({
      model,
      system: SYS_VERDICT,
      prompt: summary
    })
    const v = parseJson(text)
    if (v && typeof v === 'object' && v !== null) {
      return v as Record<string, string>
    }
  } catch (err) {
    console.warn('[NicheAI] nicheVerdicts model call failed:', err)
  }
  return {}
}
