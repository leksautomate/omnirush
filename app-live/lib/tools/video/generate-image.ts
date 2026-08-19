import { tool } from 'ai'
import { z } from 'zod'

import { generateImageModelArk } from '@/lib/engine/image'

const imageSchema = z.object({
  prompt: z
    .string()
    .describe(
      'A detailed description of the image to generate — subject, setting, style, lighting, composition. Be specific and cinematic.'
    ),
  aspectRatio: z
    .enum(['16:9', '1:1', '9:16', '4:3', '3:2'])
    .optional()
    .describe(
      'Aspect ratio of the image (default 16:9 for video shots). Not currently wired to ModelArk\'s size parameter — images render at its default size regardless.'
    ),
  referenceImageUrl: z
    .string()
    .optional()
    .describe(
      'Optional reference image URL to condition on (a subject, face, product or logo to keep consistent).'
    )
})

// Generate a still image / b-roll frame with ModelArk (Seedream). The returned URL can
// be dropped straight into a composeRender shot's `src` when no real footage fits the
// beat.
export function createGenerateImageTool() {
  return tool({
    description:
      "Generate a still image (b-roll frame, illustration, concept art) from a text prompt using ModelArk (Seedream). Returns a hosted image URL you can use as a shot's `src` in composeRender when no real sourced footage fits the beat. For click-optimized YouTube thumbnails use generateThumbnail instead.",
    inputSchema: imageSchema,
    execute: async ({ prompt, referenceImageUrl }, { abortSignal }) => {
      const img = await generateImageModelArk(prompt, {
        referenceImages: referenceImageUrl ? [referenceImageUrl] : undefined,
        abortSignal
      })
      return {
        state: 'complete' as const,
        imageUrl: img.imageUrl,
        model: img.model
      }
    }
  })
}
