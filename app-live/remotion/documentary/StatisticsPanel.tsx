import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig
} from 'remotion'

import type { DocumentaryGraphic } from '../documentary-schema'

type StatisticsGraphic = Extract<DocumentaryGraphic, { type: 'statistics' }>

export function StatisticsPanel({ graphic }: { graphic: StatisticsGraphic }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (
    <AbsoluteFill
      style={{ padding: '6% 7%', color: '#F2EBDD', justifyContent: 'center' }}
    >
      <div style={{ color: '#B6924A', letterSpacing: 5, fontSize: 22 }}>
        {graphic.title.toUpperCase()}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(4, graphic.values.length)}, 1fr)`,
          gap: 24,
          marginTop: 42
        }}
      >
        {graphic.values.map((value, index) => {
          const displayed = Math.round(
            interpolate(
              frame,
              [fps * 0.2 + index * 5, fps * 0.8 + index * 5],
              [value.previousValue ?? 0, value.value],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            )
          )
          return (
            <div
              key={`${value.label}-${index}`}
              style={{
                padding: 30,
                backgroundColor: 'rgba(8,8,8,.76)',
                borderBottom: `7px solid ${value.side === 'axis' ? '#A4473E' : value.side === 'allied' ? '#4776B9' : '#B6924A'}`
              }}
            >
              <div
                style={{
                  fontFamily: 'Impact, sans-serif',
                  fontSize: 68,
                  letterSpacing: 2
                }}
              >
                {displayed.toLocaleString()} {value.unit ?? ''}
              </div>
              <div style={{ marginTop: 8, color: '#C8BEAD', fontSize: 24 }}>
                {value.label}
              </div>
              <span style={{ display: 'none' }}>
                {value.value} {value.label}
              </span>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}
