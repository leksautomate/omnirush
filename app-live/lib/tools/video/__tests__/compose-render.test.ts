import { beforeEach, describe, expect, it, vi } from 'vitest'

// Regression coverage for a real production bug: composeRender used to require the model
// to retype every shot's narration + full word-level caption array, even though cutBeats
// had already computed and returned that exact data moments earlier. For a long storyboard
// that JSON payload got truncated mid-tool-call, and the model had to drop captions to fit.
// beatsId lets composeRender pull the full shot data back from storage instead.
const kvStore = vi.hoisted(() => new Map<string, unknown>())
const kvGetJSON = vi.hoisted(() =>
  vi.fn(async (key: string) => kvStore.get(key) ?? null)
)
const kvSetJSON = vi.hoisted(() =>
  vi.fn(async (key: string, value: unknown) => {
    kvStore.set(key, value)
  })
)
vi.mock('@/lib/engine/kv', () => ({ kvGetJSON, kvSetJSON }))
vi.mock('@/lib/remotion/lambda', () => ({
  isLambdaConfigured: () => false
}))

import { createComposeRenderTool } from '../compose-render'

import type { StoryboardInput } from '@/remotion/schema'

// tool()'s inferred `execute` return type is `Promise<T> | AsyncIterable<T>` (it also
// supports streaming tools), which TypeScript won't narrow from an `await` alone. Every
// test here awaits a plain object result, so route through this helper once instead of
// casting at each call site.
async function runCompose(
  tool: ReturnType<typeof createComposeRenderTool>,
  input: unknown
): Promise<{
  state: 'complete'
  studioId: string
  studioPath: string
  inputProps: StoryboardInput
  totalSeconds: number
  shots: number
  hadVoice: boolean
  hadMusic: boolean
  fallbacks: number
  lambdaReady: boolean
}> {
  return (await tool.execute!(
    input as any,
    {
      toolCallId: 't1',
      messages: []
    } as any
  )) as any
}

function makeStoredStoryboard() {
  return {
    topic: 'Test',
    format: '16:9' as const,
    width: 1280,
    height: 720,
    fps: 30,
    brand: { channel: 'Test Channel', accent: '#ff2d55' },
    totalSeconds: 6,
    estimatedTimings: true,
    shots: [
      {
        kind: 'video' as const,
        narration: 'First shot narration.',
        visualQuery: 'q1',
        visualIntent: 'i1',
        start: 0,
        duration: 3,
        words: [
          { word: 'First', start: 0, end: 0.5 },
          { word: 'shot', start: 0.5, end: 1 }
        ]
      },
      {
        kind: 'photo' as const,
        narration: 'Second shot narration.',
        visualQuery: 'q2',
        visualIntent: 'i2',
        start: 3,
        duration: 3,
        words: [{ word: 'Second', start: 3, end: 3.5 }]
      }
    ]
  }
}

describe('createComposeRenderTool — beatsId merge', () => {
  beforeEach(() => {
    kvStore.clear()
    kvGetJSON.mockClear()
    kvSetJSON.mockClear()
  })

  it('pulls narration/timing/words from the stored beats result, using only src from the model', async () => {
    kvStore.set('beats:bt_1', makeStoredStoryboard())
    const tool = createComposeRenderTool()

    const result = await runCompose(tool, {
      beatsId: 'bt_1',
      shots: [
        { src: 'https://example.com/a.jpg' },
        { src: 'https://example.com/b.jpg' }
      ]
    })

    expect(result.shots).toBe(2)
    expect(result.inputProps.shots[0]).toMatchObject({
      kind: 'video',
      src: 'https://example.com/a.jpg',
      narration: 'First shot narration.',
      start: 0,
      duration: 3
    })
    expect(result.inputProps.shots[0].words).toHaveLength(2)
    expect(result.inputProps.shots[1]).toMatchObject({
      kind: 'photo',
      src: 'https://example.com/b.jpg',
      narration: 'Second shot narration.'
    })
  })

  it('falls back to a brand card (no src) for a shot the model omitted', async () => {
    kvStore.set('beats:bt_1', makeStoredStoryboard())
    const tool = createComposeRenderTool()

    const result = await runCompose(tool, {
      beatsId: 'bt_1',
      shots: [{ src: 'https://example.com/a.jpg' }] // only 1 override for 2 stored shots
    })

    expect(result.fallbacks).toBe(1)
    expect(result.inputProps.shots[1].src).toBeUndefined()
    expect(result.inputProps.shots[1].narration).toBe('Second shot narration.')
  })

  it('lets a per-shot override win over the stored value', async () => {
    kvStore.set('beats:bt_1', makeStoredStoryboard())
    const tool = createComposeRenderTool()

    const result = await runCompose(tool, {
      beatsId: 'bt_1',
      shots: [
        { src: 'https://example.com/a.jpg', kind: 'a-roll' },
        { src: 'https://example.com/b.jpg' }
      ]
    })

    expect(result.inputProps.shots[0].kind).toBe('a-roll')
  })

  it('resolves a sourceFootage handle to the exact selected clip and media kind', async () => {
    kvStore.set('beats:bt_1', makeStoredStoryboard())
    kvStore.set('footage:ft_kursk', {
      kind: 'video',
      src: 'https://archive.org/download/kursk/kursk.mp4',
      thumb: 'https://archive.org/services/img/kursk',
      title: 'Battle of Kursk archival film',
      source: 'Internet Archive'
    })
    const tool = createComposeRenderTool()

    const result = await runCompose(tool, {
      beatsId: 'bt_1',
      shots: [
        { footageId: 'ft_kursk' },
        { src: 'https://example.com/second.jpg' }
      ]
    })

    expect(result.inputProps.shots[0]).toMatchObject({
      kind: 'video',
      src: 'https://archive.org/download/kursk/kursk.mp4',
      mediaOrigin: 'archival',
      mediaFit: 'contain'
    })
  })

  it('carries the selected source window and muted flag from footage into the storyboard', async () => {
    kvStore.set('beats:bt_1', makeStoredStoryboard())
    kvStore.set('footage:ft_segment', {
      kind: 'video',
      src: 'https://archive.org/download/reel/reel.mp4',
      thumb: 'https://archive.org/services/img/reel',
      title: 'Selected archival segment',
      source: 'Internet Archive',
      mediaStart: 3,
      mediaEnd: 9.5,
      mediaMuted: true,
      sourceDuration: 18
    })
    const tool = createComposeRenderTool()

    const result = await runCompose(tool, {
      beatsId: 'bt_1',
      shots: [
        { footageId: 'ft_segment' },
        { src: 'https://example.com/second.jpg' }
      ]
    })

    expect(result.inputProps.shots[0]).toMatchObject({
      mediaStart: 3,
      mediaEnd: 9.5,
      mediaMuted: true,
      sourceDuration: 18
    })
  })

  it('defaults researched footage images and videos to contain', async () => {
    kvStore.set('beats:bt_1', makeStoredStoryboard())
    kvStore.set('footage:ft_researched_video', {
      kind: 'video',
      src: 'https://media.example.com/researched.mp4',
      thumb: 'https://media.example.com/researched.jpg',
      title: 'Researched video',
      source: 'Kakkao Web Search'
    })
    kvStore.set('footage:ft_researched_image', {
      kind: 'photo',
      src: 'https://media.example.com/researched.jpg',
      thumb: 'https://media.example.com/researched.jpg',
      title: 'Researched image',
      source: 'Kakkao Web Search'
    })
    const tool = createComposeRenderTool()

    const result = await runCompose(tool, {
      beatsId: 'bt_1',
      shots: [
        { footageId: 'ft_researched_video' },
        { footageId: 'ft_researched_image' }
      ]
    })

    expect(result.inputProps.shots).toMatchObject([
      { kind: 'video', mediaOrigin: 'researched', mediaFit: 'contain' },
      { kind: 'photo', mediaOrigin: 'researched', mediaFit: 'contain' }
    ])
  })

  it.each([
    ['researched', 'contain'],
    ['archival', 'contain'],
    ['generated', 'cover'],
    ['manual', 'cover']
  ] as const)(
    'defaults a direct %s URL to %s',
    async (mediaOrigin, mediaFit) => {
      const tool = createComposeRenderTool()

      const result = await runCompose(tool, {
        shots: [
          {
            kind: 'photo',
            src: 'https://media.example.com/direct.jpg',
            start: 0,
            duration: 4,
            mediaOrigin
          }
        ]
      })

      expect(result.inputProps.shots[0]).toMatchObject({
        mediaOrigin,
        mediaFit
      })
    }
  )

  it('leaves a legacy direct URL without origin in safe cover mode', async () => {
    const tool = createComposeRenderTool()

    const result = await runCompose(tool, {
      shots: [
        {
          kind: 'photo',
          src: 'https://media.example.com/legacy.jpg',
          start: 0,
          duration: 4
        }
      ]
    })

    expect(result.inputProps.shots[0].mediaOrigin).toBeUndefined()
    expect(result.inputProps.shots[0].mediaFit).toBeUndefined()
  })

  it('lets explicit mediaFit override the researched-footage default', async () => {
    kvStore.set('beats:bt_1', makeStoredStoryboard())
    kvStore.set('footage:ft_kursk', {
      kind: 'video',
      src: 'https://archive.org/download/kursk/kursk.mp4',
      thumb: 'https://archive.org/services/img/kursk',
      title: 'Battle of Kursk archival film',
      source: 'Internet Archive'
    })
    const tool = createComposeRenderTool()

    const result = await runCompose(tool, {
      beatsId: 'bt_1',
      shots: [
        { footageId: 'ft_kursk', mediaFit: 'cover' },
        { src: 'https://example.com/second.jpg' }
      ]
    })

    expect(result.inputProps.shots[0].mediaFit).toBe('cover')
    expect(result.inputProps.shots[0].mediaOrigin).toBe('archival')
  })

  it('keeps generated reconstruction footage full-frame by default', async () => {
    kvStore.set('beats:bt_1', makeStoredStoryboard())
    kvStore.set('footage:ft_reconstruction', {
      kind: 'photo',
      src: 'https://images.example.com/generated-reconstruction.jpg',
      thumb: 'https://images.example.com/generated-reconstruction.jpg',
      title: 'Grounded reconstruction',
      source: 'AI generated reconstruction',
      rights: { provider: 'ai-generated' }
    })
    const tool = createComposeRenderTool()

    const result = await runCompose(tool, {
      beatsId: 'bt_1',
      shots: [
        { footageId: 'ft_reconstruction' },
        { src: 'https://example.com/second.jpg' }
      ]
    })

    expect(result.inputProps.shots[0].mediaFit).toBe('cover')
    expect(result.inputProps.shots[0].mediaOrigin).toBe('generated')
  })

  it('throws a clear error when beatsId does not resolve to a stored storyboard', async () => {
    const tool = createComposeRenderTool()

    await expect(
      tool.execute!(
        {
          beatsId: 'bt_missing',
          shots: [{ src: 'https://example.com/a.jpg' }]
        } as any,
        { toolCallId: 't1', messages: [] } as any
      )
    ).rejects.toThrow('not found')
  })

  it('still works standalone (no beatsId) with a full shot list', async () => {
    const tool = createComposeRenderTool()

    const result = await runCompose(tool, {
      shots: [
        {
          kind: 'photo',
          src: 'https://example.com/a.jpg',
          start: 0,
          duration: 4
        }
      ]
    })

    expect(result.shots).toBe(1)
    expect(result.inputProps.shots[0]).toMatchObject({
      kind: 'photo',
      src: 'https://example.com/a.jpg',
      start: 0,
      duration: 4
    })
  })

  it('throws when a shot is missing start/duration and there is no beatsId to fall back on', async () => {
    const tool = createComposeRenderTool()

    await expect(
      tool.execute!(
        { shots: [{ src: 'https://example.com/a.jpg' }] } as any,
        { toolCallId: 't1', messages: [] } as any
      )
    ).rejects.toThrow('start/duration')
  })

  it('passes an explicit captionStyle through to the stored storyboard', async () => {
    const tool = createComposeRenderTool()

    const result = await runCompose(tool, {
      captionStyle: 'tiktok',
      shots: [
        {
          kind: 'photo',
          src: 'https://example.com/a.jpg',
          start: 0,
          duration: 4
        }
      ]
    })

    expect(result.inputProps.captionStyle).toBe('tiktok')
  })

  it('leaves captionStyle unset when not given, for Storyboard.tsx to default by aspect ratio', async () => {
    const tool = createComposeRenderTool()

    const result = await runCompose(tool, {
      shots: [
        {
          kind: 'photo',
          src: 'https://example.com/a.jpg',
          start: 0,
          duration: 4
        }
      ]
    })

    expect(result.inputProps.captionStyle).toBeUndefined()
  })

  it('stores music provenance beside a curated catalogue track', async () => {
    const tool = createComposeRenderTool()

    const result = await runCompose(tool, {
      music: '/audio/music/dark-documentary.mp3',
      musicCredit: {
        title: 'Dark Documentary',
        creator: 'Example Artist',
        source: 'pixabay',
        sourceUrl:
          'https://pixabay.com/music/main-title-dark-documentary-12345/',
        license: 'Pixabay Content License',
        licenseUrl: 'https://pixabay.com/service/license-summary/',
        contentIdRegistered: false
      },
      shots: [
        {
          kind: 'photo',
          src: 'https://example.com/a.jpg',
          start: 0,
          duration: 4
        }
      ]
    })

    expect(result.inputProps.musicCredit).toMatchObject({
      creator: 'Example Artist',
      source: 'pixabay',
      contentIdRegistered: false
    })
  })

  it('stores transitions and multi-layer audio in the canonical storyboard', async () => {
    const tool = createComposeRenderTool()

    const result = await runCompose(tool, {
      transitionSfxVolume: 0.3,
      audioCues: [
        {
          id: 'whoosh-1',
          kind: 'sfx',
          src: '/audio/sfx/whoosh.mp3',
          start: 2.8,
          duration: 0.8,
          volume: 0.5,
          fadeOut: 0.15
        }
      ],
      shots: [
        {
          kind: 'photo',
          src: 'https://example.com/a.jpg',
          start: 0,
          duration: 3,
          transitionOut: { type: 'zoom-blur', duration: 0.3 }
        },
        {
          kind: 'photo',
          src: 'https://example.com/b.jpg',
          start: 3,
          duration: 3
        }
      ]
    })

    expect(result.inputProps.shots[0].transitionOut).toEqual({
      type: 'zoom-blur',
      duration: 0.3
    })
    expect(result.inputProps.transitionSfxVolume).toBe(0.3)
    expect(result.inputProps.audioCues?.[0]).toMatchObject({
      id: 'whoosh-1',
      kind: 'sfx',
      start: 2.8,
      fadeOut: 0.15
    })
  })

  it('preserves every documentary field while composing stored beats', async () => {
    const now = '2026-08-14T00:00:00.000Z'
    const rights = {
      provider: 'nara' as const,
      sourceUrl: 'https://catalog.archives.gov/id/123',
      institution: 'U.S. National Archives',
      license: 'public-domain' as const,
      attribution: 'Battle of Midway footage — NARA',
      reusable: true,
      reviewRequired: false,
      accessedAt: now
    }
    kvStore.set('beats:beats-1', {
      ...makeStoredStoryboard(),
      documentaryId: 'doc-1',
      shots: [
        {
          id: 'beat-1',
          kind: 'photo',
          narration: 'By June 1942, the carrier forces approached Midway.',
          visualQuery: 'Midway carrier forces June 1942',
          visualIntent: 'Show opposing carrier movements.',
          start: 0,
          duration: 5,
          words: [],
          comparisonCards: [],
          overlay: { type: 'film-burn' },
          transitionOut: { type: 'film-burn', duration: 0.3 },
          documentary: {
            beatType: 'battle-map',
            chapterId: 'chapter-1',
            claimIds: ['claim-1'],
            entityIds: ['unit-1'],
            locationIds: ['midway'],
            dateLabel: 'June 1942',
            assetId: 'asset-1',
            graphic: {
              type: 'battle-map',
              theatre: 'Pacific',
              units: [],
              routes: [],
              frontLines: [],
              objectives: [],
              annotations: [],
              backgroundId: 'bg4'
            },
            reconstruction: false
          }
        }
      ]
    })
    kvStore.set('documentary:doc-1', {
      id: 'doc-1',
      profile: {
        niche: 'ww1_ww2',
        format: 'documentary',
        presetVersion: 1
      },
      inputMode: 'script',
      topic: 'Battle of Midway',
      targetMinutes: 1,
      language: 'English',
      brief: {
        whatTheVideoIsAbout: 'Battle of Midway',
        styleOfTalking: 'Grounded documentary',
        whoThisVideoIsFor: 'Military history viewers',
        keyFacts: [],
        inferredFields: []
      },
      narration: 'By June 1942, the carrier forces approached Midway.',
      chapters: [
        {
          id: 'chapter-1',
          title: 'The Trap',
          act: 'cold-open',
          startNarrationOffset: 0,
          endNarrationOffset: 55,
          dateRange: 'June 1942',
          locationIds: ['midway'],
          claimIds: ['claim-1'],
          entityIds: ['unit-1'],
          emotionalObjective: 'Establish the trap.',
          retentionHook: 'Reveal the imbalance.'
        }
      ],
      dossier: {
        thesis: 'Intelligence changed the battle.',
        chronology: [],
        claims: [
          {
            id: 'claim-1',
            text: 'The carrier forces approached Midway in June 1942.',
            importance: 'critical',
            verification: 'verified',
            citationIds: ['citation-1']
          }
        ],
        citations: [
          {
            id: 'citation-1',
            title: 'Battle of Midway',
            url: 'https://www.history.navy.mil/midway',
            authorOrInstitution: 'Naval History and Heritage Command',
            accessedAt: now,
            sourceClass: 'institutional',
            supportingNote: 'Documents the engagement.',
            reliability: 'high'
          }
        ],
        people: [],
        militaryUnits: [
          {
            id: 'unit-1',
            name: 'Carrier forces',
            kind: 'military-unit',
            allegiance: 'other',
            claimIds: ['claim-1']
          }
        ],
        equipment: [],
        locations: [
          {
            id: 'midway',
            name: 'Midway',
            theatre: 'Pacific',
            claimIds: ['claim-1']
          }
        ],
        quotations: []
      },
      beats: [
        {
          id: 'beat-1',
          chapterId: 'chapter-1',
          type: 'battle-map',
          narration: 'By June 1942, the carrier forces approached Midway.',
          start: 0,
          duration: 5,
          words: [],
          claimIds: ['claim-1'],
          entityIds: ['unit-1'],
          locationIds: ['midway'],
          dateLabel: 'June 1942',
          visualQuery: 'Midway carrier forces June 1942',
          visualIntent: 'Show carrier forces approaching Midway.',
          assetId: 'asset-1',
          graphic: {
            type: 'battle-map',
            theatre: 'Pacific',
            units: [],
            routes: [],
            frontLines: [],
            objectives: [],
            annotations: [],
            backgroundId: 'bg4'
          }
        }
      ],
      assets: [
        {
          id: 'asset-1',
          beatId: 'beat-1',
          kind: 'photo',
          src: 'https://catalog.archives.gov/midway.jpg',
          title: 'Midway carrier forces 1942',
          visualIntent: 'Show carrier forces approaching Midway.',
          claimIds: ['claim-1'],
          rights,
          usedInFinalRender: true
        }
      ],
      qa: { publishReady: true, issues: [] },
      createdAt: now,
      updatedAt: now
    })
    const tool = createComposeRenderTool()

    const result = await runCompose(tool, {
      beatsId: 'beats-1',
      documentaryId: 'doc-1',
      shots: [
        {
          src: 'https://catalog.archives.gov/midway.jpg',
          documentary: {
            beatType: 'archival-photo',
            chapterId: 'chapter-1',
            claimIds: ['claim-1'],
            entityIds: ['unit-1'],
            locationIds: ['midway'],
            reconstruction: false
          }
        }
      ],
      audioCues: [
        {
          id: 'radio-1',
          kind: 'ambient',
          src: '/audio/ambience/radio-room.mp3',
          start: 0,
          duration: 5,
          volume: 0.1
        }
      ]
    })

    expect(result.inputProps.shots[0]).toMatchObject({
      id: 'beat-1',
      comparisonCards: [],
      overlay: { type: 'film-burn' },
      mediaOrigin: 'archival',
      mediaFit: 'contain',
      documentary: {
        beatType: 'archival-photo',
        chapterId: 'chapter-1',
        claimIds: ['claim-1'],
        dateLabel: 'June 1942',
        graphic: { type: 'battle-map' },
        rights: {
          provider: 'nara',
          license: 'public-domain',
          sourceUrl: 'https://catalog.archives.gov/id/123'
        }
      },
      transitionOut: { type: 'film-burn', duration: 0.3 }
    })
    expect(result.inputProps.documentaryProject).toMatchObject({
      id: 'doc-1',
      chapters: expect.any(Array),
      citations: expect.any(Array)
    })
    expect(result.inputProps.audioCues).toHaveLength(1)
  })
})
