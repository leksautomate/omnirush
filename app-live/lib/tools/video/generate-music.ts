import { tool } from 'ai'
import { z } from 'zod'

import {
  parseAudioCatalog,
  selectAudioTrack,
  toCatalogAudioUrl,
  toMusicCredit
} from '@/lib/engine/audio-catalog'

import catalogData from '@/public/audio/catalog.json'

const musicSchema = z.object({
  prompt: z
    .string()
    .describe(
      'Describe the music bed — mood, genre, tempo, instruments (e.g. "tense cinematic documentary underscore, low strings, slow build")'
    ),
  instrumental: z
    .boolean()
    .optional()
    .describe('Instrumental only (default true — recommended under narration)'),
  allowContentId: z
    .boolean()
    .optional()
    .describe(
      'Allow tracks marked Content ID Registered (default false; only enable when the publisher accepts claim-management risk)'
    )
})

const catalogue = parseAudioCatalog(catalogData)

// Keep the existing tool name so stored chats and the agent tool map remain compatible.
// This sources a provenance-checked local track; it does not generate music.
export function createGenerateMusicTool() {
  return tool({
    description:
      "Select a background music bed from Kakkao's curated local Pixabay catalogue. Matches the prompt against track mood, genre and tags; instrumental tracks are preferred and Content ID registered tracks are excluded by default. Returns a bundled audio URL plus creator, original Pixabay page and licence metadata to pass to composeRender as musicCredit.",
    inputSchema: musicSchema,
    execute: async ({ prompt, instrumental, allowContentId }) => {
      const selected = selectAudioTrack(catalogue, {
        prompt,
        kind: 'music',
        instrumental: instrumental ?? true,
        allowContentId: allowContentId ?? false
      })

      if (!selected) {
        return {
          state: 'complete' as const,
          audioUrl: null,
          title: null,
          durationSec: 0,
          musicCredit: null,
          catalogueSize: catalogue.tracks.filter(
            track => track.kind === 'music'
          ).length,
          note: 'No eligible curated music track is installed. Add a downloaded Pixabay track and its provenance to public/audio/catalog.json.'
        }
      }

      return {
        state: 'complete' as const,
        audioUrl: toCatalogAudioUrl(selected),
        title: selected.title,
        creator: selected.creator,
        durationSec: selected.durationSec,
        musicCredit: toMusicCredit(selected),
        catalogueSize: catalogue.tracks.filter(track => track.kind === 'music')
          .length,
        note: 'Selected from the curated local Pixabay catalogue.'
      }
    }
  })
}
