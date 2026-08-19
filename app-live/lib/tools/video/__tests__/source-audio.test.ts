import { describe, expect, it } from 'vitest'

import { createSourceAudioTool } from '../source-audio'

async function runSourceAudio(input: unknown) {
  const tool = createSourceAudioTool()
  return (await tool.execute!(
    input as never,
    { toolCallId: 'audio-1', messages: [] } as never
  )) as any
}

describe('createSourceAudioTool', () => {
  it('returns a ready-to-mix ambient cue with Pixabay provenance', async () => {
    const result = await runSourceAudio({
      kind: 'ambient',
      prompt: 'industrial factory machinery ambience',
      start: 2,
      duration: 12,
      volume: 0.2,
      loop: true,
      fadeIn: 1,
      fadeOut: 1.5
    })

    expect(result.audioCue).toMatchObject({
      kind: 'ambient',
      src: '/audio/ambient/alex-jauk-industrial-ambience-223058.mp3',
      start: 2,
      duration: 12,
      volume: 0.2,
      loop: true,
      fadeIn: 1,
      fadeOut: 1.5
    })
    expect(result.audioCue.credit).toMatchObject({
      source: 'pixabay',
      creator: 'Alex_Jauk',
      contentIdRegistered: false
    })
  })

  it('selects a transition effect as an SFX cue', async () => {
    const result = await runSourceAudio({
      kind: 'sfx',
      prompt: 'fast whoosh transition',
      start: 4.5
    })

    expect(result.audioCue).toMatchObject({
      kind: 'sfx',
      src: '/audio/sfx/dragon-studio-whoosh-effect-382717.mp3',
      start: 4.5,
      loop: false
    })
  })
})
