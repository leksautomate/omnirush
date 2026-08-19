import React from 'react'

import {
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig
} from 'remotion'

export interface ComparisonCardItem {
  name: string
  role: string
  country: string
  countryCode?: string // e.g. 'de', 'fr', 'gb-eng', 'gb', 'us'
  lifespan: string // e.g. '1483–1546'
  portraitUrl: string
  cause: string // e.g. 'Illness'
  statNumber: number // e.g. 62
  statLabel?: string // e.g. 'AGE'
}

interface ComparisonCardProps {
  item: ComparisonCardItem
  index: number
  totalCards: number
  accent?: string
}

export const ComparisonCard: React.FC<ComparisonCardProps> = ({
  item,
  index,
  totalCards,
  accent = '#ff6b00'
}) => {
  const frame = useCurrentFrame()
  const { fps, height, width } = useVideoConfig()

  // Stagger entrance animation: each card pops in sequentially (0.15s apart)
  const staggerDelayFrames = index * Math.round(fps * 0.15)
  const cardRelativeFrame = Math.max(0, frame - staggerDelayFrames)

  const entrance = spring({
    frame: cardRelativeFrame,
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 100 }
  })

  // Number counter ticks up smoothly from 0 to statNumber
  const countProgress = interpolate(
    cardRelativeFrame,
    [Math.round(fps * 0.2), Math.round(fps * 0.9)],
    [0, item.statNumber],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )
  const currentCount = Math.round(countProgress)

  const scale = interpolate(entrance, [0, 1], [0.85, 1])
  const opacity = interpolate(entrance, [0, 1], [0, 1])
  const translateY = interpolate(entrance, [0, 1], [30, 0])

  // Flag file path fallback
  const flagSrc = item.countryCode
    ? `/flags/${item.countryCode.toLowerCase()}.svg`
    : '/flags/eu.svg'

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        border: '3px solid #000000',
        borderRadius: '6px',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        transform: `scale(${scale}) translateY(${translateY}px)`,
        opacity,
        fontFamily:
          '"DejaVu Sans", system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      }}
    >
      {/* 1. TOP PORTRAIT SECTION (with flag & lifespan badges) */}
      <div
        style={{
          position: 'relative',
          height: '46%',
          width: '100%',
          backgroundColor: '#111827',
          overflow: 'hidden'
        }}
      >
        {item.portraitUrl ? (
          <Img
            src={item.portraitUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#1f2937',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            Portrait
          </div>
        )}

        {/* Flag Badge (Bottom Left of Portrait) */}
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            backgroundColor: 'rgba(0,0,0,0.85)',
            border: '1.5px solid #ffffff',
            borderRadius: '4px',
            padding: '3px 6px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={flagSrc}
            alt={item.country}
            style={{
              width: '18px',
              height: '12px',
              objectFit: 'cover',
              borderRadius: '1px'
            }}
          />
          <span
            style={{
              color: '#ffffff',
              fontSize: '9px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            {item.country}
          </span>
        </div>

        {/* Lifespan Dates Pill (Bottom Right of Portrait) */}
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            backgroundColor: '#000000',
            border: '1.5px solid #ffffff',
            borderRadius: '4px',
            padding: '3px 8px',
            color: '#ffffff',
            fontFamily: 'monospace',
            fontWeight: 900,
            fontSize: '11px',
            letterSpacing: '0.5px'
          }}
        >
          {item.lifespan}
        </div>
      </div>

      {/* 2. NAME BANNER (Bold Gold/Yellow) */}
      <div
        style={{
          backgroundColor: '#ffb703',
          borderTop: '3px solid #000000',
          borderBottom: '3px solid #000000',
          padding: '8px 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center'
        }}
      >
        <span
          style={{
            color: '#000000',
            fontWeight: 900,
            fontSize: totalCards > 3 ? '16px' : '20px',
            letterSpacing: '-0.5px',
            lineHeight: 1.1,
            textTransform: 'capitalize'
          }}
        >
          {item.name}
        </span>
      </div>

      {/* 3. SUBTITLE / ROLE RIBBON (Deep Red) */}
      <div
        style={{
          backgroundColor: '#9e2a2b',
          borderBottom: '2px solid #000000',
          padding: '4px 6px',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '26px'
        }}
      >
        <span
          style={{
            color: '#ffffff',
            fontSize: '9.5px',
            fontWeight: 700,
            lineHeight: 1.2
          }}
        >
          {item.role}
        </span>
      </div>

      {/* 4. STATS & CAUSE OF DEATH SECTION */}
      <div
        style={{
          flex: 1,
          backgroundColor: '#f3f4f6',
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        {/* Cause of death description */}
        <span
          style={{
            color: '#374151',
            fontSize: '11px',
            fontWeight: 800,
            textAlign: 'center',
            textTransform: 'capitalize'
          }}
        >
          {item.cause}
        </span>

        {/* Big Animated Age / Stat Metric with Icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            width: '100%',
            paddingBottom: '4px'
          }}
        >
          {/* Sick/Event Icon Illustration */}
          <div
            style={{
              fontSize: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            🤧
          </div>

          {/* Number + Label */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span
              style={{
                color: '#111827',
                fontSize: totalCards > 3 ? '32px' : '40px',
                fontWeight: 900,
                lineHeight: 0.9,
                letterSpacing: '-1px'
              }}
            >
              {currentCount}
            </span>
            <span
              style={{
                color: '#4b5563',
                fontSize: '11px',
                fontWeight: 900,
                letterSpacing: '1px',
                textTransform: 'uppercase'
              }}
            >
              {item.statLabel || 'AGE'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
