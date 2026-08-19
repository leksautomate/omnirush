import { z } from 'zod'

export const contentProfileSchema = z.object({
  niche: z.literal('ww1_ww2'),
  format: z.literal('documentary'),
  presetVersion: z.literal(1)
})

export const documentaryBriefSchema = z.object({
  whatTheVideoIsAbout: z.string(),
  styleOfTalking: z.string(),
  whoThisVideoIsFor: z.string(),
  keyFacts: z.array(z.string()),
  inferredFields: z.array(
    z.enum([
      'whatTheVideoIsAbout',
      'styleOfTalking',
      'whoThisVideoIsFor',
      'keyFacts'
    ])
  )
})

export const rotationLogSchema = z.object({
  raw: z.string(),
  entries: z.array(
    z.object({
      label: z.string(),
      value: z.string()
    })
  )
})

export const sourceClassSchema = z.enum([
  'primary',
  'institutional',
  'secondary',
  'discovery-only'
])

export const reliabilitySchema = z.enum(['high', 'medium', 'low'])

export const documentarySourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url(),
  authorOrInstitution: z.string().min(1),
  publicationDate: z.string().optional(),
  accessedAt: z.string().datetime(),
  sourceClass: sourceClassSchema,
  supportingNote: z.string().min(1),
  reliability: reliabilitySchema
})

export const citationRecordSchema = documentarySourceSchema

export const claimRecordSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  importance: z.enum(['critical', 'supporting']),
  verification: z.enum(['verified', 'unverified', 'disputed', 'contradicted']),
  citationIds: z.array(z.string().min(1)),
  suggestedCorrection: z.string().optional()
})

export const chronologyEventSchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  importance: z.enum(['critical', 'supporting']),
  claimIds: z.array(z.string().min(1)),
  locationIds: z.array(z.string().min(1)).default([])
})

export const historicalEntitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['person', 'military-unit']),
  allegiance: z.enum(['allied', 'axis', 'neutral', 'other']).optional(),
  role: z.string().optional(),
  activeDateRange: z.string().optional(),
  claimIds: z.array(z.string().min(1)).default([])
})

export const equipmentSpecificationSchema = z.object({
  label: z.string().min(1),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  claimId: z.string().min(1)
})

export const equipmentEntitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  model: z.string().optional(),
  variant: z.string().optional(),
  serviceYear: z.number().int().min(1900).max(1950).optional(),
  role: z.string().min(1),
  manufacturer: z.string().optional(),
  specifications: z.array(equipmentSpecificationSchema).default([]),
  claimIds: z.array(z.string().min(1)).default([])
})

export const historicalLocationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  theatre: z.string().optional(),
  coordinates: z
    .union([z.tuple([z.number(), z.number()]), z.array(z.number())])
    .optional()
    .transform(val => (val && val.length === 2 ? (val as [number, number]) : undefined)),
  claimIds: z.array(z.string().min(1)).default([])
})

export const quotationRecordSchema = z.object({
  id: z.string().min(1),
  quote: z.string().min(1),
  speaker: z.string().min(1),
  role: z.string().optional(),
  date: z.string().optional(),
  citationId: z.string().min(1),
  sourceUrl: z.string().url()
})

export const researchDossierSchema = z.object({
  thesis: z.string().min(1),
  chronology: z.array(chronologyEventSchema),
  claims: z.array(claimRecordSchema),
  citations: z.array(citationRecordSchema),
  people: z.array(historicalEntitySchema),
  militaryUnits: z.array(historicalEntitySchema),
  equipment: z.array(equipmentEntitySchema),
  locations: z.array(historicalLocationSchema),
  quotations: z.array(quotationRecordSchema)
})

export const documentaryActSchema = z.enum([
  'cold-open',
  'strategic-context',
  'build-up',
  'conflict',
  'turning-point',
  'aftermath',
  'epilogue'
])

export const documentaryChapterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  act: documentaryActSchema,
  startNarrationOffset: z.number().int().min(0),
  endNarrationOffset: z.number().int().min(0),
  dateRange: z.string().optional(),
  locationIds: z.array(z.string().min(1)),
  claimIds: z.array(z.string().min(1)),
  entityIds: z.array(z.string().min(1)),
  emotionalObjective: z.string().min(1),
  retentionHook: z.string().min(1)
})

export const documentaryBackgroundIdSchema = z.enum([
  'bg1',
  'bg2',
  'bg3',
  'bg4'
])

export const mapUnitSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  allegiance: z.enum(['allied', 'axis', 'neutral', 'other']),
  unitType: z.string().min(1),
  strengthLabel: z.string().optional(),
  position: z.tuple([z.number(), z.number()]).optional(),
  claimIds: z.array(z.string().min(1))
})

export const mapRouteSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  kind: z.enum(['movement', 'attack', 'retreat', 'supply']),
  points: z.array(z.tuple([z.number(), z.number()])),
  allegiance: z.enum(['allied', 'axis', 'neutral', 'other']).optional(),
  claimIds: z.array(z.string().min(1))
})

export const frontLineSchema = z.object({
  id: z.string().min(1),
  points: z.array(z.tuple([z.number(), z.number()])),
  dateLabel: z.string().optional(),
  claimIds: z.array(z.string().min(1))
})

export const mapObjectiveSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  position: z.tuple([z.number(), z.number()]).optional(),
  allegiance: z.enum(['allied', 'axis', 'neutral', 'other']).optional(),
  claimIds: z.array(z.string().min(1))
})

export const dateLocationGraphicSchema = z.object({
  type: z.literal('date-location'),
  date: z.string().min(1),
  location: z.string().min(1),
  theatre: z.string().optional(),
  operation: z.string().optional(),
  coordinates: z.tuple([z.number(), z.number()]).optional(),
  backgroundId: z.enum(['bg1', 'bg2', 'bg4']).default('bg1')
})

export const battleMapGraphicSchema = z.object({
  type: z.literal('battle-map'),
  theatre: z.string().min(1),
  bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  dateLabel: z.string().optional(),
  units: z.array(mapUnitSchema),
  routes: z.array(mapRouteSchema),
  frontLines: z.array(frontLineSchema),
  objectives: z.array(mapObjectiveSchema),
  annotations: z.array(z.string()),
  backgroundId: z.enum(['bg2', 'bg4']).default('bg4')
})

export const timelineEventSchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  importance: z.enum(['critical', 'supporting']),
  claimIds: z.array(z.string().min(1))
})

export const militaryTimelineGraphicSchema = z.object({
  type: z.literal('military-timeline'),
  events: z.array(timelineEventSchema).min(1),
  backgroundId: z.enum(['bg2', 'bg4']).default('bg2')
})

export const forceSideSchema = z.object({
  name: z.string().min(1),
  allegiance: z.enum(['allied', 'axis', 'neutral', 'other']),
  personnel: z.number().nonnegative().optional(),
  aircraft: z.number().nonnegative().optional(),
  ships: z.number().nonnegative().optional(),
  vehicles: z.number().nonnegative().optional(),
  artillery: z.number().nonnegative().optional(),
  highlightedAdvantage: z.string().optional(),
  claimIds: z.array(z.string().min(1))
})

export const forceComparisonGraphicSchema = z.object({
  type: z.literal('force-comparison'),
  sides: z.array(forceSideSchema).min(2),
  backgroundId: z.literal('bg4').default('bg4')
})

export const equipmentSpecGraphicSchema = z.object({
  type: z.literal('equipment-spec'),
  name: z.string().min(1),
  model: z.string().optional(),
  variant: z.string().optional(),
  serviceYear: z.number().int().optional(),
  role: z.string().min(1),
  manufacturer: z.string().optional(),
  image: z.string().optional(),
  specifications: z.array(equipmentSpecificationSchema).min(1),
  backgroundId: z.literal('bg4').default('bg4')
})

export const detectionRangeSchema = z.object({
  id: z.string().min(1),
  center: z.tuple([z.number(), z.number()]).optional(),
  radiusKm: z.number().positive(),
  label: z.string().min(1),
  claimIds: z.array(z.string().min(1))
})

export const defensiveZoneSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  points: z.array(z.tuple([z.number(), z.number()])),
  claimIds: z.array(z.string().min(1))
})

export const formationSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  unitIds: z.array(z.string().min(1)),
  claimIds: z.array(z.string().min(1))
})

export const strategicOverlayGraphicSchema = z.object({
  type: z.literal('strategic-overlay'),
  theatre: z.string().min(1),
  objectives: z.array(mapObjectiveSchema),
  routes: z.array(mapRouteSchema),
  detectionRanges: z.array(detectionRangeSchema),
  defensiveZones: z.array(defensiveZoneSchema),
  formations: z.array(formationSchema),
  backgroundId: z.literal('bg4').default('bg4')
})

export const evidenceGraphicSchema = z.object({
  type: z.literal('evidence-card'),
  documentTitle: z.string().min(1),
  institution: z.string().min(1),
  date: z.string().optional(),
  excerpt: z.string().min(1),
  citationId: z.string().min(1),
  sourceUrl: z.string().url(),
  backgroundId: z.enum(['bg1', 'bg2']).default('bg2')
})

export const quoteGraphicSchema = z.object({
  type: z.literal('quote-card'),
  quote: z.string().min(1),
  speaker: z.string().min(1),
  role: z.string().optional(),
  institution: z.string().optional(),
  date: z.string().optional(),
  citationId: z.string().min(1),
  sourceUrl: z.string().url(),
  backgroundId: z.enum(['bg1', 'bg2']).default('bg1')
})

export const statisticValueSchema = z.object({
  label: z.string().min(1),
  value: z.number(),
  unit: z.string().optional(),
  side: z.enum(['allied', 'axis', 'neutral', 'other']).optional(),
  previousValue: z.number().optional(),
  claimId: z.string().min(1)
})

export const statisticsGraphicSchema = z.object({
  type: z.literal('statistics'),
  title: z.string().min(1),
  display: z.enum(['counter', 'bars', 'before-after', 'opposing-sides']),
  values: z.array(statisticValueSchema).min(1),
  backgroundId: z.enum(['bg2', 'bg4']).default('bg4')
})

export const graphicInstructionSchema = z.discriminatedUnion('type', [
  dateLocationGraphicSchema,
  battleMapGraphicSchema,
  militaryTimelineGraphicSchema,
  forceComparisonGraphicSchema,
  equipmentSpecGraphicSchema,
  strategicOverlayGraphicSchema,
  evidenceGraphicSchema,
  quoteGraphicSchema,
  statisticsGraphicSchema
])

export const documentaryBeatTypeSchema = z.enum([
  'archival-video',
  'archival-photo',
  'battle-map',
  'military-timeline',
  'force-comparison',
  'equipment-spec',
  'strategic-overlay',
  'evidence-card',
  'quote-card',
  'statistics',
  'reconstruction'
])

export const timedWordSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number()
})

export const documentaryTransitionSchema = z.object({
  type: z.enum([
    'crossfade',
    'whip-pan',
    'zoom-blur',
    'slide',
    'film-burn',
    'cut'
  ]),
  duration: z.number().min(0).max(1)
})

export const documentaryBeatSchema = z.object({
  id: z.string().min(1),
  chapterId: z.string().min(1),
  type: documentaryBeatTypeSchema,
  narration: z.string().min(1),
  start: z.number().nonnegative(),
  duration: z.number().positive(),
  words: z.array(timedWordSchema),
  claimIds: z.array(z.string().min(1)),
  dateLabel: z.string().optional(),
  locationIds: z.array(z.string().min(1)),
  entityIds: z.array(z.string().min(1)),
  visualQuery: z.string().min(1),
  visualIntent: z.string().min(1),
  graphic: graphicInstructionSchema.optional(),
  assetId: z.string().optional(),
  transitionOut: documentaryTransitionSchema.optional()
})

export const assetRightsSchema = z.object({
  provider: z.enum([
    'wikimedia',
    'internet-archive',
    'nara',
    'youtube',
    'user-provided',
    'ai-generated',
    'web'
  ]),
  sourceUrl: z.string().url().optional(),
  creator: z.string().optional(),
  institution: z.string().optional(),
  license: z.enum([
    'public-domain',
    'cc0',
    'cc-by',
    'cc-by-sa',
    'permission',
    'standard-youtube',
    'unknown'
  ]),
  attribution: z.string().optional(),
  reusable: z.boolean(),
  reviewRequired: z.boolean(),
  accessedAt: z.string().datetime()
})

export const documentaryAssetSchema = z.object({
  id: z.string().min(1),
  beatId: z.string().min(1),
  kind: z.enum([
    'video',
    'photo',
    'document',
    'map',
    'reconstruction',
    'audio'
  ]),
  src: z.string().optional(),
  title: z.string().min(1),
  visualIntent: z.string().min(1),
  claimIds: z.array(z.string().min(1)),
  rights: assetRightsSchema,
  reconstructionPrompt: z.string().optional(),
  usedInFinalRender: z.boolean().default(false)
})

export const documentaryQaIssueCodeSchema = z.enum([
  'opening-date-missing',
  'script-section-missing',
  'script-parse-failed',
  'critical-claim-unsupported',
  'historical-entity-contradiction',
  'quotation-citation-missing',
  'asset-rights-not-reusable',
  'evidence-source-missing',
  'disputed-claim',
  'repeated-visual',
  'visual-subject-mismatch',
  'visual-narration-mismatch',
  'retention-gap',
  'excessive-reconstruction',
  'attribution-detail-missing',
  'overlay-render-fallback'
])

export const documentaryQaIssueSchema = z.object({
  code: documentaryQaIssueCodeSchema,
  severity: z.enum(['blocking', 'warning']),
  message: z.string().min(1),
  claimIds: z.array(z.string().min(1)).default([]),
  beatIds: z.array(z.string().min(1)).default([]),
  assetIds: z.array(z.string().min(1)).default([]),
  evidence: z.string().optional(),
  suggestedAction: z.string().min(1)
})

export const documentaryQaReportSchema = z.object({
  publishReady: z.boolean(),
  issues: z.array(documentaryQaIssueSchema)
})

export const documentaryProjectSchema = z.object({
  id: z.string().min(1),
  profile: contentProfileSchema,
  inputMode: z.enum(['topic', 'script']),
  topic: z.string().min(1),
  targetMinutes: z.number().min(0.5).max(60),
  language: z.string().min(1),
  brief: documentaryBriefSchema,
  narration: z.string().min(1),
  rotationLog: rotationLogSchema.optional(),
  dossier: researchDossierSchema,
  chapters: z.array(documentaryChapterSchema).min(1),
  beats: z.array(documentaryBeatSchema),
  assets: z.array(documentaryAssetSchema),
  qa: documentaryQaReportSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export type ContentProfile = z.infer<typeof contentProfileSchema>
export type DocumentaryBrief = z.infer<typeof documentaryBriefSchema>
export type RotationLog = z.infer<typeof rotationLogSchema>
export type SourceClass = z.infer<typeof sourceClassSchema>
export type DocumentarySource = z.infer<typeof documentarySourceSchema>
export type CitationRecord = z.infer<typeof citationRecordSchema>
export type ClaimRecord = z.infer<typeof claimRecordSchema>
export type ResearchDossier = z.infer<typeof researchDossierSchema>
export type DocumentaryAct = z.infer<typeof documentaryActSchema>
export type DocumentaryChapter = z.infer<typeof documentaryChapterSchema>
export type DocumentaryBackgroundId = z.infer<
  typeof documentaryBackgroundIdSchema
>
export type GraphicInstruction = z.infer<typeof graphicInstructionSchema>
export type DocumentaryBeatType = z.infer<typeof documentaryBeatTypeSchema>
export type DocumentaryBeat = z.infer<typeof documentaryBeatSchema>
export type AssetRights = z.infer<typeof assetRightsSchema>
export type DocumentaryAsset = z.infer<typeof documentaryAssetSchema>
export type DocumentaryQaIssue = z.infer<typeof documentaryQaIssueSchema>
export type DocumentaryQaReport = z.infer<typeof documentaryQaReportSchema>
export type DocumentaryProject = z.infer<typeof documentaryProjectSchema>
