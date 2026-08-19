import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'

import type { DocumentaryGraphic } from '../documentary-schema'

type ForceGraphic = Extract<DocumentaryGraphic, { type: 'force-comparison' }>

export function ForceComparison({ graphic }: { graphic: ForceGraphic }) {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ padding: '6% 7%', color: '#F2EBDD' }}>
      <div
        style={{
          textAlign: 'center',
          color: '#B6924A',
          letterSpacing: 6,
          fontSize: 24
        }}
      >
        FORCES COMMITTED
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${graphic.sides.length}, 1fr)`,
          gap: 30,
          marginTop: 50
        }}
      >
        {graphic.sides.map((side, index) => (
          <div
            key={side.name}
            style={{
              padding: 34,
              backgroundColor: 'rgba(12,12,12,.78)',
              borderTop: `7px solid ${side.allegiance === 'axis' ? '#A4473E' : side.allegiance === 'allied' ? '#4776B9' : '#77736B'}`,
              opacity: interpolate(frame, [index * 8, index * 8 + 14], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp'
              })
            }}
          >
            <div
              style={{
                fontFamily: 'Impact, sans-serif',
                fontSize: 43,
                letterSpacing: 2
              }}
            >
              {side.name}
            </div>
            <div
              style={{
                marginTop: 28,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 18,
                fontSize: 24
              }}
            >
              {(
                [
                  'personnel',
                  'aircraft',
                  'ships',
                  'vehicles',
                  'artillery'
                ] as const
              ).map(key =>
                side[key] === undefined ? null : (
                  <div key={key}>
                    <strong>{side[key]?.toLocaleString()}</strong>
                    <br />
                    <span style={{ color: '#BEB5A4' }}>
                      {key.toUpperCase()}
                    </span>
                  </div>
                )
              )}
            </div>
            {side.highlightedAdvantage ? (
              <div style={{ marginTop: 30, color: '#D9B85B' }}>
                {side.highlightedAdvantage}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  )
}
