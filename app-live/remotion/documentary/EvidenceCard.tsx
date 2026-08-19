import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'

import type { DocumentaryGraphic } from '../documentary-schema'

type EvidenceGraphic = Extract<
  DocumentaryGraphic,
  { type: 'evidence-card' | 'quote-card' }
>

export function EvidenceCard({ graphic }: { graphic: EvidenceGraphic }) {
  const frame = useCurrentFrame()
  const isQuote = graphic.type === 'quote-card'
  return (
    <AbsoluteFill
      style={{ alignItems: 'center', justifyContent: 'center', padding: '6%' }}
    >
      <div
        style={{
          width: '76%',
          padding: '5% 6%',
          color: '#171717',
          backgroundColor: 'rgba(239,228,203,.94)',
          boxShadow: '0 24px 80px rgba(0,0,0,.45)',
          border: '1px solid rgba(90,67,35,.35)',
          rotate: interpolate(frame, [0, 18], ['-1.5deg', '0deg'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp'
          }),
          opacity: interpolate(frame, [0, 14], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp'
          })
        }}
      >
        <div style={{ color: '#715A2E', fontSize: 20, letterSpacing: 4 }}>
          {isQuote ? 'ON THE RECORD' : graphic.institution.toUpperCase()}
        </div>
        <div
          style={{
            marginTop: 22,
            fontFamily: 'Georgia, serif',
            fontSize: isQuote ? 49 : 43,
            lineHeight: 1.25
          }}
        >
          {isQuote ? `“${graphic.quote}”` : graphic.documentTitle}
        </div>
        {!isQuote ? (
          <div
            style={{
              marginTop: 28,
              paddingLeft: 24,
              borderLeft: '5px solid #B6924A',
              fontFamily: 'Georgia, serif',
              fontSize: 29,
              lineHeight: 1.45
            }}
          >
            {graphic.excerpt}
          </div>
        ) : null}
        <div style={{ marginTop: 28, fontSize: 20, fontWeight: 700 }}>
          {isQuote
            ? [graphic.speaker, graphic.role, graphic.institution, graphic.date]
                .filter(Boolean)
                .join(' — ')
            : [graphic.institution, graphic.date].filter(Boolean).join(' — ')}
        </div>
      </div>
    </AbsoluteFill>
  )
}
