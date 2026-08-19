'use client'

import React from 'react'

import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'

export const CameraShake: React.FC<{
  children: React.ReactNode
  intensity?: number
  durationFrames?: number
}> = ({ children, intensity = 12, durationFrames = 25 }) => {
  const frame = useCurrentFrame()

  // Amplitude decays from intensity to 0
  const amplitude = interpolate(frame, [0, durationFrames], [intensity, 0], {
    extrapolateRight: 'clamp'
  })

  const shakeX = Math.sin(frame * 0.8) * amplitude
  const shakeY = Math.cos(frame * 1.1) * amplitude

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        transform: `translate(${shakeX}px, ${shakeY}px)`
      }}
    >
      {children}
    </div>
  )
}
