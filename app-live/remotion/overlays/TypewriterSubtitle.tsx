'use client'

import React from 'react'

import { interpolate, useCurrentFrame } from 'remotion'

export const TypewriterSubtitle: React.FC<{
  text: string
  durationFrames?: number
}> = ({ text, durationFrames = 45 }) => {
  const frame = useCurrentFrame()

  const visibleCharacters = Math.floor(
    interpolate(frame, [0, durationFrames], [0, text.length], {
      extrapolateRight: 'clamp'
    })
  )

  const isCursorVisible = frame % 16 < 8

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        padding: '8px 16px',
        borderRadius: '8px',
        fontFamily: "'Courier New', monospace",
        fontSize: '24px',
        fontWeight: 700,
        color: '#ffffff',
        textShadow: '0 2px 8px rgba(0,0,0,0.8)'
      }}
    >
      <span>{text.slice(0, visibleCharacters)}</span>
      <span
        style={{
          color: '#60a5fa',
          opacity: isCursorVisible ? 1 : 0,
          marginLeft: '4px'
        }}
      >
        ▌
      </span>
    </div>
  )
}
