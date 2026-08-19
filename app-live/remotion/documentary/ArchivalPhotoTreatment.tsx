import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'

import { type MediaFit, MediaFrame } from '../MediaFrame'

import { DocumentaryBackground } from './DocumentaryBackground'

export function ArchivalPhotoTreatment({
  src,
  subjectFocus = { x: 0.5, y: 0.5 },
  mediaFit = 'contain',
  filmTreatment = false
}: {
  src: string
  subjectFocus?: { x: number; y: number }
  mediaFit?: MediaFit
  filmTreatment?: boolean
}) {
  const frame = useCurrentFrame()
  const animateFullFrame = mediaFit === 'cover'
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#11100E' }}>
      <MediaFrame
        src={src}
        fit={mediaFit}
        foregroundStyle={{
          transformOrigin: `${subjectFocus.x * 100}% ${subjectFocus.y * 100}%`,
          scale: animateFullFrame
            ? interpolate(frame, [0, 240], [1, 1.08], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp'
              })
            : undefined,
          translate: animateFullFrame
            ? interpolate(frame, [0, 240], ['0px 0px', '-18px -8px'], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp'
              })
            : undefined,
          filter: 'sepia(0.2) contrast(1.08) saturate(0.82)'
        }}
      />
      {filmTreatment ? (
        <AbsoluteFill style={{ opacity: 0.24, mixBlendMode: 'screen' }}>
          <DocumentaryBackground id="bg3" />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  )
}
