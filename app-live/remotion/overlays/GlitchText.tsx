'use client'

import React from 'react'

import { useCurrentFrame } from 'remotion'

export const GlitchText: React.FC<{
  text: string
  fontSize?: number
}> = ({ text, fontSize = 48 }) => {
  const frame = useCurrentFrame()

  const glitchIntensity = Math.sin(frame / 6) * 6
  const rgbOffset = Math.sin(frame / 4) * 4

  return (
    <div
      style={{
        position: 'relative',
        fontSize: `${fontSize}px`,
        fontWeight: 900,
        fontFamily: 'monospace',
        letterSpacing: '2px',
        textTransform: 'uppercase'
      }}
    >
      <div
        style={{
          position: 'absolute',
          color: '#00ffff',
          transform: `translate(${rgbOffset}px, ${glitchIntensity}px)`,
          mixBlendMode: 'screen',
          opacity: 0.85
        }}
      >
        {text}
      </div>
      <div
        style={{
          position: 'absolute',
          color: '#ff00ff',
          transform: `translate(${-rgbOffset}px, ${-glitchIntensity}px)`,
          mixBlendMode: 'screen',
          opacity: 0.85
        }}
      >
        {text}
      </div>
      <div style={{ color: '#ffffff', position: 'relative' }}>{text}</div>
    </div>
  )
}
