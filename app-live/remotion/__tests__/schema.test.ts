import { describe, expect, it } from 'vitest'

import {
  recalculateShotTimings,
  type Shot,
  storyboardInputSchema,
  totalSeconds
} from '../schema'

describe('Remotion Schema & Timing Helpers', () => {
  it('recalculates shot start times linearly based on durations', () => {
    const shots: Shot[] = [
      { kind: 'photo', duration: 3.5, start: 0, narration: 'First shot' },
      { kind: 'video', duration: 2.0, start: 0, narration: 'Second shot' },
      { kind: 'photo', duration: 4.2, start: 0, narration: 'Third shot' }
    ]

    const result = recalculateShotTimings(shots)
    expect(result[0].start).toBe(0)
    expect(result[0].duration).toBe(3.5)

    expect(result[1].start).toBe(3.5)
    expect(result[1].duration).toBe(2.0)

    expect(result[2].start).toBe(5.5)
    expect(result[2].duration).toBe(4.2)
  })

  it('skips hidden shots when computing active start times and totalSeconds', () => {
    const shots: Shot[] = [
      { kind: 'photo', duration: 3.0, start: 0 },
      { kind: 'video', duration: 4.0, start: 0, hidden: true },
      { kind: 'photo', duration: 2.0, start: 0 }
    ]

    const result = recalculateShotTimings(shots)
    expect(result[0].start).toBe(0)
    expect(result[1].hidden).toBe(true)
    // Third shot should follow shot 1 directly (start = 3.0 instead of 7.0)
    expect(result[2].start).toBe(3.0)
    expect(totalSeconds({ shots: result })).toBe(5.0)
  })

  it('clamps minimum shot duration to 0.2s', () => {
    const shots: Shot[] = [
      { kind: 'photo', duration: 0.05, start: 0 },
      { kind: 'video', duration: 1.0, start: 0 }
    ]

    const result = recalculateShotTimings(shots)
    expect(result[0].duration).toBe(0.2)
    expect(result[1].start).toBe(0.2)
  })

  it('calculates totalSeconds correctly', () => {
    const shots: Shot[] = [
      { kind: 'photo', duration: 3.0, start: 0 },
      { kind: 'video', duration: 2.5, start: 3.0 }
    ]

    expect(totalSeconds({ shots })).toBe(5.5)
  })

  it('parses storyboard input with voiceVolume, musicVolume, showCaptions, showSubscribeCta, and videoVolume', () => {
    const parsed = storyboardInputSchema.parse({
      width: 720,
      height: 1280,
      captionStyle: 'tiktok',
      showCaptions: true,
      showSubscribeCta: true,
      voice: 'https://example.com/voice.mp3',
      voiceVolume: 0.8,
      music: 'https://example.com/music.mp3',
      musicVolume: 0.25,
      shots: [
        { kind: 'photo', duration: 3.0, start: 0 },
        {
          kind: 'video',
          duration: 2.0,
          start: 3.0,
          videoVolume: 0.5,
          hidden: false
        }
      ]
    })

    expect(parsed.voiceVolume).toBe(0.8)
    expect(parsed.musicVolume).toBe(0.25)
    expect(parsed.showCaptions).toBe(true)
    expect(parsed.showSubscribeCta).toBe(true)
    expect(parsed.shots[1].videoVolume).toBe(0.5)
    expect(parsed.captionStyle).toBe('tiktok')
    expect(parsed.width).toBe(720)
    expect(parsed.height).toBe(1280)
  })

  it.each([
    'documentary',
    'karaoke',
    'minimal',
    'tiktok',
    'full-sentence'
  ] as const)('accepts the %s caption style', captionStyle => {
    const parsed = storyboardInputSchema.parse({
      captionStyle,
      shots: [{ kind: 'photo', duration: 3, start: 0 }]
    })

    expect(parsed.captionStyle).toBe(captionStyle)
  })

  it('preserves normal as a legacy caption style', () => {
    const parsed = storyboardInputSchema.parse({
      captionStyle: 'normal',
      shots: [{ kind: 'photo', duration: 3, start: 0 }]
    })

    expect(parsed.captionStyle).toBe('normal')
  })

  it('preserves optional source-media playback settings on a shot', () => {
    const parsed = storyboardInputSchema.parse({
      shots: [
        {
          kind: 'video',
          duration: 3,
          start: 0,
          mediaFit: 'cover',
          mediaOrigin: 'generated',
          mediaStart: 1.5,
          mediaEnd: 4.5,
          mediaMuted: true
        }
      ]
    })

    expect(parsed.shots[0]).toMatchObject({
      mediaFit: 'cover',
      mediaOrigin: 'generated',
      mediaStart: 1.5,
      mediaEnd: 4.5,
      mediaMuted: true
    })
  })

  it.each([
    { mediaStart: 4, mediaEnd: 4 },
    { mediaStart: 4, mediaEnd: 3 }
  ])(
    'rejects a source-media window with end at or before its start',
    window => {
      const result = storyboardInputSchema.safeParse({
        shots: [{ kind: 'video', duration: 3, start: 0, ...window }]
      })

      expect(result.success).toBe(false)
    }
  )

  it.each([0, 0.4, 1])(
    'accepts a film grain intensity within its 0..1 contract',
    filmGrainIntensity => {
      const parsed = storyboardInputSchema.parse({
        filmGrainIntensity,
        shots: [{ kind: 'photo', duration: 3, start: 0 }]
      })

      expect(parsed.filmGrainIntensity).toBe(filmGrainIntensity)
    }
  )

  it.each([-0.01, 1.01])(
    'rejects film grain intensity outside its 0..1 contract',
    filmGrainIntensity => {
      const result = storyboardInputSchema.safeParse({
        filmGrainIntensity,
        shots: [{ kind: 'photo', duration: 3, start: 0 }]
      })

      expect(result.success).toBe(false)
    }
  )

  it('preserves the selected music provenance with the storyboard', () => {
    const parsed = storyboardInputSchema.parse({
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
      shots: [{ kind: 'photo', duration: 3, start: 0 }]
    })

    expect(parsed.musicCredit?.creator).toBe('Example Artist')
    expect(parsed.musicCredit?.sourceUrl).toContain('pixabay.com/music/')
  })

  it('preserves per-cut transitions and layered audio cues', () => {
    const parsed = storyboardInputSchema.parse({
      transitionSfxVolume: 0.4,
      audioCues: [
        {
          id: 'factory-room-tone',
          kind: 'ambient',
          src: '/audio/ambient/factory-room-tone.mp3',
          start: 1.5,
          duration: 8,
          volume: 0.22,
          loop: true,
          fadeIn: 0.5,
          fadeOut: 1,
          credit: {
            title: 'Factory Room Tone',
            creator: 'Example Artist',
            source: 'pixabay',
            sourceUrl:
              'https://pixabay.com/sound-effects/factory-room-tone-12345/',
            license: 'Pixabay Content License',
            licenseUrl: 'https://pixabay.com/service/license-summary/',
            contentIdRegistered: false
          }
        }
      ],
      shots: [
        {
          kind: 'photo',
          duration: 3,
          start: 0,
          transitionOut: { type: 'whip-pan', duration: 0.35 }
        },
        { kind: 'photo', duration: 3, start: 3 }
      ]
    })

    expect(parsed.shots[0].transitionOut).toEqual({
      type: 'whip-pan',
      duration: 0.35
    })
    expect(parsed.transitionSfxVolume).toBe(0.4)
    expect(parsed.audioCues?.[0]).toMatchObject({
      kind: 'ambient',
      start: 1.5,
      loop: true,
      fadeOut: 1
    })
  })

  it('accepts a sourced quote-card overlay without dropping the shot', () => {
    const parsed = storyboardInputSchema.parse({
      shots: [
        {
          id: 'shot-9',
          kind: 'photo',
          start: 0,
          duration: 8,
          narration: 'Front-line pilots described the threat.',
          overlay: {
            type: 'quote-card',
            quote: 'The most dangerous threat on the Eastern Front',
            speaker: 'Luftwaffe front-line pilots',
            role: 'German fighter units',
            date: 'Summer 1943'
          }
        }
      ]
    })

    expect(parsed.shots).toHaveLength(1)
    expect(parsed.shots[0].overlay).toMatchObject({
      type: 'quote-card',
      speaker: 'Luftwaffe front-line pilots'
    })
  })

  it('rejects audio cues with invalid timing or volume', () => {
    const result = storyboardInputSchema.safeParse({
      audioCues: [
        {
          id: 'bad-cue',
          kind: 'sfx',
          src: '/audio/sfx/impact.mp3',
          start: -1,
          volume: 3
        }
      ],
      shots: [{ kind: 'photo', duration: 3, start: 0 }]
    })

    expect(result.success).toBe(false)
  })
})
