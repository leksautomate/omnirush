import { AbsoluteFill, Loop, OffthreadVideo, staticFile } from 'remotion'

import { getDocumentaryBackground } from '../../lib/engine/documentary/backgrounds'
import type { DocumentaryBackgroundId } from '../../lib/engine/documentary/schema'

export function DocumentaryBackground({ id }: { id: DocumentaryBackgroundId }) {
  const background = getDocumentaryBackground(id)
  const loopFrames = id === 'bg1' || id === 'bg2' ? 150 : 300
  return (
    <AbsoluteFill style={{ backgroundColor: '#11100E', overflow: 'hidden' }}>
      <Loop durationInFrames={loopFrames}>
        <OffthreadVideo
          src={staticFile(background.src.replace(/^\//u, ''))}
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: background.fit,
            opacity: background.opacity ?? 1
          }}
        />
      </Loop>
    </AbsoluteFill>
  )
}
