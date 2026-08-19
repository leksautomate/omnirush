import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig
} from 'remotion'

import type { DocumentaryGraphic } from '../documentary-schema'

type TimelineGraphic = Extract<
  DocumentaryGraphic,
  { type: 'military-timeline' }
>

export function MilitaryTimeline({ graphic }: { graphic: TimelineGraphic }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (
    <AbsoluteFill style={{ padding: '7% 8%', color: '#171717' }}>
      <div style={{ color: '#715A2E', letterSpacing: 4, fontSize: 22 }}>
        MILITARY TIMELINE
      </div>
      <div
        style={{
          marginTop: 55,
          height: 5,
          backgroundColor: 'rgba(23,23,23,.2)'
        }}
      >
        <div
          style={{
            width: `${interpolate(frame, [0, Math.max(fps, graphic.events.length * fps)], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}%`,
            height: '100%',
            backgroundColor: '#B6924A'
          }}
        />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${graphic.events.length}, 1fr)`,
          gap: 24,
          marginTop: -15
        }}
      >
        {graphic.events.map((event, index) => (
          <div
            key={event.id}
            style={{
              opacity: interpolate(
                frame,
                [index * 10, index * 10 + 12],
                [0.28, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              )
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 20,
                backgroundColor:
                  event.importance === 'critical' ? '#B6924A' : '#6F6A61',
                border: '5px solid #E7DCC3'
              }}
            />
            <div style={{ marginTop: 24, fontSize: 24, fontWeight: 800 }}>
              {event.date}
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 30,
                fontFamily: 'Georgia, serif'
              }}
            >
              {event.title}
            </div>
            {event.description ? (
              <div style={{ marginTop: 10, fontSize: 20, lineHeight: 1.35 }}>
                {event.description}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  )
}
