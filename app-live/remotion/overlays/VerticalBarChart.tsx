'use client'

import React from 'react'

import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig
} from 'remotion'

export interface BarChartItem {
  label: string
  value: number
  highlighted?: boolean
}

export interface VerticalBarChartProps {
  title?: string
  bars?: BarChartItem[]
  accent?: string
}

export const VerticalBarChart: React.FC<VerticalBarChartProps> = ({
  title = 'Historical Comparison Statistics',
  bars = [
    { label: 'Allied Forces', value: 156, highlighted: false },
    { label: 'Axis Forces', value: 89, highlighted: false },
    { label: 'Total Mobilized', value: 245, highlighted: true }
  ],
  accent = '#ff6b00'
}) => {
  const frame = useCurrentFrame()
  const { fps, width } = useVideoConfig()

  const maxValue = Math.max(...bars.map(b => b.value), 1)

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(10, 10, 15, 0.85)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px 40px',
        zIndex: 35,
        fontFamily:
          '"DejaVu Sans", system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      }}
    >
      {/* Title */}
      <h2
        style={{
          color: '#ffffff',
          fontSize: width < 800 ? '22px' : '32px',
          fontWeight: 900,
          marginBottom: '32px',
          textAlign: 'center',
          letterSpacing: '-0.5px',
          textShadow: '0 2px 10px rgba(0,0,0,0.8)'
        }}
      >
        {title}
      </h2>

      {/* Chart container */}
      <div
        style={{
          width: '80%',
          maxWidth: '720px',
          height: '240px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-around',
          position: 'relative',
          borderBottom: '3px solid rgba(255, 255, 255, 0.3)',
          paddingBottom: '8px'
        }}
      >
        {bars.map((bar, idx) => {
          const delayFrames = idx * 6
          const relFrame = Math.max(0, frame - delayFrames)

          const growth = spring({
            frame: relFrame,
            fps,
            config: { damping: 14, mass: 0.8, stiffness: 100 }
          })

          const heightPercent = (bar.value / maxValue) * 85 * growth
          const currentValue = Math.round(bar.value * Math.min(1, growth))

          const barColor = bar.highlighted ? accent : '#9ca3af'

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                height: '100%',
                flex: 1,
                maxWidth: '140px',
                margin: '0 12px'
              }}
            >
              {/* Number on top of bar */}
              <div
                style={{
                  color: bar.highlighted ? '#ffffff' : '#e5e7eb',
                  fontSize: '24px',
                  fontWeight: 900,
                  marginBottom: '8px',
                  opacity: growth > 0.1 ? 1 : 0,
                  transform: `scale(${interpolate(growth, [0, 1], [0.5, 1])})`,
                  fontVariantNumeric: 'tabular-nums',
                  textShadow: '0 2px 8px rgba(0,0,0,0.9)'
                }}
              >
                {currentValue.toLocaleString()}
              </div>

              {/* Rising Column */}
              <div
                style={{
                  width: '100%',
                  height: `${heightPercent}%`,
                  backgroundColor: barColor,
                  borderRadius: '8px 8px 0 0',
                  boxShadow: bar.highlighted
                    ? `0 0 20px ${accent}90, 0 4px 12px rgba(0,0,0,0.5)`
                    : '0 4px 12px rgba(0,0,0,0.5)',
                  border: '1.5px solid rgba(255,255,255,0.2)',
                  borderBottom: 'none'
                }}
              />

              {/* Label underneath */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '-34px',
                  color: bar.highlighted ? '#ffffff' : '#9ca3af',
                  fontSize: '13px',
                  fontWeight: 800,
                  letterSpacing: '0.5px',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap'
                }}
              >
                {bar.label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
