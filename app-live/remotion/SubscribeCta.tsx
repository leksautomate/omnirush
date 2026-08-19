import React from 'react'

import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig
} from 'remotion'

interface SubscribeCtaProps {
  channelName?: string
  accent?: string
  totalSeconds: number
}

export const SubscribeCta: React.FC<SubscribeCtaProps> = ({
  channelName = 'Kakkao Live',
  accent = '#ff2d55',
  totalSeconds
}) => {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  const currentTime = frame / fps

  // Show CTA during the last 4.5 seconds of the video
  const ctaStartSec = Math.max(0, totalSeconds - 4.5)
  if (currentTime < ctaStartSec) return null

  const ctaStartFrame = Math.round(ctaStartSec * fps)
  const relativeFrame = frame - ctaStartFrame

  const entrance = spring({
    frame: relativeFrame,
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 120 }
  })

  // Bell ringing wiggle animation around 1.2s into the CTA
  const bellFrame = relativeFrame - Math.round(fps * 1.0)
  const bellRotate =
    bellFrame > 0 && bellFrame < fps * 1.5
      ? Math.sin(bellFrame * 0.7) * 16
      : 0

  const scale = interpolate(entrance, [0, 1], [0.75, 1])
  const opacity = interpolate(entrance, [0, 1], [0, 1])
  const translateY = interpolate(entrance, [0, 1], [40, 0])

  return (
    <div
      style={{
        position: 'absolute',
        bottom: Math.round(height * 0.12),
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 50,
        pointerEvents: 'none'
      }}
    >
      <div
        style={{
          transform: `scale(${scale}) translateY(${translateY}px)`,
          opacity,
          backgroundColor: 'rgba(15, 15, 20, 0.92)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: Math.round(height * 0.04),
          padding: `${Math.round(height * 0.015)}px ${Math.round(height * 0.035)}px`,
          display: 'flex',
          alignItems: 'center',
          gap: Math.round(height * 0.02),
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(12px)',
          fontFamily:
            '"DejaVu Sans", system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
        }}
      >
        {/* Channel Icon / Badge */}
        <div
          style={{
            width: Math.round(height * 0.05),
            height: Math.round(height * 0.05),
            borderRadius: '50%',
            backgroundColor: accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: Math.round(height * 0.024),
            color: '#fff',
            boxShadow: `0 0 12px ${accent}80`
          }}
        >
          {channelName[0] || 'K'}
        </div>

        {/* Channel Name */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: Math.round(height * 0.024),
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.1
            }}
          >
            {channelName}
          </span>
          <span
            style={{
              fontSize: Math.round(height * 0.016),
              color: '#a1a1aa',
              fontWeight: 500
            }}
          >
            Subscribe for more
          </span>
        </div>

        {/* Red Subscribe Button */}
        <div
          style={{
            backgroundColor: '#ff0000',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: Math.round(height * 0.02),
            padding: `${Math.round(height * 0.01)}px ${Math.round(height * 0.022)}px`,
            borderRadius: Math.round(height * 0.025),
            display: 'flex',
            alignItems: 'center',
            gap: Math.round(height * 0.01),
            boxShadow: '0 4px 14px rgba(255, 0, 0, 0.4)'
          }}
        >
          <span>SUBSCRIBE</span>
          {/* Bell Icon */}
          <svg
            style={{
              width: Math.round(height * 0.022),
              height: Math.round(height * 0.022),
              transform: `rotate(${bellRotate}deg)`,
              transformOrigin: 'top center'
            }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </div>
      </div>
    </div>
  )
}
