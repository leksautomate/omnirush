'use client'

import React from 'react'

import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig
} from 'remotion'

export interface NewspaperHeadlineProps {
  publication?: string
  issueDate?: string
  category?: string
  headline?: string
  highlightWords?: string[]
  summary?: string
  byline?: string
}

export const NewspaperHeadline: React.FC<NewspaperHeadlineProps> = ({
  publication = 'THE MORNING CHRONICLE',
  issueDate = 'Tuesday · Special War Dispatch',
  category = 'HISTORICAL BREAKTHROUGH',
  headline = 'WAR DECLARED: ALLIES CONFRONT HISTORIC TURNING POINT IN EUROPE',
  highlightWords = ['HISTORIC', 'TURNING', 'POINT'],
  summary = 'Commanders confirmed the major offensive has commenced across key fronts as leaders address the nation.',
  byline = 'By Field Correspondent · Official Record'
}) => {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

  // 3D camera float rotation
  const rotateX = interpolate(frame, [0, 150], [6, -6], {
    easing: Easing.inOut(Easing.quad),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })
  const rotateY = interpolate(frame, [0, 150], [-6, 6], {
    easing: Easing.inOut(Easing.quad),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })
  const scale = interpolate(frame, [0, 150], [0.95, 1.02], {
    easing: Easing.inOut(Easing.quad),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })

  // Blur in at start
  const blur = interpolate(frame, [0, 20], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })

  // Highlighter progress (starts at frame 25)
  const highlightProgress = interpolate(frame, [25, 55], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })

  const words = headline.split(' ')

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        perspective: 1800,
        overflow: 'hidden',
        zIndex: 35
      }}
    >
      <div
        style={{
          width: '88%',
          maxWidth: '920px',
          backgroundColor: '#fbfbf9',
          border: '2px solid #222222',
          borderRadius: '4px',
          boxShadow: '0 30px 90px rgba(0, 0, 0, 0.9), 0 0 20px rgba(0,0,0,0.5)',
          padding: '28px 36px',
          transform: `scale(${scale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
          transformStyle: 'preserve-3d',
          filter: `blur(${blur}px)`,
          opacity,
          fontFamily:
            '"Georgia", "Times New Roman", -apple-system, serif',
          boxSizing: 'border-box'
        }}
      >
        {/* Header line with publication & date */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '3px double #181816',
            paddingBottom: '10px',
            fontFamily: 'Arial, sans-serif'
          }}
        >
          <span
            style={{
              fontSize: '15px',
              fontWeight: 900,
              letterSpacing: '3px',
              color: '#111827',
              textTransform: 'uppercase'
            }}
          >
            {publication}
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              color: '#6b7280',
              textTransform: 'uppercase'
            }}
          >
            {issueDate}
          </span>
        </div>

        {/* Category banner */}
        <div
          style={{
            marginTop: '16px',
            color: '#b91c1c',
            fontFamily: 'Arial, sans-serif',
            fontSize: '12px',
            fontWeight: 900,
            letterSpacing: '2px',
            textTransform: 'uppercase'
          }}
        >
          {category}
        </div>

        {/* Big Serif Headline with Animated Marker Highlight */}
        <h1
          style={{
            margin: '10px 0 14px 0',
            fontSize: width < 800 ? '24px' : '36px',
            fontWeight: 900,
            lineHeight: 1.15,
            letterSpacing: '-1px',
            color: '#111827'
          }}
        >
          {words.map((w, idx) => {
            const cleanWord = w.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
            const isHighlighted = highlightWords.some(
              hw => hw.toUpperCase() === cleanWord
            )

            if (isHighlighted) {
              return (
                <span
                  key={idx}
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    marginRight: '6px',
                    zIndex: 2
                  }}
                >
                  <span style={{ position: 'relative', zIndex: 3 }}>{w}</span>
                  {/* Highlighter ink layer */}
                  <span
                    style={{
                      position: 'absolute',
                      left: '-3px',
                      right: '-3px',
                      bottom: '2px',
                      height: '75%',
                      backgroundColor: 'rgba(254, 240, 138, 0.95)',
                      transformOrigin: 'left center',
                      transform: `scaleX(${highlightProgress})`,
                      zIndex: 1,
                      borderRadius: '2px',
                      boxShadow: '0 0 10px rgba(250, 204, 21, 0.7)'
                    }}
                  />
                </span>
              )
            }

            return (
              <span key={idx} style={{ marginRight: '6px' }}>
                {w}
              </span>
            )
          })}
        </h1>

        {/* Summary text */}
        <p
          style={{
            margin: '0 0 16px 0',
            fontSize: '15px',
            lineHeight: 1.45,
            color: '#374151',
            maxWidth: '800px'
          }}
        >
          {summary}
        </p>

        {/* Footer byline */}
        <div
          style={{
            borderTop: '1px solid #d1d5db',
            paddingTop: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'Arial, sans-serif',
            fontSize: '11px',
            fontWeight: 700,
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}
        >
          <span>{byline}</span>
          <span>Archival Record</span>
        </div>
      </div>
    </div>
  )
}
