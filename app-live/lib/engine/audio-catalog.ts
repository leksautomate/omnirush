import { z } from 'zod'

export const PIXABAY_LICENSE_URL =
  'https://pixabay.com/service/license-summary/'

const catalogFileSchema = z
  .string()
  .min(1)
  .refine(file => !file.includes('..') && !file.includes('\\'), {
    message: 'Audio catalogue file must stay inside public/audio'
  })
  .refine(
    file =>
      /^(music|sfx|ambient)\/[a-z0-9][a-z0-9._ &,-]*\.(mp3|wav|m4a)$/i.test(file),
    {
      message:
        'Audio catalogue file must be a supported path under music/, sfx/, or ambient/'
    }
  )

export const audioCatalogTrackSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(/^[a-z0-9][a-z0-9-]*$/),
    kind: z.enum(['music', 'sfx', 'ambient']),
    title: z.string().min(1),
    creator: z.string().min(1),
    file: catalogFileSchema,
    source: z.literal('pixabay'),
    sourceUrl: z
      .string()
      .url()
      .refine(
        url =>
          /^https:\/\/(?:www\.)?pixabay\.com\/(?:music|sound-effects)\//i.test(
            url
          ),
        {
          message:
            'sourceUrl must be the original Pixabay music or sound-effects page'
        }
      ),
    license: z.literal('Pixabay Content License'),
    licenseUrl: z.literal(PIXABAY_LICENSE_URL),
    downloadedAt: z.string().date(),
    durationSec: z.number().positive(),
    instrumental: z.boolean().default(true),
    contentIdRegistered: z.boolean(),
    genres: z.array(z.string().min(1)).default([]),
    moods: z.array(z.string().min(1)).default([]),
    tags: z.array(z.string().min(1)).default([])
  })
  .superRefine((track, ctx) => {
    const expectedDir = track.kind === 'music' ? 'music/' : `${track.kind}/`
    if (!track.file.startsWith(expectedDir)) {
      ctx.addIssue({
        code: 'custom',
        path: ['file'],
        message: `${track.kind} assets must be stored under ${expectedDir}`
      })
    }
  })

export const audioCatalogSchema = z
  .object({
    version: z.literal(1),
    tracks: z.array(audioCatalogTrackSchema)
  })
  .superRefine((catalogue, ctx) => {
    const ids = new Set<string>()
    for (const [index, track] of catalogue.tracks.entries()) {
      if (ids.has(track.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['tracks', index, 'id'],
          message: `Duplicate audio catalogue id: ${track.id}`
        })
      }
      ids.add(track.id)
    }
  })

export type AudioCatalogTrack = z.infer<typeof audioCatalogTrackSchema>
export type AudioCatalog = z.infer<typeof audioCatalogSchema>

export function parseAudioCatalog(input: unknown): AudioCatalog {
  return audioCatalogSchema.parse(input)
}

export interface SelectAudioTrackInput {
  prompt: string
  kind?: AudioCatalogTrack['kind']
  instrumental?: boolean
  allowContentId?: boolean
}

const QUERY_EXPANSIONS: Record<string, string[]> = {
  automotive: ['car', 'engine', 'rock', 'energetic'],
  breakdown: ['technical', 'energetic', 'modern'],
  business: ['corporate', 'positive', 'technology'],
  crime: ['dark', 'suspense', 'investigation'],
  documentary: ['cinematic', 'storytelling', 'background'],
  explainer: ['corporate', 'technology', 'background'],
  finance: ['business', 'corporate', 'technology'],
  history: ['documentary', 'cinematic', 'dramatic'],
  listicle: ['upbeat', 'energetic', 'positive'],
  mystery: ['dark', 'suspense', 'investigation'],
  science: ['technology', 'ambient', 'futuristic'],
  tech: ['technology', 'electronic', 'futuristic']
}

function tokens(value: string): Set<string> {
  const base = String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(word => word.length > 1)
  return new Set(
    base.flatMap(word => [word, ...(QUERY_EXPANSIONS[word] || [])])
  )
}

function scoreTrack(query: Set<string>, track: AudioCatalogTrack): number {
  const title = tokens(track.title)
  const tags = tokens(track.tags.join(' '))
  const moods = tokens(track.moods.join(' '))
  const genres = tokens(track.genres.join(' '))
  let score = 0
  for (const word of query) {
    if (title.has(word)) score += 4
    if (tags.has(word)) score += 3
    if (moods.has(word)) score += 3
    if (genres.has(word)) score += 2
  }
  return score
}

export function selectAudioTrack(
  catalogue: AudioCatalog,
  input: SelectAudioTrackInput
): AudioCatalogTrack | null {
  const kind = input.kind ?? 'music'
  const candidates = catalogue.tracks.filter(track => {
    if (track.kind !== kind) return false
    if (input.instrumental === true && !track.instrumental) return false
    if (!input.allowContentId && track.contentIdRegistered) return false
    return true
  })
  if (!candidates.length) return null

  const query = tokens(input.prompt)
  const scored = candidates
    .map(track => ({ track, score: scoreTrack(query, track) }))
    .sort((a, b) => b.score - a.score)

  const topScore = scored[0].score
  const topCandidates = scored.filter(item => item.score === topScore)
  const chosenIndex = Math.floor(Math.random() * topCandidates.length)
  return topCandidates[chosenIndex].track
}

export function toCatalogAudioUrl(track: AudioCatalogTrack): string {
  return `/audio/${track.file}`
}

export function toMusicCredit(track: AudioCatalogTrack) {
  return {
    title: track.title,
    creator: track.creator,
    source: track.source,
    sourceUrl: track.sourceUrl,
    license: track.license,
    licenseUrl: track.licenseUrl,
    contentIdRegistered: track.contentIdRegistered
  }
}
