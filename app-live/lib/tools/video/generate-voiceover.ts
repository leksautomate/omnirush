import { tool } from 'ai'
import { z } from 'zod'

import { kvSetJSON } from '@/lib/engine/kv'
import { generateVoiceoverSpeechify, type VoiceWord } from '@/lib/engine/voice'

const voiceoverSchema = z.object({
  script: z
    .string()
    .describe(
      'The full narration script to voice (the clean output of writeScript)'
    ),
  voiceId: z
    .string()
    .optional()
    .describe(
      'A Speechify voice id (a UUID). Omit to use the default house voice.'
    ),
  voiceName: z
    .string()
    .optional()
    .describe('Human-friendly voice name for display, if known')
})

// What we stash in KV under the voiceoverId — too big to thread through the model.
export interface VoiceoverHandle {
  audioUrl?: string
  words: VoiceWord[]
  durationSec: number
  voiceId: string
}

// Generate a voiceover for the script via Speechify and return a small handle. The
// resulting audio is hosted on R2/S3 (or a local file in dev — see
// lib/engine/voice.ts). The bulky word-timings array is stored in KV under voiceoverId
// so cutBeats can lock the storyboard to real speech and composeRender can pull the
// audio URL — without the model ever carrying it.
export function createGenerateVoiceoverTool() {
  return tool({
    description:
      "Generate a spoken voiceover (TTS) for a narration script via Speechify. Pass the FULL script verbatim — do not trim or shorten it for length; long scripts are automatically split into chunks at sentence boundaries and stitched into one audio file, so there is no practical length limit here. Returns a voiceoverId plus the audio URL and duration. Pass the voiceoverId to cutBeats (so shots lock to actual speech) and to composeRender (so it mixes in the narration). Run after writeScript.",
    inputSchema: voiceoverSchema,
    execute: async ({ script, voiceId, voiceName }, { abortSignal }) => {
      const vo = await generateVoiceoverSpeechify(script, { voiceId, abortSignal })
      const handle: VoiceoverHandle = {
        audioUrl: vo.audioUrl,
        words: vo.words,
        durationSec: vo.durationSec,
        voiceId: vo.voiceId
      }

      const voiceoverId = `vo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
      await kvSetJSON(`voiceover:${voiceoverId}`, handle)

      return {
        state: 'complete' as const,
        voiceoverId,
        audioUrl: handle.audioUrl,
        durationSec: handle.durationSec,
        wordCount: handle.words.length,
        voiceId: handle.voiceId,
        voiceName: voiceName || undefined
      }
    }
  })
}
