import { tool } from 'ai'
import { z } from 'zod'

import { prepareDocumentaryProject } from '@/lib/engine/documentary/project'
import { documentarySourceSchema } from '@/lib/engine/documentary/schema'
import { getModel } from '@/lib/utils/registry'

const sharedFields = {
  language: z.string().min(1).default('English'),
  sources: z.array(documentarySourceSchema).default([])
}

export const prepareDocumentaryInputSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('topic'),
    topic: z.string().min(1),
    targetMinutes: z.number().min(0.5).max(60),
    angle: z.string().optional(),
    ...sharedFields
  }),
  z.object({
    mode: z.literal('script'),
    script: z.string().min(1),
    topic: z.string().optional(),
    targetMinutes: z.number().min(0.5).max(60).optional(),
    ...sharedFields
  })
])

export function createPrepareDocumentaryTool(model: string) {
  return tool({
    description:
      'Prepare an evidence-backed WW1/WW2 documentary from a researched topic or an existing VidRush-style script. Returns a persisted documentary handle for semantic beat planning.',
    inputSchema: prepareDocumentaryInputSchema,
    execute: async input => {
      const project = await prepareDocumentaryProject(getModel(model), input)
      return {
        state: 'complete' as const,
        documentaryId: project.id,
        topic: project.topic,
        inputMode: project.inputMode,
        chapterCount: project.chapters.length,
        targetMinutes: project.targetMinutes,
        publishReady: project.qa.publishReady,
        issues: project.qa.issues
      }
    }
  })
}
