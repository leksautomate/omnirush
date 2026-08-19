import { DEMO_STORYBOARD } from '@/lib/constants/demo-storyboard'

import { StudioCanvas } from '@/components/studio-canvas'

// /studio — default studio workstation with sample storyboard
export default function StudioIndexPage() {
  return <StudioCanvas id="demo" storyboard={DEMO_STORYBOARD} />
}
