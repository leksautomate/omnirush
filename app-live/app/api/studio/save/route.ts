import { NextResponse } from 'next/server'

import { kvSetJSON } from '@/lib/engine/kv'

import { storyboardInputSchema } from '@/remotion/schema'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/studio/save { id: string, storyboard: StoryboardInput }
// Persists modifications made in the Studio editor back to Redis KV.
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const id = String(body.id || '').trim()
    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const parseResult = storyboardInputSchema.safeParse(body.storyboard)
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid storyboard data',
          details: parseResult.error.format()
        },
        { status: 400 }
      )
    }

    // Persist for 6 hours (matches default TTL in kvSetJSON)
    await kvSetJSON(`storyboard:${id}`, parseResult.data, 60 * 60 * 6)

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('[API /api/studio/save] Error saving storyboard:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to save storyboard'
      },
      { status: 500 }
    )
  }
}
