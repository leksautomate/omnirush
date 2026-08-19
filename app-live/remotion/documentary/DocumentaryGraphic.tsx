import { AbsoluteFill } from 'remotion'

import type { DocumentaryGraphic as DocumentaryGraphicData } from '../documentary-schema'

import { BattleMap } from './BattleMap'
import { DateLocationCard } from './DateLocationCard'
import { DocumentaryBackground } from './DocumentaryBackground'
import { EquipmentSpec } from './EquipmentSpec'
import { EvidenceCard } from './EvidenceCard'
import { ForceComparison } from './ForceComparison'
import { MilitaryTimeline } from './MilitaryTimeline'
import { StatisticsPanel } from './StatisticsPanel'

function assertNever(value: never): never {
  throw new Error(`Unsupported documentary graphic: ${JSON.stringify(value)}`)
}

export function DocumentaryGraphic({
  graphic,
  durationInFrames
}: {
  graphic: DocumentaryGraphicData
  durationInFrames: number
}) {
  let content
  switch (graphic.type) {
    case 'date-location':
      content = <DateLocationCard graphic={graphic} />
      break
    case 'battle-map':
    case 'strategic-overlay':
      content = (
        <BattleMap graphic={graphic} durationInFrames={durationInFrames} />
      )
      break
    case 'military-timeline':
      content = <MilitaryTimeline graphic={graphic} />
      break
    case 'force-comparison':
      content = <ForceComparison graphic={graphic} />
      break
    case 'equipment-spec':
      content = <EquipmentSpec graphic={graphic} />
      break
    case 'evidence-card':
    case 'quote-card':
      content = <EvidenceCard graphic={graphic} />
      break
    case 'statistics':
      content = <StatisticsPanel graphic={graphic} />
      break
    default:
      return assertNever(graphic)
  }

  return (
    <AbsoluteFill>
      <DocumentaryBackground id={graphic.backgroundId} />
      {content}
    </AbsoluteFill>
  )
}
