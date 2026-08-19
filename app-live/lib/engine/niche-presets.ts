import { WW1_WW2_DOCUMENTARY_PRESET } from './documentary/preset'

export type ContentNiche =
  | 'history_ww1_ww2'
  | 'finance_business'
  | 'science_tech_space'
  | 'mystery_true_crime'
  | 'general'

export interface NichePresetConfig {
  niche: ContentNiche
  name: string
  accentColor: string
  captionStyle: 'normal' | 'tiktok'
  recommendedSfx: string[]
  overlayRules: {
    datesAndLocations?: 'typewriter'
    statisticsAndNumbers?: 'number-counter' | 'circular-progress'
    dramaticClimax?: 'film-burn' | 'camera-shake'
    techOrAlert?: 'glitch'
  }
  contentProfile?: {
    niche: 'ww1_ww2'
    format: 'documentary'
    presetVersion: 1
  }
}

export const NICHE_PRESETS: Record<ContentNiche, NichePresetConfig> = {
  history_ww1_ww2: {
    niche: 'history_ww1_ww2',
    name: 'WW1 / WW2 & History',
    accentColor: '#c29b38', // Historical gold/brass
    captionStyle: 'normal',
    recommendedSfx: ['whoosh', 'whip'],
    overlayRules: {
      datesAndLocations: 'typewriter',
      dramaticClimax: 'film-burn'
    },
    contentProfile: { ...WW1_WW2_DOCUMENTARY_PRESET.profile }
  },
  finance_business: {
    niche: 'finance_business',
    name: 'Finance & Crypto',
    accentColor: '#10b981', // Emerald green
    captionStyle: 'tiktok',
    recommendedSfx: ['pop', 'whoosh'],
    overlayRules: {
      statisticsAndNumbers: 'number-counter'
    }
  },
  science_tech_space: {
    niche: 'science_tech_space',
    name: 'Science, Space & Tech',
    accentColor: '#3b82f6', // Electric blue
    captionStyle: 'tiktok',
    recommendedSfx: ['whoosh', 'pop'],
    overlayRules: {
      statisticsAndNumbers: 'circular-progress',
      techOrAlert: 'glitch'
    }
  },
  mystery_true_crime: {
    niche: 'mystery_true_crime',
    name: 'True Crime & Mystery',
    accentColor: '#dc2626', // Crimson red
    captionStyle: 'normal',
    recommendedSfx: ['whip', 'whoosh'],
    overlayRules: {
      datesAndLocations: 'typewriter',
      dramaticClimax: 'camera-shake'
    }
  },
  general: {
    niche: 'general',
    name: 'General / Viral',
    accentColor: '#ff2d55',
    captionStyle: 'tiktok',
    recommendedSfx: ['whoosh', 'pop'],
    overlayRules: {}
  }
}

/**
 * Automatically detects the content niche from prompt, topic, or script text.
 */
export function detectNicheFromPrompt(text: string): NichePresetConfig {
  const lower = (text || '').toLowerCase()

  if (
    lower.includes('ww1') ||
    lower.includes('ww2') ||
    lower.includes('world war') ||
    lower.includes('history') ||
    lower.includes('reformer') ||
    lower.includes('century') ||
    lower.includes('empire') ||
    lower.includes('medieval') ||
    lower.includes('ancient')
  ) {
    return NICHE_PRESETS.history_ww1_ww2
  }

  if (
    lower.includes('finance') ||
    lower.includes('money') ||
    lower.includes('crypto') ||
    lower.includes('bitcoin') ||
    lower.includes('billionaire') ||
    lower.includes('stock') ||
    lower.includes('revenue') ||
    lower.includes('economy')
  ) {
    return NICHE_PRESETS.finance_business
  }

  if (
    lower.includes('space') ||
    lower.includes('apollo') ||
    lower.includes('tech') ||
    lower.includes('ai') ||
    lower.includes('science') ||
    lower.includes('physics') ||
    lower.includes('galaxy')
  ) {
    return NICHE_PRESETS.science_tech_space
  }

  if (
    lower.includes('crime') ||
    lower.includes('mystery') ||
    lower.includes('unsolved') ||
    lower.includes('investigation') ||
    lower.includes('killer')
  ) {
    return NICHE_PRESETS.mystery_true_crime
  }

  return NICHE_PRESETS.general
}
