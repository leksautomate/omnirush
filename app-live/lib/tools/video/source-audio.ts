import { tool } from 'ai'
import { z } from 'zod'

import {
  parseAudioCatalog,
  selectAudioTrack,
  toCatalogAudioUrl,
  toMusicCredit
} from '@/lib/engine/audio-catalog'

import catalogData from '@/public/audio/catalog.json'
import { audioCueSchema } from '@/remotion/schema'

const sourceAudioSchema = z.object({
  kind: z
    .enum(['sfx', 'ambient'])
    .describe('Use sfx for short hits/transitions, ambient for scene atmosphere'),
  prompt: z
    .string()
    .min(1)
    .describe('Describe the desired sound and scene context'),
  start: z.number().min(0).describe('Cue start time in seconds'),
  duration: z.number().positive().optional(),
  volume: z.number().min(0).max(2).optional(),
  loop: z.boolean().optional(),
  fadeIn: z.number().min(0).optional(),
  fadeOut: z.number().min(0).optional(),
  allowContentId: z.boolean().optional()
})

const catalogue = parseAudioCatalog(catalogData)

export function createSourceAudioTool() {
  return tool({
    description:
      "Select a sound effect or ambience layer from Kakkao's curated local Pixabay catalogue. Returns a complete timeline audioCue with start, duration, volume, looping, fades, creator, original source page and licence metadata. Add the returned audioCue to composeRender.audioCues. Content ID registered assets are excluded by default.",
    inputSchema: sourceAudioSchema,
    execute: async input => {
      const selected = selectAudioTrack(catalogue, {
        prompt: input.prompt,
        kind: input.kind,
        allowContentId: input.allowContentId ?? false
      })

      if (!selected) {
        return {
          state: 'complete' as const,
          audioCue: null,
          note: `No eligible curated ${input.kind} track is installed.`
        }
      }

      const audioCue = audioCueSchema.parse({
        id: `${selected.id}-${Math.round(input.start * 1000)}`,
        kind: input.kind,
        src: toCatalogAudioUrl(selected),
        start: input.start,
        duration: input.duration ?? selected.durationSec,
        volume: input.volume ?? (input.kind === 'ambient' ? 0.2 : 0.5),
        loop: input.loop ?? input.kind === 'ambient',
        fadeIn: input.fadeIn ?? (input.kind === 'ambient' ? 0.5 : 0),
        fadeOut: input.fadeOut ?? (input.kind === 'ambient' ? 0.75 : 0),
        credit: toMusicCredit(selected)
      })

      return {
        state: 'complete' as const,
        audioCue,
        title: selected.title,
        creator: selected.creator,
        sourceUrl: selected.sourceUrl,
        note: 'Selected from the curated local Pixabay catalogue.'
      }
    }
  })
}
