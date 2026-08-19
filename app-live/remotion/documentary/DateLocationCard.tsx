import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'

import type { DocumentaryGraphic } from '../documentary-schema'

type DateGraphic = Extract<DocumentaryGraphic, { type: 'date-location' }>

export function DateLocationCard({ graphic }: { graphic: DateGraphic }) {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        padding: '0 9%',
        color: '#F2EBDD',
        background:
          'linear-gradient(90deg, rgba(10,9,8,.9), rgba(10,9,8,.2), transparent)'
      }}
    >
      <div
        style={{
          width: 180,
          height: 4,
          backgroundColor: '#B6924A',
          marginBottom: 26,
          opacity: interpolate(frame, [0, 12], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp'
          })
        }}
      />
      <div
        style={{
          fontFamily: 'Impact, Haettenschweiler, sans-serif',
          fontSize: 92,
          letterSpacing: 8,
          lineHeight: 1,
          opacity: interpolate(frame, [2, 14], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp'
          }),
          translate: interpolate(frame, [2, 14], ['-28px 0px', '0px 0px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp'
          })
        }}
      >
        {graphic.date.toUpperCase()}
      </div>
      <div
        style={{
          marginTop: 24,
          fontFamily: 'Arial, sans-serif',
          fontSize: 38,
          letterSpacing: 5,
          color: '#D8C7A3'
        }}
      >
        {graphic.location.toUpperCase()}
      </div>
      {graphic.operation ? (
        <div style={{ marginTop: 18, fontSize: 24, color: '#B6924A' }}>
          {graphic.operation}
        </div>
      ) : null}
    </AbsoluteFill>
  )
}
