'use client'

import React from 'react'

import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig
} from 'remotion'

interface NumberCounterProps {
  targetValue?: number
  startValue?: number
  label?: string
  prefix?: string
  suffix?: string
  accent?: string
  durationFrames?: number
}

export const NumberCounter: React.FC<NumberCounterProps> = ({
  targetValue = 24813,
  startValue = 0,
  label,
  prefix = '',
  suffix = '',
  accent = '#ff6b00',
  durationFrames = 60
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 120 }
  })

  const progress = interpolate(frame, [0, durationFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.exp)
  })

  const current = Math.round(
    startValue + progress * (targetValue - startValue)
  )

  const scale = interpolate(entrance, [0, 1], [0.8, 1])
  const opacity = interpolate(entrance, [0, 1], [0, 1])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${scale})`,
        opacity,
        fontFamily:
          '"DejaVu Sans", system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          color: '#ffffff',
          fontWeight: 900,
          fontSize: '72px',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-2px',
          lineHeight: 1,
          textShadow: '0 4px 20px rgba(0,0,0,0.8)'
        }}
      >
        {prefix && (
          <span style={{ color: accent, marginRight: '4px', fontSize: '56px' }}>
            {prefix}
          </span>
        )}
        <span>{current.toLocaleString('en-US')}</span>
        {suffix && (
          <span style={{ color: accent, marginLeft: '4px', fontSize: '56px' }}>
            {suffix}
          </span>
        )}
      </div>

      {label && (
        <span
          style={{
            marginTop: '8px',
            color: '#d1d5db',
            fontSize: '16px',
            fontWeight: 800,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            textShadow: '0 2px 8px rgba(0,0,0,0.6)'
          }}
        >
          {label}
        </span>
      )}
    </div>
  )
}
