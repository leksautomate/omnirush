import { createId } from '@paralleldrive/cuid2'
import { tool } from 'ai'
import { z } from 'zod'

import { loadDocumentaryProject } from '@/lib/engine/documentary/project'
import {
  canUseInFinalRender,
  classifyAssetRights,
  createReconstructionAsset,
  selectDocumentaryAsset
} from '@/lib/engine/documentary/rights'
import { generateImageModelArk } from '@/lib/engine/image'
import { kvGetJSON, kvSetJSON } from '@/lib/engine/kv'
import { sourceFootage } from '@/lib/engine/sourcing'
import {
  isResolvedMp4Input,
  selectRelevantVideoSegment
} from '@/lib/engine/video-segments'

const sourceFootageSchema = z.object({
  queries: z
    .array(z.string())
    .min(1)
    .describe(
      'One or more concrete visual search phrases for this scene, most specific first (e.g. ["Apollo 11 Saturn V launch", "1969 rocket liftoff footage"])'
    ),
  intent: z
    .string()
    .optional()
    .describe(
      'Plain-language description of what the shot must SHOW, used to vision-verify the pick (e.g. "the rocket actually lifting off the pad, no text overlays")'
    ),
  narration: z
    .string()
    .optional()
    .describe(
      'Narration spoken during this shot, used to select the best MP4 section'
    ),
  minimumDuration: z
    .number()
    .positive()
    .optional()
    .describe(
      'Storyboard shot duration in seconds. Selected video windows must be at least this long.'
    ),
  limit: z
    .number()
    .min(1)
    .max(20)
    .optional()
    .describe('How many ranked candidates to return (default 8)'),
  documentaryId: z
    .string()
    .optional()
    .describe('Documentary project handle for rights-safe final selection'),
  beatId: z
    .string()
    .optional()
    .describe('Documentary beat receiving the selected asset'),
  finalRender: z
    .boolean()
    .optional()
    .describe(
      'When true, exclude standard YouTube and unknown-rights web assets from the selected result'
    ),
  userConfirmedRights: z
    .boolean()
    .optional()
    .describe('Explicit confirmation that a user-provided asset may be reused')
})

// Scout real footage/imagery for a scene. Pools open archives (Wikimedia, Internet
// Archive, National Archives) AND kakkao's configured web search provider, ranks by
// relevance, and — when a Gemini key is present — vision-verifies that the top pick
// actually depicts the subject and is free of burned-in text/watermarks.
export function createSourceFootageTool() {
  return tool({
    description:
      "Find real b-roll footage and full-resolution photos for a video scene. Pools open archives (Wikimedia Commons, Internet Archive, U.S. National Archives) together with the general web via kakkao's search provider, ranks candidates by relevance, and vision-verifies the best pick when possible. A successful selection returns footageId; pass that handle into composeRender so the exact selected asset and media kind are preserved without copying a thumbnail or watch-page URL.",
    inputSchema: sourceFootageSchema,
    execute: async ({
      queries,
      intent,
      narration,
      minimumDuration,
      limit,
      documentaryId,
      beatId,
      finalRender,
      userConfirmedRights
    }) => {
      const checkpointKey = beatId
        ? `checkpoint:footage:${documentaryId || 'general'}:${beatId}`
        : null

      if (checkpointKey) {
        const cached = await kvGetJSON<{
          best: any
          footageId: string
          candidates: any[]
        }>(checkpointKey)
        if (cached?.footageId && cached?.best?.src) {
          return {
            state: 'complete' as const,
            queries,
            intent: intent || '',
            visionVerified: true,
            best: cached.best,
            footageId: cached.footageId,
            candidates: cached.candidates || []
          }
        }
      }

      const result = await sourceFootage(
        queries,
        intent || queries.join('; '),
        {
          limit: limit ?? 8,
          minimumDuration: minimumDuration ?? 0
        }
      )
      const accessedAt = new Date().toISOString()
      const candidates = result.candidates.map(candidate => {
        const withConfirmation = userConfirmedRights
          ? {
              ...candidate,
              providerMetadata: {
                ...candidate.providerMetadata,
                userConfirmedRights: true
              }
            }
          : candidate
        return {
          ...withConfirmation,
          rights: classifyAssetRights(withConfirmation, accessedAt)
        }
      })

      const persistSelection = async (asset: {
        kind?: string
        src?: string
        [key: string]: unknown
      }) => {
        if (!asset.src) return undefined
        const isImage = /\.(png|jpe?g|webp|gif|svg)$/i.test(asset.src.split('?')[0].split('#')[0])
        const normalizedAsset = isImage ? { ...asset, kind: 'photo' } : asset
        if (normalizedAsset.kind !== 'video' && normalizedAsset.kind !== 'photo') {
          return undefined
        }
        const footageId = `ft_${createId()}`
        await kvSetJSON(`footage:${footageId}`, normalizedAsset)
        return footageId
      }

      const withVideoSegment = async <
        T extends {
          kind?: string
          src?: string
          mimeType?: string
          sourceDuration?: number
          mediaMuted?: boolean
          [key: string]: unknown
        }
      >(
        asset: T
      ): Promise<T> => {
        if (asset.kind !== 'video' || !asset.src) return asset
        const mutedAsset = {
          ...asset,
          mediaMuted: asset.mediaMuted ?? true
        }
        if (
          !process.env.MODELARK_API_KEY ||
          !narration?.trim() ||
          !minimumDuration ||
          !asset.sourceDuration ||
          !isResolvedMp4Input(asset.src, asset.mimeType)
        ) {
          return mutedAsset
        }
        const segment = await selectRelevantVideoSegment({
          narration,
          visualIntent: intent || queries.join('; '),
          minimumDuration,
          sourceDuration: asset.sourceDuration,
          videoUrl: asset.src,
          mimeType: asset.mimeType
        })
        return {
          ...mutedAsset,
          mediaStart: segment.start,
          mediaEnd: segment.end,
          segmentReason: segment.reason
        }
      }

      if (finalRender) {
        const project = documentaryId ? await loadDocumentaryProject(documentaryId) : null
        const beat = project?.beats.find(item => item.id === beatId)
        if (!project || !beat) {
          console.warn(`[sourceFootage] Project/beat missing for ${documentaryId}/${beatId}. Returning best candidate.`)
          const fallbackAsset = result.best
            ? await withVideoSegment({
                ...result.best,
                rights: classifyAssetRights(result.best, accessedAt)
              })
            : null
          const footageId = fallbackAsset ? await persistSelection(fallbackAsset) : undefined
          return {
            state: 'complete' as const,
            queries,
            intent: intent || '',
            visionVerified: result.visionVerified,
            best: fallbackAsset,
            footageId,
            candidates
          }
        }

        const resolvedCandidates = result.best
          ? [
              result.best,
              ...result.candidates.filter(
                candidate =>
                  candidate.url !== result.best?.url ||
                  candidate.src !== result.best?.src
              )
            ]
          : result.candidates
        let selectedAsset = selectDocumentaryAsset(
          beat,
          resolvedCandidates,
          accessedAt
        )

        if (!selectedAsset) {
          const chapter = project.chapters.find(
            item => item.id === beat.chapterId
          )
          const locations = project.dossier.locations.filter(location =>
            beat.locationIds.includes(location.id)
          )
          const equipment = project.dossier.equipment
            .filter(item => beat.entityIds.includes(item.id))
            .map(item =>
              [item.name, item.model, item.variant].filter(Boolean).join(' ')
            )
          const date = beat.dateLabel ?? chapter?.dateRange ?? '1943'
          const location = locations.length > 0
            ? locations.map(item => [item.name, item.theatre].filter(Boolean).join(', ')).join('; ')
            : 'Eastern Front'

          selectedAsset = createReconstructionAsset(beat, {
            date,
            location,
            equipment,
            operationalContext: beat.visualIntent,
            claimIds: beat.claimIds
          })
        }

        const updatedBeats = project.beats.map(item =>
          item.id === beat.id
            ? {
                ...item,
                assetId: selectedAsset.id,
                type:
                  selectedAsset.rights.provider === 'ai-generated'
                    ? ('reconstruction' as const)
                    : item.type
              }
            : item
        )
        const updatedProject = {
          ...project,
          beats: updatedBeats,
          assets: [
            ...project.assets.filter(asset => asset.beatId !== beat.id),
            selectedAsset
          ],
          updatedAt: accessedAt
        }
        await kvSetJSON(`documentary:${project.id}`, updatedProject)
        const selectedCandidate = resolvedCandidates.find(
          candidate => candidate.src === selectedAsset.src
        )
        const persistedAsset = await withVideoSegment({
          ...selectedAsset,
          sourceDuration: selectedCandidate?.sourceDuration,
          mimeType: selectedCandidate?.mimeType
        })
        const footageId = await persistSelection(persistedAsset)

        return {
          state: 'complete' as const,
          queries,
          intent: intent || '',
          visionVerified: result.visionVerified,
          selectedAsset: persistedAsset,
          best: persistedAsset,
          footageId,
          candidates,
          referenceCandidates: candidates.filter(
            candidate =>
              !canUseInFinalRender(candidate.rights) || candidate.needsResolve
          )
        }
      }

      let best = result.best
        ? await withVideoSegment({
            ...result.best,
            rights: classifyAssetRights(result.best, accessedAt)
          })
        : null

      if (!best && process.env.MODELARK_API_KEY) {
        try {
          const prompt = intent || queries[0]
          const imageRes = await generateImageModelArk(prompt)
          if (imageRes?.imageUrl) {
            best = {
              kind: 'photo',
              src: imageRes.imageUrl,
              url: imageRes.imageUrl,
              title: prompt,
              rights: {
                provider: 'ai-generated',
                license: 'ModelArk Seedream',
                usage: 'commercial-ok'
              }
            } as any
          }
        } catch (err) {
          console.warn('[sourceFootage] AI image fallback failed:', err)
        }
      }

      const footageId = best ? await persistSelection(best) : undefined

      if (checkpointKey && footageId && best) {
        await kvSetJSON(checkpointKey, {
          best,
          footageId,
          candidates
        })
      }

      return {
        state: 'complete' as const,
        queries,
        intent: intent || '',
        visionVerified: result.visionVerified,
        best,
        footageId,
        candidates
      }
    }
  })
}
