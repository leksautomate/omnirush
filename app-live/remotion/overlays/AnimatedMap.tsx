'use client'

import React from 'react'

import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig
} from 'remotion'

import { WORLD_REGIONS } from './world-geojson'

export interface MapLocationPin {
  label: string
  x: number // percentage (0 - 100)
  y: number // percentage (0 - 100)
  color?: string
}

export interface AnimatedMapProps {
  title?: string
  fromLabel?: string
  toLabel?: string
  fromCoords?: [number, number] // [x%, y%] e.g. [32, 42] (London)
  toCoords?: [number, number] // [x%, y%] e.g. [68, 58] (Normandy/Berlin)
  highlightedRegions?: string[] // e.g. ['europe-uk', 'europe-west']
  accent?: string
}

export const AnimatedMap: React.FC<AnimatedMapProps> = ({
  title = 'TACTICAL MAP & GEOLOCATION DISPATCH',
  fromLabel = 'COMMAND HQ (LONDON)',
  toLabel = 'TARGET OBJECTIVE (NORMANDY)',
  fromCoords = [28, 38],
  toCoords = [66, 56],
  highlightedRegions = ['europe-uk', 'europe-west'],
  accent = '#ff6b00'
}) => {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

  // Trajectory draw progress (0 to 1)
  const pathProgress = interpolate(frame, [15, 60], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })

  // Pin 1 entrance
  const pin1Entrance = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 12, mass: 0.5 }
  })

  // Pin 2 entrance
  const pin2Entrance = spring({
    frame: Math.max(0, frame - 45),
    fps,
    config: { damping: 12, mass: 0.5 }
  })

  // Radar ping pulses
  const pulse = (frame % 30) / 30
  const pulseScale = interpolate(pulse, [0, 1], [1, 2.8])
  const pulseOpacity = interpolate(pulse, [0, 1], [0.8, 0])

  // Convert percentage coordinates to SVG viewBox (1000 x 600)
  const x1 = (fromCoords[0] / 100) * 1000
  const y1 = (fromCoords[1] / 100) * 600
  const x2 = (toCoords[0] / 100) * 1000
  const y2 = (toCoords[1] / 100) * 600

  // Quadratic curve control point for curved flight/movement arc
  const cx = (x1 + x2) / 2
  const cy = Math.min(y1, y2) - 80

  const pathD = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
  const pathLength = 600
  const strokeOffset = pathLength * (1 - pathProgress)

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#0a0d14',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        zIndex: 35,
        fontFamily:
          '"DejaVu Sans", system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      }}
    >
      {/* Title Banner */}
      <div
        style={{
          position: 'absolute',
          top: '24px',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          border: `1.5px solid ${accent}`,
          borderRadius: '6px',
          padding: '6px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: `0 0 20px ${accent}40`,
          zIndex: 10
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#22c55e',
            boxShadow: '0 0 8px #22c55e'
          }}
        />
        <span
          style={{
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 900,
            letterSpacing: '2px',
            textTransform: 'uppercase'
          }}
        >
          {title}
        </span>
      </div>

      {/* SVG Map Canvas with Real Satellite/Terrain Map Background */}
      <div
        style={{
          position: 'relative',
          width: '92%',
          height: '82%',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1.5px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.85)'
        }}
      >
        {/* Real Map Imagery Layer (CartoDB Dark Matter / Satellite Basemap) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(https://basemaps.cartocdn.com/rastertiles/dark_all/4/8/5.png), url(https://basemaps.cartocdn.com/rastertiles/dark_all/4/8/6.png)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.75) contrast(1.2)'
          }}
        />

        {/* Map Overlay Vignette & Tactical Grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at center, transparent 35%, rgba(10,13,20,0.8) 100%)',
            pointerEvents: 'none'
          }}
        />

        <svg
          viewBox="0 0 1000 600"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%'
          }}
        >
          {/* Tactical Grid Pattern */}
          <defs>
            <pattern
              id="mapGrid"
              width="50"
              height="50"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 50 0 L 0 0 0 50"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="1000" height="600" fill="url(#mapGrid)" />

          {/* Real Natural Earth Geographical Country Boundaries */}
          <g>
            {WORLD_REGIONS.map(region => {
              const isHighlighted = highlightedRegions?.includes(region.id)
              return (
                <path
                  key={region.id}
                  d={region.d}
                  fill={
                    isHighlighted
                      ? `${accent}35`
                      : 'rgba(51, 65, 85, 0.45)'
                  }
                  stroke={
                    isHighlighted
                      ? accent
                      : 'rgba(148, 163, 184, 0.5)'
                  }
                  strokeWidth={isHighlighted ? '2' : '1.2'}
                  style={{
                    filter: isHighlighted
                      ? `drop-shadow(0 0 8px ${accent}80)`
                      : 'none',
                    transition: 'all 0.3s ease'
                  }}
                />
              )
            })}
          </g>

        {/* Animated Dashed Trajectory Arc */}
        <path
          d={pathD}
          fill="none"
          stroke={accent}
          strokeWidth="4"
          strokeDasharray={`${pathLength} ${pathLength}`}
          strokeDashoffset={strokeOffset}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 12px ${accent})` }}
        />

        {/* PIN 1: ORIGIN */}
        <g
          transform={`translate(${x1}, ${y1}) scale(${pin1Entrance})`}
          style={{ transformOrigin: `${x1}px ${y1}px` }}
        >
          {/* Radar Ping Pulse */}
          <circle
            r="16"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            transform={`scale(${pulseScale})`}
            opacity={pulseOpacity}
          />
          <circle r="7" fill="#3b82f6" stroke="#ffffff" strokeWidth="2" />

          {/* Label Card */}
          <g transform="translate(14, -28)">
            <rect
              width="180"
              height="26"
              rx="4"
              fill="rgba(0,0,0,0.9)"
              stroke="#3b82f6"
              strokeWidth="1.5"
            />
            <text
              x="8"
              y="17"
              fill="#ffffff"
              fontSize="11"
              fontWeight="bold"
              fontFamily="Arial, sans-serif"
              letterSpacing="0.5"
            >
              {fromLabel}
            </text>
          </g>
        </g>

        {/* PIN 2: DESTINATION */}
        <g
          transform={`translate(${x2}, ${y2}) scale(${pin2Entrance})`}
          style={{ transformOrigin: `${x2}px ${y2}px` }}
        >
          {/* Radar Ping Pulse */}
          <circle
            r="18"
            fill="none"
            stroke={accent}
            strokeWidth="2"
            transform={`scale(${pulseScale})`}
            opacity={pulseOpacity}
          />
          <circle r="8" fill={accent} stroke="#ffffff" strokeWidth="2" />

          {/* Label Card */}
          <g transform="translate(14, 8)">
            <rect
              width="210"
              height="26"
              rx="4"
              fill="rgba(0,0,0,0.9)"
              stroke={accent}
              strokeWidth="1.5"
            />
            <text
              x="8"
              y="17"
              fill="#ffffff"
              fontSize="11"
              fontWeight="bold"
              fontFamily="Arial, sans-serif"
              letterSpacing="0.5"
            >
              {toLabel}
            </text>
          </g>
        </g>
      </svg>
      </div>
    </div>
  )
}
