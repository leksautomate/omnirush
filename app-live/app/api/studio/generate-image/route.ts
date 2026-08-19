import { NextResponse } from 'next/server'

import { generateImageModelArk } from '@/lib/engine/image'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/studio/generate-image { prompt: string }
// Generates a custom still image from text prompt via ModelArk Seedream and hosts it durably.
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const prompt = String(body.prompt || '').trim()
    if (!prompt) {
      return NextResponse.json(
        { error: 'prompt is required' },
        { status: 400 }
      )
    }

    const result = await generateImageModelArk(prompt)
    return NextResponse.json({
      imageUrl: result.imageUrl,
      model: result.model
    })
  } catch (error) {
    console.error('[API /api/studio/generate-image] Error generating image:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Image generation failed'
      },
      { status: 500 }
    )
  }
}
