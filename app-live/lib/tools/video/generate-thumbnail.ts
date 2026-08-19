import { tool } from 'ai'
import { z } from 'zod'

import {
  generateImageModelArk,
  MODELARK_DEFAULT_THUMBNAIL_MODEL
} from '@/lib/engine/image'

const thumbnailSchema = z.object({
  concept: z
    .string()
    .describe(
      'The thumbnail scene/idea — the subject, emotion, setting and visual hook that will make people click. Be concrete and punchy.'
    ),
  titleText: z
    .string()
    .optional()
    .describe(
      'Short bold text to render ON the thumbnail (a few words max) — keep it 2–5 impactful words.'
    ),
  referenceImageUrl: z
    .string()
    .optional()
    .describe(
      'Optional reference image URL (a face, subject, product or logo) to feature consistently in the thumbnail.'
    )
})

// Build a click-optimized YouTube thumbnail prompt, rendered with ModelArk (Seedream).
function buildThumbnailPrompt(concept: string, titleText?: string): string {
  const parts = [
    'YouTube thumbnail, 16:9, ultra high contrast, bold saturated colors, dramatic rim lighting,',
    'sharp focus on the subject, shallow depth of field, punchy and eye-catching for a small preview size.',
    concept.trim()
  ]
  if (titleText?.trim()) {
    parts.push(
      `Render the exact text "${titleText.trim()}" as a large, bold, legible headline with a strong outline/shadow so it pops. Do not misspell it.`
    )
  }
  return parts.join(' ')
}

export function createGenerateThumbnailTool() {
  return tool({
    description:
      "Generate a click-optimized YouTube thumbnail (16:9) from a text prompt using ModelArk (Seedream). Returns a hosted image URL you can pass as composeRender's thumbnail. Honors an optional reference image (a face, subject or logo) for consistency.",
    inputSchema: thumbnailSchema,
    execute: async (
      { concept, titleText, referenceImageUrl },
      { abortSignal }
    ) => {
      const img = await generateImageModelArk(
        buildThumbnailPrompt(concept, titleText),
        {
          model: MODELARK_DEFAULT_THUMBNAIL_MODEL,
          referenceImages: referenceImageUrl ? [referenceImageUrl] : undefined,
          abortSignal
        }
      )
      return {
        state: 'complete' as const,
        imageUrl: img.imageUrl,
        model: img.model,
        titleText: titleText || undefined
      }
    }
  })
}
