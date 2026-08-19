import { z } from 'zod'

import {
  assetRightsSchema,
  citationRecordSchema,
  documentaryBeatTypeSchema,
  documentaryChapterSchema,
  documentaryQaReportSchema,
  graphicInstructionSchema
} from '../lib/engine/documentary/schema'

export const documentaryGraphicSchema = graphicInstructionSchema
export const assetRightsRenderSchema = assetRightsSchema

export const documentaryShotMetadataSchema = z.object({
  beatType: documentaryBeatTypeSchema,
  chapterId: z.string().min(1),
  claimIds: z.array(z.string().min(1)),
  entityIds: z.array(z.string().min(1)),
  locationIds: z.array(z.string().min(1)),
  dateLabel: z.string().optional(),
  graphic: documentaryGraphicSchema.optional(),
  assetId: z.string().optional(),
  rights: assetRightsRenderSchema.optional(),
  reconstruction: z.boolean().default(false),
  filmTreatmentBackgroundId: z.literal('bg3').optional()
})

export const documentaryStoryboardMetadataSchema = z.object({
  id: z.string().min(1),
  chapters: z.array(documentaryChapterSchema),
  citations: z.array(citationRecordSchema),
  qa: documentaryQaReportSchema
})

export type DocumentaryGraphic = z.infer<typeof documentaryGraphicSchema>
export type DocumentaryShotMetadata = z.infer<
  typeof documentaryShotMetadataSchema
>
export type DocumentaryStoryboardMetadata = z.infer<
  typeof documentaryStoryboardMetadataSchema
>
