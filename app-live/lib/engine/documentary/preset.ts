import type { ContentProfile } from './schema'

export const WW1_WW2_DOCUMENTARY_PRESET = {
  profile: {
    niche: 'ww1_ww2',
    format: 'documentary',
    presetVersion: 1
  },
  palette: {
    charcoal: '#171717',
    parchment: '#D8C7A3',
    brass: '#B6924A',
    offWhite: '#F2EBDD',
    allied: '#4776B9',
    axis: '#A4473E',
    neutral: '#77736B'
  },
  openingDateRequired: true,
  defaultActs: [
    'cold-open',
    'strategic-context',
    'build-up',
    'conflict',
    'turning-point',
    'aftermath',
    'epilogue'
  ]
} as const

export function resolveContentProfile(
  niche: 'ww1_ww2',
  format: 'documentary'
): ContentProfile {
  if (niche !== 'ww1_ww2' || format !== 'documentary') {
    throw new Error(`Unsupported content profile: ${niche}/${format}`)
  }

  return { ...WW1_WW2_DOCUMENTARY_PRESET.profile }
}
