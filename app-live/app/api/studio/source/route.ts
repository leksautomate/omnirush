import { NextResponse } from 'next/server'

import { sourceCandidates } from '@/lib/engine/sourcing'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/studio/source { query: string, limit?: number }
// Searches open archives (Wikimedia, Internet Archive, NARA) and configured web search
// to return b-roll media candidates for one-click asset swapping in the Studio.
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const query = String(body.query || '').trim()
    if (!query) {
      return NextResponse.json(
        { error: 'query string is required' },
        { status: 400 }
      )
    }
    const limit = Math.min(24, Math.max(1, Number(body.limit) || 12))
    const candidates = await sourceCandidates([query], {
      limit,
      includeWeb: true
    })

    return NextResponse.json({ candidates })
  } catch (error) {
    console.error('[API /api/studio/source] Error sourcing candidates:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Footage sourcing failed'
      },
      { status: 500 }
    )
  }
}
