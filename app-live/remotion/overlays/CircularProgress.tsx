'use client'

import React from 'react'

import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'

interface CircularProgressProps {
  targetPercentage?: number
  accent?: string
  label?: string
  durationFrames?: number
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  targetPercentage = 85,
  accent = '#3b82f6',
  label,
  durationFrames = 60
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const progress = interpolate(frame, [0, durationFrames], [0, targetPercentage], {
    extrapolateRight: 'clamp'
  })

  const radius = 70
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference
  const pulse = 1 + Math.sin(frame / 12) * 0.04

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${pulse})`,
        fontFamily:
          '"DejaVu Sans", system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      }}
    >
      <div style={{ position: 'relative', width: '180px', height: '180px' }}>
        {/* Background track circle */}
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 200 200"
          style={{ position: 'absolute', transform: 'rotate(-90deg)' }}
        >
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth="14"
          />
        </svg>

        {/* Animated Progress circle */}
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 200 200"
          style={{ position: 'absolute', transform: 'rotate(-90deg)' }}
        >
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={accent}
            strokeWidth="14"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 8px ${accent}80)` }}
          />
        </svg>

        {/* Center Percentage Text */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '38px',
            fontWeight: 900,
            color: '#ffffff',
            textShadow: '0 2px 10px rgba(0,0,0,0.8)'
          }}
        >
          {Math.round(progress)}%
        </div>
      </div>

      {label && (
        <span
          style={{
            marginTop: '8px',
            color: '#e5e7eb',
            fontSize: '14px',
            fontWeight: 800,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            textShadow: '0 2px 8px rgba(0,0,0,0.7)'
          }}
        >
          {label}
        </span>
      )}
    </div>
  )
}
