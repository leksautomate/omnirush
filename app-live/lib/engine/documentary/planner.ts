import { normalizeDocumentaryBeatPacing } from '@/lib/engine/beat-pacing'
import { cutScriptIntoBeats } from '@/lib/engine/beats'

import { extractOpeningDate } from './parse-script'
import {
  type DocumentaryBackgroundId,
  type DocumentaryBeat,
  documentaryBeatSchema,
  type DocumentaryBeatType,
  type DocumentaryChapter,
  type DocumentaryProject,
  type GraphicInstruction
} from './schema'

export interface PlannerContext {
  narration: string
  project: DocumentaryProject
  chapter: DocumentaryChapter
  claimIds: string[]
  locationIds: string[]
  entityIds: string[]
  forceOpening: boolean
}

export interface DocumentaryPlannerOptions {
  format?: '16:9' | '9:16' | '1:1'
  fps?: number
  channel?: string
  voiceWords?: Array<{ word: string; start: number; end: number }>
  abortSignal?: AbortSignal
}

export function chooseBackgroundRole(
  type: GraphicInstruction['type']
): DocumentaryBackgroundId {
  switch (type) {
    case 'date-location':
    case 'quote-card':
      return 'bg1'
    case 'military-timeline':
    case 'evidence-card':
      return 'bg2'
    case 'battle-map':
    case 'force-comparison':
    case 'equipment-spec':
    case 'strategic-overlay':
    case 'statistics':
      return 'bg4'
  }
}

function claimsFor(context: PlannerContext) {
  const wanted = new Set(context.claimIds)
  return context.project.dossier.claims.filter(claim => wanted.has(claim.id))
}

function locationsFor(context: PlannerContext) {
  const wanted = new Set(context.locationIds)
  return context.project.dossier.locations.filter(location =>
    wanted.has(location.id)
  )
}

function entitiesFor(context: PlannerContext) {
  const wanted = new Set(context.entityIds)
  return [
    ...context.project.dossier.people,
    ...context.project.dossier.militaryUnits,
    ...context.project.dossier.equipment
  ].filter(entity => wanted.has(entity.id))
}

function firstCitation(context: PlannerContext) {
  const citationIds = new Set(
    claimsFor(context).flatMap(claim => claim.citationIds)
  )
  return context.project.dossier.citations.find(citation =>
    citationIds.has(citation.id)
  )
}

function planDateLocation(context: PlannerContext): GraphicInstruction {
  const location =
    locationsFor(context)[0] ?? context.project.dossier.locations[0]
  const opening = extractOpeningDate(context.narration)
  return {
    type: 'date-location',
    date:
      opening?.label ??
      context.chapter.dateRange ??
      context.project.chapters[0]?.dateRange ??
      'Date under review',
    location: location?.name ?? context.project.topic,
    theatre: location?.theatre,
    coordinates: location?.coordinates,
    backgroundId: 'bg1'
  }
}

function planMap(context: PlannerContext): GraphicInstruction {
  const locations = locationsFor(context)
  const units = context.project.dossier.militaryUnits
    .filter(unit => context.entityIds.includes(unit.id))
    .map(unit => ({
      id: unit.id,
      name: unit.name,
      allegiance: unit.allegiance ?? ('other' as const),
      unitType: unit.role ?? 'military unit',
      claimIds: unit.claimIds
    }))
  const points = locations.flatMap(location =>
    location.coordinates ? [location.coordinates] : []
  )
  const routes =
    points.length >= 2
      ? [
          {
            id: `route-${context.chapter.id}`,
            label: 'Documented movement',
            kind: 'movement' as const,
            points,
            claimIds: context.claimIds
          }
        ]
      : []

  return {
    type: 'battle-map',
    theatre:
      locations[0]?.theatre ??
      context.project.dossier.locations[0]?.theatre ??
      context.project.topic,
    dateLabel: context.chapter.dateRange,
    units,
    routes,
    frontLines: [],
    objectives: locations.map(location => ({
      id: `objective-${location.id}`,
      label: location.name,
      position: location.coordinates,
      claimIds: location.claimIds
    })),
    annotations: points.length < 2 ? ['Regional positions only'] : [],
    backgroundId: 'bg4'
  }
}

function planTimeline(context: PlannerContext): GraphicInstruction | undefined {
  const events = context.project.dossier.chronology.filter(event =>
    event.claimIds.some(claimId => context.claimIds.includes(claimId))
  )
  if (!events.length) return undefined
  return {
    type: 'military-timeline',
    events: events.map(event => ({
      id: event.id,
      date: event.date,
      title: event.title,
      description: event.description,
      importance: event.importance,
      claimIds: event.claimIds
    })),
    backgroundId: 'bg2'
  }
}

function planForceComparison(
  context: PlannerContext
): GraphicInstruction | undefined {
  const units = context.project.dossier.militaryUnits.filter(unit =>
    context.entityIds.includes(unit.id)
  )
  const sides = units.map(unit => ({
    name: unit.name,
    allegiance: unit.allegiance ?? ('other' as const),
    highlightedAdvantage: unit.role,
    claimIds: unit.claimIds
  }))
  if (sides.length < 2) return undefined
  return { type: 'force-comparison', sides, backgroundId: 'bg4' }
}

function planEquipment(
  context: PlannerContext
): GraphicInstruction | undefined {
  const lower = context.narration.toLowerCase()
  const equipment = context.project.dossier.equipment.find(
    item =>
      context.entityIds.includes(item.id) &&
      (lower.includes(item.name.toLowerCase()) ||
        Boolean(item.model && lower.includes(item.model.toLowerCase())))
  )
  if (!equipment?.specifications.length) return undefined
  return {
    type: 'equipment-spec',
    name: equipment.name,
    model: equipment.model,
    variant: equipment.variant,
    serviceYear: equipment.serviceYear,
    role: equipment.role,
    manufacturer: equipment.manufacturer,
    specifications: equipment.specifications,
    backgroundId: 'bg4'
  }
}

function planEvidence(context: PlannerContext): GraphicInstruction | undefined {
  const citation = firstCitation(context)
  if (!citation) return undefined
  return {
    type: 'evidence-card',
    documentTitle: citation.title,
    institution: citation.authorOrInstitution,
    date: citation.publicationDate,
    excerpt: citation.supportingNote,
    citationId: citation.id,
    sourceUrl: citation.url,
    backgroundId: 'bg2'
  }
}

function planQuote(context: PlannerContext): GraphicInstruction | undefined {
  const quotation = context.project.dossier.quotations.find(item =>
    context.narration.includes(item.quote)
  )
  if (!quotation) return undefined
  const citation = context.project.dossier.citations.find(
    item => item.id === quotation.citationId && item.url === quotation.sourceUrl
  )
  if (!citation) return undefined
  return {
    type: 'quote-card',
    quote: quotation.quote,
    speaker: quotation.speaker,
    role: quotation.role,
    institution: citation.authorOrInstitution,
    date: quotation.date,
    citationId: quotation.citationId,
    sourceUrl: quotation.sourceUrl,
    backgroundId: 'bg1'
  }
}

function planStatistics(
  context: PlannerContext
): GraphicInstruction | undefined {
  const values = Array.from(
    context.narration.matchAll(/\b\d[\d,]*(?:\.\d+)?\b/gu)
  )
    .map(match => Number(match[0].replaceAll(',', '')))
    .filter(Number.isFinite)
    .slice(0, 4)
  const claimId = context.claimIds[0]
  if (!values.length || !claimId) return undefined
  return {
    type: 'statistics',
    title: context.chapter.title,
    display: values.length > 1 ? 'bars' : 'counter',
    values: values.map((value, index) => ({
      label: `Documented value ${index + 1}`,
      value,
      claimId
    })),
    backgroundId: 'bg4'
  }
}

function planStrategicOverlay(context: PlannerContext): GraphicInstruction {
  const map = planMap(context)
  return {
    type: 'strategic-overlay',
    theatre: map.type === 'battle-map' ? map.theatre : context.project.topic,
    objectives: map.type === 'battle-map' ? map.objectives : [],
    routes: map.type === 'battle-map' ? map.routes : [],
    detectionRanges: [],
    defensiveZones: [],
    formations: [],
    backgroundId: 'bg4'
  }
}

export function chooseGraphicInstruction(
  context: PlannerContext
): GraphicInstruction | undefined {
  const lower = context.narration.toLowerCase()
  if (context.forceOpening) return planDateLocation(context)

  if (
    context.project.dossier.quotations.some(item =>
      context.narration.includes(item.quote)
    )
  ) {
    return planQuote(context)
  }
  if (/\b(repair|timeline|chronology|between\s+\w+\s+\d+)/iu.test(lower)) {
    return planTimeline(context)
  }
  if (
    /\b(faced|versus|vs\.?|outnumbered|compared with|against)\b/iu.test(lower)
  ) {
    return planForceComparison(context)
  }
  if (
    context.project.dossier.equipment.some(
      item =>
        lower.includes(item.name.toLowerCase()) ||
        Boolean(item.model && lower.includes(item.model.toLowerCase()))
    )
  ) {
    return planEquipment(context)
  }
  if (
    /\b(decrypt|message|report|order|diary|document|archive|evidence|intercept)\w*\b/iu.test(
      lower
    )
  ) {
    return planEvidence(context)
  }
  if (
    /\b(supply route|detection range|defensive perimeter|formation|threat zone)\b/iu.test(
      lower
    )
  ) {
    return planStrategicOverlay(context)
  }
  if (
    /\b(move|movement|advance|attack|retreat|route|toward|across|from\b.*\bto)\b/iu.test(
      lower
    )
  ) {
    return planMap(context)
  }
  if (/\b\d[\d,]*(?:\.\d+)?\b/u.test(lower)) return planStatistics(context)
  return undefined
}

function idsMentionedInNarration(
  narration: string,
  project: DocumentaryProject
) {
  const lower = narration.toLowerCase()
  const meaningfulWords = (value: string) =>
    value
      .toLowerCase()
      .split(/\W+/u)
      .filter(word => word.length >= 5)
  const claimIds = project.dossier.claims
    .filter(claim =>
      meaningfulWords(claim.text).some(word => lower.includes(word))
    )
    .map(claim => claim.id)
  const locationIds = project.dossier.locations
    .filter(location => lower.includes(location.name.toLowerCase()))
    .map(location => location.id)
  const entityIds = [
    ...project.dossier.people,
    ...project.dossier.militaryUnits,
    ...project.dossier.equipment
  ]
    .filter(
      entity =>
        lower.includes(entity.name.toLowerCase()) ||
        ('model' in entity &&
          Boolean(entity.model && lower.includes(entity.model.toLowerCase())))
    )
    .map(entity => entity.id)
  return { claimIds, locationIds, entityIds }
}

function beatTypeFor(
  graphic: GraphicInstruction | undefined,
  kind: 'photo' | 'video' | 'comparison' | 'avatar' | 'a-roll'
): DocumentaryBeatType {
  if (graphic && graphic.type !== 'date-location') return graphic.type
  return kind === 'video' ? 'archival-video' : 'archival-photo'
}

function findChapter(project: DocumentaryProject, narrationOffset: number) {
  return (
    project.chapters.find(
      chapter =>
        narrationOffset >= chapter.startNarrationOffset &&
        narrationOffset < chapter.endNarrationOffset
    ) ?? project.chapters.at(-1)!
  )
}

export async function planDocumentaryBeats(
  model: string,
  project: DocumentaryProject,
  options: DocumentaryPlannerOptions = {}
): Promise<DocumentaryBeat[]> {
  const storyboard = await cutScriptIntoBeats(
    model,
    {
      script: project.narration,
      topic: project.topic,
      format: options.format ?? '16:9',
      fps: options.fps,
      channel: options.channel,
      accent: '#B6924A',
      profile: project.profile,
      deferDocumentaryPacing: true,
      voiceWords: options.voiceWords
    },
    options.abortSignal
  )
  let narrationCursor = 0
  let previousQuery = ''

  const beats = storyboard.shots.map((shot, index) => {
    const foundOffset = project.narration.indexOf(
      shot.narration,
      narrationCursor
    )
    const narrationOffset = foundOffset >= 0 ? foundOffset : narrationCursor
    narrationCursor = narrationOffset + shot.narration.length
    const chapter = findChapter(project, narrationOffset)
    const mentioned = idsMentionedInNarration(shot.narration, project)
    const claimIds = mentioned.claimIds.length
      ? mentioned.claimIds
      : chapter.claimIds
    const locationIds = mentioned.locationIds.length
      ? mentioned.locationIds
      : chapter.locationIds
    const entityIds = mentioned.entityIds.length
      ? mentioned.entityIds
      : chapter.entityIds
    const context: PlannerContext = {
      narration: shot.narration,
      project,
      chapter,
      claimIds,
      locationIds,
      entityIds,
      forceOpening: index === 0
    }
    const graphic = chooseGraphicInstruction(context)
    const visualQuery =
      shot.visualQuery === previousQuery
        ? `${shot.visualQuery} ${chapter.title}`
        : shot.visualQuery
    previousQuery = visualQuery

    return documentaryBeatSchema.parse({
      id: `beat-${index + 1}`,
      chapterId: chapter.id,
      type: beatTypeFor(graphic, shot.kind),
      narration: shot.narration,
      start: shot.start,
      duration: shot.duration,
      words: shot.words,
      claimIds,
      dateLabel:
        graphic?.type === 'date-location' ? graphic.date : chapter.dateRange,
      locationIds,
      entityIds,
      visualQuery,
      visualIntent: shot.visualIntent,
      graphic
    })
  })

  return normalizeDocumentaryBeatPacing(beats)
}

export function documentaryBeatKind(
  type: DocumentaryBeatType
): 'photo' | 'video' | 'comparison' {
  if (type === 'archival-video' || type === 'reconstruction') return 'video'
  if (type === 'force-comparison') return 'comparison'
  return 'photo'
}
