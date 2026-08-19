'use client'

import React from 'react'

import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'

export const FilmBurn: React.FC<{ durationFrames?: number }> = ({
  durationFrames = 45
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const progress = Math.min(frame / durationFrames, 1)

  // Peak light leak at mid-animation
  const intensity = interpolate(
    frame,
    [0, durationFrames * 0.4, durationFrames],
    [0, 0.85, 0],
    { extrapolateRight: 'clamp' }
  )

  const xShift1 = 50 + Math.sin(frame * 0.08) * 30
  const yShift1 = 50 + Math.cos(frame * 0.07) * 20
  const xShift2 = 50 + Math.sin(frame * 0.1 + 2) * 25
  const yShift2 = 50 + Math.cos(frame * 0.09 + 1) * 30

  if (intensity <= 0.01) return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 40,
        mixBlendMode: 'screen'
      }}
    >
      {/* Light leak glow 1 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at ${xShift1}% ${yShift1}%, rgba(249, 115, 22, ${intensity * 0.75}), transparent 60%)`
        }}
      />
      {/* Light leak glow 2 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at ${xShift2}% ${yShift2}%, rgba(251, 191, 36, ${intensity * 0.55}), transparent 50%)`
        }}
      />
    </div>
  )
}
