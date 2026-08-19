import { notFound } from 'next/navigation'

import { DEMO_STORYBOARD } from '@/lib/constants/demo-storyboard'
import { kvGetJSON } from '@/lib/engine/kv'

import { StudioCanvas } from '@/components/studio-canvas'

import type { StoryboardInput } from '@/remotion/schema'

// /studio/[id] — interactive Remotion canvas for a storyboard.
export default async function StudioPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  if (id === 'demo' || id === 'new') {
    return <StudioCanvas id={id} storyboard={DEMO_STORYBOARD} />
  }

  const storyboard = await kvGetJSON<StoryboardInput>(`storyboard:${id}`)
  if (!storyboard) {
    // If not found in KV (e.g. cold start or fresh local run), fall back to demo so the user is never stranded on a 404
    return <StudioCanvas id={id} storyboard={DEMO_STORYBOARD} />
  }

  return <StudioCanvas id={id} storyboard={storyboard} />
}
