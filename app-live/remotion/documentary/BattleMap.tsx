import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'

import type { DocumentaryGraphic } from '../documentary-schema'

type MapGraphic = Extract<
  DocumentaryGraphic,
  { type: 'battle-map' | 'strategic-overlay' }
>

function position(point: [number, number] | undefined, index: number) {
  if (!point)
    return {
      left: `${20 + (index % 4) * 20}%`,
      top: `${35 + (index % 2) * 28}%`
    }
  const [longitude, latitude] = point
  return {
    left: `${((longitude + 180) / 360) * 76 + 12}%`,
    top: `${((90 - latitude) / 180) * 68 + 16}%`
  }
}

export function BattleMap({
  graphic,
  durationInFrames
}: {
  graphic: MapGraphic
  durationInFrames: number
}) {
  const frame = useCurrentFrame()
  const units = graphic.type === 'battle-map' ? graphic.units : []
  const frontLines = graphic.type === 'battle-map' ? graphic.frontLines : []
  const annotations = graphic.type === 'battle-map' ? graphic.annotations : []
  return (
    <AbsoluteFill style={{ color: '#F2EBDD', padding: '5% 6%' }}>
      <div style={{ fontSize: 26, letterSpacing: 5, color: '#B6924A' }}>
        {graphic.type === 'battle-map'
          ? graphic.dateLabel
          : 'STRATEGIC OVERVIEW'}
      </div>
      <div
        style={{
          fontFamily: 'Impact, sans-serif',
          fontSize: 66,
          letterSpacing: 5,
          marginTop: 8
        }}
      >
        {graphic.theatre.toUpperCase()}
      </div>
      <svg
        aria-label={`${graphic.theatre} battle map`}
        viewBox="0 0 1000 520"
        style={{
          position: 'absolute',
          inset: '18% 6% 8%',
          width: '88%',
          height: '72%'
        }}
      >
        <g
          opacity={interpolate(frame, [0, durationInFrames * 0.2], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp'
          })}
        >
          {frontLines.map((line, index) => (
            <polyline
              key={line.id}
              points={line.points
                .map(
                  (_, pointIndex) =>
                    `${100 + pointIndex * 180},${180 + index * 80}`
                )
                .join(' ')}
              fill="none"
              stroke="#B6924A"
              strokeWidth="5"
              strokeDasharray="14 10"
            />
          ))}
        </g>
        <g
          opacity={interpolate(
            frame,
            [durationInFrames * 0.38, durationInFrames * 0.7],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          )}
        >
          {graphic.routes.map((route, routeIndex) => (
            <path
              key={route.id}
              d={`M ${100 + routeIndex * 70} 390 Q 500 ${80 + routeIndex * 35} ${850 - routeIndex * 45} 160`}
              fill="none"
              stroke={route.allegiance === 'axis' ? '#A4473E' : '#4776B9'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray="18 12"
            />
          ))}
        </g>
      </svg>
      {units.map((unit, index) => (
        <div
          key={unit.id}
          style={{
            position: 'absolute',
            ...position(unit.position, index),
            padding: '10px 16px',
            border: `2px solid ${unit.allegiance === 'axis' ? '#A4473E' : '#4776B9'}`,
            backgroundColor: 'rgba(12,12,12,.82)',
            fontSize: 19,
            opacity: interpolate(
              frame,
              [durationInFrames * 0.2, durationInFrames * 0.4],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            )
          }}
        >
          {unit.name}
        </div>
      ))}
      {graphic.objectives.map((objective, index) => (
        <div
          key={objective.id}
          style={{
            position: 'absolute',
            ...position(objective.position, index + units.length),
            color: '#D9B85B',
            fontSize: 22,
            fontWeight: 700
          }}
        >
          ◆ {objective.label}
        </div>
      ))}
      {annotations.map(annotation => (
        <div
          key={annotation}
          style={{
            position: 'absolute',
            bottom: '5%',
            right: '6%',
            color: '#D8C7A3'
          }}
        >
          {annotation}
        </div>
      ))}
    </AbsoluteFill>
  )
}
