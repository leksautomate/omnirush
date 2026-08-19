import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'

import type { DocumentaryGraphic } from '../documentary-schema'

type EquipmentGraphic = Extract<DocumentaryGraphic, { type: 'equipment-spec' }>

export function EquipmentSpec({ graphic }: { graphic: EquipmentGraphic }) {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ padding: '6% 7%', color: '#F2EBDD' }}>
      <div style={{ color: '#B6924A', letterSpacing: 5, fontSize: 22 }}>
        EQUIPMENT PROFILE
      </div>
      <div
        style={{
          fontFamily: 'Impact, sans-serif',
          fontSize: 64,
          letterSpacing: 3,
          marginTop: 14
        }}
      >
        {graphic.name}
      </div>
      <div style={{ fontSize: 25, color: '#C8BEAD', marginTop: 10 }}>
        {[graphic.model, graphic.variant, graphic.role, graphic.serviceYear]
          .filter(Boolean)
          .join(' • ')}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 22,
          marginTop: 54
        }}
      >
        {graphic.specifications.map((specification, index) => (
          <div
            key={`${specification.label}-${index}`}
            style={{
              padding: 26,
              backgroundColor: 'rgba(5,5,5,.72)',
              borderLeft: '5px solid #B6924A',
              opacity: interpolate(
                frame,
                [12 + index * 7, 24 + index * 7],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              )
            }}
          >
            <div style={{ fontSize: 20, color: '#BEB5A4' }}>
              {specification.label.toUpperCase()}
            </div>
            <div style={{ marginTop: 10, fontSize: 42, fontWeight: 800 }}>
              {specification.value}
              {specification.unit ? ` ${specification.unit}` : ''}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  )
}
