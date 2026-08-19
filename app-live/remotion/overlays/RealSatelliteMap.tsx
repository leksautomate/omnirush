'use client'

import React from 'react'

import {
  Easing,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig
} from 'remotion'

export interface RealSatelliteMapProps {
  title?: string
  fromCity?: string
  /** Omit for a single-location zoom-in (biography/true-crime "this is the place" beats)
   *  instead of a two-point flight path. */
  toCity?: string
  fromCoordsText?: string
  toCoordsText?: string
  satelliteImageUrl?: string
  accent?: string
}

export const RealSatelliteMap: React.FC<RealSatelliteMapProps> = ({
  title,
  fromCity = 'LONDON (SUPREME HQ)',
  toCity,
  fromCoordsText = '51.5074° N, 0.1278° W',
  toCoordsText = '49.3361° N, 0.8844° W',
  // Generic aerial/coastline stock photo (Unsplash) used as a background plate —
  // not real satellite imagery. Used when no per-location satelliteImageUrl was resolved
  // (e.g. MapTiler isn't configured, or geocoding the place name failed).
  satelliteImageUrl = 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=1920&q=90',
  accent = '#ff6b00'
}) => {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

  // No destination given → a single-location zoom-in/fly-by (biography, true-crime "this
  // is the place" beats) instead of a two-point flight path between an origin and target.
  const isSingleLocation = !toCity
  const resolvedTitle =
    title ??
    (isSingleLocation
      ? 'SATELLITE RECONNAISSANCE — LOCATION LOCK'
      : 'TACTICAL SATELLITE RECONNAISSANCE & FLIGHT PATH')

  // Real Pin Coordinates on the 1000x600 canvas. Flight mode uses London->Normandy-style
  // origin/target points; single-location mode centers one pin so the zoom converges on it.
  const x1 = isSingleLocation ? 500 : 340
  const y1 = isSingleLocation ? 300 : 200
  const x2 = 640
  const y2 = 420

  // 1. Cinematic Camera: a two-point pan+zoom "flight" for the dual-pin mode, or a
  // straight dramatic push-in centered on the single pin for the zoom-in mode.
  const cameraZoom = interpolate(
    frame,
    [0, 180],
    isSingleLocation ? [1.0, 1.75] : [1.0, 1.45],
    {
      easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp'
    }
  )

  const cameraPanX = interpolate(frame, [0, 180], [0, isSingleLocation ? 0 : -60], {
    easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })

  const cameraPanY = interpolate(frame, [0, 180], [0, isSingleLocation ? 0 : -35], {
    easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })

  // 2. Trajectory Flight Path Drawing (Frame 20 to 80) — flight mode only.
  const pathProgress = interpolate(frame, [20, 85], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })

  // 3. Pin Entrances
  const pin1Entrance = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 14, mass: 0.6 }
  })

  const pin2Entrance = spring({
    frame: Math.max(0, frame - 65),
    fps,
    config: { damping: 14, mass: 0.6 }
  })

  // 4. Radar Ping Sonar Waves
  const pulse1 = (frame % 36) / 36
  const pulseScale1 = interpolate(pulse1, [0, 1], [1, 3.2])
  const pulseOpacity1 = interpolate(pulse1, [0, 1], [0.9, 0])

  const pulse2 = ((frame + 18) % 36) / 36
  const pulseScale2 = interpolate(pulse2, [0, 1], [1, 3.5])
  const pulseOpacity2 = interpolate(pulse2, [0, 1], [0.95, 0])

  // 5. Altitude & Distance HUD Tickers
  const altitude = Math.round(
    interpolate(frame, [0, 180], [28500, 4200], {
      easing: Easing.out(Easing.exp),
      extrapolateRight: 'clamp'
    })
  )

  const cx = 520
  const cy = 240
  const pathD = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
  const pathLength = 550
  const strokeOffset = pathLength * (1 - pathProgress)

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#05070a',
        overflow: 'hidden',
        zIndex: 35,
        fontFamily:
          '"DejaVu Sans", system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      }}
    >
      {/* 1. REAL HIGH-RES SATELLITE BASEMAP WITH CINEMATIC KEN BURNS CAMERA FLIGHT */}
      <div
        style={{
          position: 'absolute',
          inset: -40,
          transform: `scale(${cameraZoom}) translate(${cameraPanX}px, ${cameraPanY}px)`,
          transformOrigin: '55% 55%',
          willChange: 'transform'
        }}
      >
        <Img
          src={satelliteImageUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'contrast(1.25) saturate(1.15) brightness(0.85)'
          }}
        />

        {/* Real Topographic Hillshading & Satellite Vignette */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at center, rgba(14, 165, 233, 0.08) 0%, rgba(5, 7, 10, 0.7) 100%)',
            pointerEvents: 'none'
          }}
        />
      </div>

      {/* 2. MILITARY HUD TOP BAR */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '24px',
          right: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 40
        }}
      >
        {/* Left: Mission Title Badge */}
        <div
          style={{
            backgroundColor: 'rgba(5, 7, 12, 0.88)',
            border: `1.5px solid ${accent}`,
            borderRadius: '6px',
            padding: '8px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: `0 0 24px ${accent}50, 0 8px 24px rgba(0,0,0,0.8)`
          }}
        >
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              boxShadow: '0 0 10px #22c55e'
            }}
          />
          <div>
            <div
              style={{
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 900,
                letterSpacing: '2px',
                textTransform: 'uppercase'
              }}
            >
              {resolvedTitle}
            </div>
            <div
              style={{
                color: '#94a3b8',
                fontSize: '9.5px',
                fontWeight: 700,
                letterSpacing: '1px',
                fontFamily: 'monospace'
              }}
            >
              LIVE OPTICAL SATELLITE RECONNAISSANCE · ZOOM {cameraZoom.toFixed(2)}x
            </div>
          </div>
        </div>

        {/* Right: Real-time Telemetry & Altitude */}
        <div
          style={{
            backgroundColor: 'rgba(5, 7, 12, 0.88)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '6px',
            padding: '6px 16px',
            textAlign: 'right',
            fontFamily: 'monospace'
          }}
        >
          <div
            style={{
              color: '#38bdf8',
              fontSize: '14px',
              fontWeight: 900,
              letterSpacing: '1px'
            }}
          >
            ALT: {altitude.toLocaleString()} FT
          </div>
          <div
            style={{
              color: '#94a3b8',
              fontSize: '9px',
              fontWeight: 700
            }}
          >
            GRID {fromCoordsText} · HD OPTICAL
          </div>
        </div>
      </div>

      {/* 3. TACTICAL RADAR HUD & VECTOR TRAJECTORY OVERLAY */}
      <svg
        viewBox="0 0 1000 600"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 38
        }}
      >
        {/* Tactical Crosshairs & Compass Lines */}
        <defs>
          <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor={accent} />
          </linearGradient>
        </defs>

        {/* Animated Dashed Flight Trajectory Arc — flight mode only */}
        {!isSingleLocation && (
          <path
            d={pathD}
            fill="none"
            stroke="url(#pathGradient)"
            strokeWidth="4.5"
            strokeDasharray={`${pathLength} ${pathLength}`}
            strokeDashoffset={strokeOffset}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 16px ${accent}) drop-shadow(0 0 6px #ffffff)`
            }}
          />
        )}

        {/* PIN 1: ORIGIN (flight mode) or the sole locked target (single-location mode) */}
        <g
          transform={`translate(${x1}, ${y1}) scale(${pin1Entrance})`}
          style={{ transformOrigin: `${x1}px ${y1}px` }}
        >
          {/* Pulsing Sonar Ping Rings */}
          <circle
            r={isSingleLocation ? 24 : 20}
            fill="none"
            stroke={isSingleLocation ? accent : '#38bdf8'}
            strokeWidth={isSingleLocation ? 2.5 : 2}
            transform={`scale(${pulseScale1})`}
            opacity={pulseOpacity1}
          />
          <circle
            r={isSingleLocation ? 10 : 8}
            fill={isSingleLocation ? accent : '#38bdf8'}
            stroke="#ffffff"
            strokeWidth={isSingleLocation ? 3 : 2.5}
          />

          {/* Tactical Glassmorphism Label Card */}
          <g transform="translate(18, -34)">
            <rect
              width="210"
              height="38"
              rx="6"
              fill="rgba(5, 7, 12, 0.92)"
              stroke={isSingleLocation ? accent : '#38bdf8'}
              strokeWidth="1.5"
            />
            <text
              x="10"
              y="16"
              fill="#ffffff"
              fontSize="11"
              fontWeight="900"
              fontFamily="system-ui, sans-serif"
              letterSpacing="0.5"
            >
              {isSingleLocation ? '📍 ' : ''}
              {fromCity}
            </text>
            <text
              x="10"
              y="30"
              fill="#94a3b8"
              fontSize="9"
              fontWeight="700"
              fontFamily="monospace"
            >
              LOC: {fromCoordsText}
            </text>
          </g>
        </g>

        {/* PIN 2: TARGET — flight mode only */}
        {!isSingleLocation && (
        <g
          transform={`translate(${x2}, ${y2}) scale(${pin2Entrance})`}
          style={{ transformOrigin: `${x2}px ${y2}px` }}
        >
          {/* Pulsing Sonar Ping Rings (Accent Color) */}
          <circle
            r="24"
            fill="none"
            stroke={accent}
            strokeWidth="2.5"
            transform={`scale(${pulseScale2})`}
            opacity={pulseOpacity2}
          />
          <circle r="10" fill={accent} stroke="#ffffff" strokeWidth="3" />

          {/* Tactical Glassmorphism Target Card */}
          <g transform="translate(20, 4)">
            <rect
              width="250"
              height="40"
              rx="6"
              fill="rgba(5, 7, 12, 0.94)"
              stroke={accent}
              strokeWidth="2"
              style={{ filter: `drop-shadow(0 0 12px ${accent}60)` }}
            />
            <text
              x="12"
              y="17"
              fill="#ffffff"
              fontSize="11.5"
              fontWeight="900"
              fontFamily="system-ui, sans-serif"
              letterSpacing="0.5"
            >
              🎯 {toCity}
            </text>
            <text
              x="12"
              y="32"
              fill="#fdba74"
              fontSize="9"
              fontWeight="700"
              fontFamily="monospace"
            >
              TARGET LOC: {toCoordsText}
            </text>
          </g>
        </g>
        )}
      </svg>

      {/* 4. TACTICAL GRID CORNERS & COMPASS HUD */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '24px',
          right: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 40,
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#64748b'
        }}
      >
        <span>
          {isSingleLocation
            ? `COORD: ${fromCoordsText} · SCALE 1:50,000`
            : 'LAT RANGE 48.2°N - 52.8°N · SCALE 1:250,000'}
        </span>
        <span style={{ color: accent, fontWeight: 700 }}>
          {isSingleLocation ? 'TARGET STATUS: LOCKED' : 'TRAJECTORY STATUS: ACTIVE INTERCEPT'}
        </span>
      </div>
    </div>
  )
}
