import React from 'react'

import { AbsoluteFill } from 'remotion'

import {
  ComparisonCard,
  type ComparisonCardItem
} from './ComparisonCard'

interface ComparisonGridProps {
  cards: ComparisonCardItem[]
  accent?: string
}

export const ComparisonGrid: React.FC<ComparisonGridProps> = ({
  cards,
  accent = '#ff6b00'
}) => {
  if (!cards || cards.length === 0) return null

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0a0f',
        padding: '24px 32px 50px 32px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        justifyContent: 'center',
        gap: '18px',
        boxSizing: 'border-box'
      }}
    >
      {cards.map((item, idx) => (
        <ComparisonCard
          key={idx}
          item={item}
          index={idx}
          totalCards={cards.length}
          accent={accent}
        />
      ))}
    </AbsoluteFill>
  )
}
