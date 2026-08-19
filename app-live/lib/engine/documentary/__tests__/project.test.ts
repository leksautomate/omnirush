import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { generateText } = vi.hoisted(() => ({ generateText: vi.fn() }))
const { kvGetJSON, kvSetJSON, kvStore } = vi.hoisted(() => {
  const store = new Map<string, unknown>()
  return {
    kvStore: store,
    kvGetJSON: vi.fn(async (key: string) => store.get(key) ?? null),
    kvSetJSON: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value)
    })
  }
})
const { buildResearchDossier } = vi.hoisted(() => ({
  buildResearchDossier: vi.fn()
}))

vi.mock('ai', async importOriginal => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText
}))
vi.mock('@/lib/engine/kv', () => ({ kvGetJSON, kvSetJSON }))
vi.mock('../research', async importOriginal => {
  const actual = await importOriginal<typeof import('../research')>()
  return { ...actual, buildResearchDossier }
})
vi.mock('@paralleldrive/cuid2', () => ({ createId: () => 'doc-1' }))

import { loadDocumentaryProject, prepareDocumentaryProject } from '../project'
import type { DocumentarySource, ResearchDossier } from '../schema'

const midwayFixture = readFileSync(
  path.join(
    process.cwd(),
    'lib/engine/documentary/__tests__/fixtures/midway-vidrush.txt'
  ),
  'utf8'
)
const now = '2026-08-14T00:00:00.000Z'

function source(id = 'source-1'): DocumentarySource {
  return {
    id,
    title: 'Official history of Midway',
    url: `https://www.history.navy.mil/${id}`,
    authorOrInstitution: 'Naval History and Heritage Command',
    accessedAt: now,
    sourceClass: 'institutional',
    supportingNote: 'Supports the chronology.',
    reliability: 'high'
  }
}

function dossier(): ResearchDossier {
  return {
    thesis: 'Intelligence and timing changed the Pacific War.',
    chronology: [],
    claims: [],
    citations: [],
    people: [],
    militaryUnits: [],
    equipment: [],
    locations: [],
    quotations: []
  }
}

const acts = [
  'cold-open',
  'strategic-context',
  'build-up',
  'conflict',
  'turning-point',
  'aftermath',
  'epilogue'
] as const

describe('prepareDocumentaryProject', () => {
  beforeEach(() => {
    kvStore.clear()
    kvGetJSON.mockClear()
    kvSetJSON.mockClear()
    generateText.mockReset()
    buildResearchDossier.mockReset().mockResolvedValue(dossier())
  })

  it('preserves imported narration and persists a script project', async () => {
    const project = await prepareDocumentaryProject('test-model', {
      mode: 'script',
      script: midwayFixture,
      targetMinutes: 12,
      language: 'English',
      sources: [source()]
    })

    expect(project.inputMode).toBe('script')
    expect(project.narration).toMatch(/^By the summer of 1942/)
    expect(project.narration).not.toContain('Rotation Log')
    expect(kvSetJSON).toHaveBeenCalledWith(
      'documentary:doc-1',
      expect.objectContaining({ id: 'doc-1' })
    )
    await expect(loadDocumentaryProject('doc-1')).resolves.toMatchObject({
      id: 'doc-1'
    })
  })

  it('generates and checkpoints every chapter above twenty minutes', async () => {
    generateText.mockImplementation(async ({ prompt, tools }) =>
      tools
        ? {
            toolCalls: [
              {
                toolName: 'submit_documentary_object',
                input: {
                  chapters: acts.map((act, index) => ({
                    title: `Chapter ${index + 1}`,
                    act,
                    dateRange: index === 0 ? '1939–1945' : undefined,
                    locationIds: [],
                    claimIds: [],
                    entityIds: [],
                    emotionalObjective: `Objective ${index + 1}`,
                    retentionHook: `Hook ${index + 1}`,
                    minutes: 45 / acts.length
                  }))
                }
              }
            ]
          }
        : {
            text: prompt.includes('cold-open')
              ? 'By September 1939, the Atlantic had become a battlefield.'
              : 'The evidence moves the story into its next documented phase.'
          }
    )

    const project = await prepareDocumentaryProject('test-model', {
      mode: 'topic',
      topic: 'The Battle of the Atlantic',
      targetMinutes: 45,
      language: 'English',
      sources: [source('archive'), source('museum')]
    })

    const narrationCalls = generateText.mock.calls.filter(
      ([options]) => !options.tools
    )
    expect(narrationCalls).toHaveLength(project.chapters.length)
    for (const chapter of project.chapters) {
      expect(kvSetJSON).toHaveBeenCalledWith(
        `documentary:${project.id}:chapter:${chapter.id}`,
        expect.objectContaining({ chapterId: chapter.id })
      )
    }
  })

  it('refuses topic mode without researched sources', async () => {
    await expect(
      prepareDocumentaryProject('test-model', {
        mode: 'topic',
        topic: 'Operation Torch',
        targetMinutes: 10,
        language: 'English',
        sources: []
      })
    ).rejects.toThrow('Topic mode requires at least one structured source')
  })
})
