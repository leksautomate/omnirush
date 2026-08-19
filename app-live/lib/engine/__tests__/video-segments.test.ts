import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  isResolvedMp4Input,
  parseTimestampSeconds,
  parseVideoSegmentSelection,
  selectRelevantVideoSegment,
  validateMediaWindow
} from '../video-segments'

describe('parseTimestampSeconds', () => {
  it.each([
    [12.25, 12.25],
    ['12.25', 12.25],
    ['01:02.500', 62.5],
    ['1:02:03.250', 3723.25]
  ])('parses %j as source seconds', (value, seconds) => {
    expect(parseTimestampSeconds(value)).toBe(seconds)
  })

  it.each(['', '1:60', '1:2:60', 'not-a-time', Number.NaN])(
    'rejects malformed timestamp %j',
    value => {
      expect(() => parseTimestampSeconds(value)).toThrow('timestamp')
    }
  )
})

describe('validateMediaWindow', () => {
  it('clamps the selected window to the known source duration', () => {
    expect(
      validateMediaWindow({
        start: -1.25,
        end: 14,
        minimumDuration: 5,
        sourceDuration: 12
      })
    ).toEqual({ start: 0, end: 12 })
  })

  it('rejects a window that becomes too short after source-bound clamping', () => {
    expect(() =>
      validateMediaWindow({
        start: 8,
        end: 14,
        minimumDuration: 5,
        sourceDuration: 10
      })
    ).toThrow('at least 5')
  })

  it.each([
    { start: 4, end: 4, minimumDuration: 1, sourceDuration: 10 },
    { start: 4, end: 3, minimumDuration: 1, sourceDuration: 10 },
    { start: 0, end: 2, minimumDuration: 3, sourceDuration: 10 },
    { start: 0, end: 3, minimumDuration: 3, sourceDuration: 0 },
    { start: 0, end: 3, minimumDuration: 11, sourceDuration: 10 }
  ])('rejects an impossible source window %#', input => {
    expect(() => validateMediaWindow(input)).toThrow()
  })

  it('rejects an editor out point beyond the known source when clamping is disabled', () => {
    expect(() =>
      validateMediaWindow({
        start: 2,
        end: 12,
        minimumDuration: 4,
        sourceDuration: 10,
        clampToSource: false
      })
    ).toThrow('cannot exceed 10')
  })
})

describe('isResolvedMp4Input', () => {
  it.each([
    ['https://archive.org/download/reel/reel.mp4', undefined],
    ['https://cdn.example.com/REEL.MP4?download=1', undefined],
    ['https://cdn.example.com/play?id=12', 'video/mp4; charset=binary']
  ])('accepts resolved MP4 input %s', (url, mimeType) => {
    expect(isResolvedMp4Input(url, mimeType)).toBe(true)
  })

  it.each([
    ['https://cdn.example.com/reel.webm', undefined],
    ['https://cdn.example.com/reel.ogv', undefined],
    ['https://cdn.example.com/reel.mov', undefined],
    ['https://cdn.example.com/reel.mp4', 'video/webm'],
    ['https://example.com/watch?id=12', undefined]
  ])('rejects non-MP4 semantic-selection input %s', (url, mimeType) => {
    expect(isResolvedMp4Input(url, mimeType)).toBe(false)
  })
})

describe('parseVideoSegmentSelection', () => {
  it('parses structured JSON timestamps and retains the selection reason', () => {
    expect(
      parseVideoSegmentSelection(
        '{"start":"00:02.500","end":"00:08.750","reason":"The tank enters the frame."}',
        { minimumDuration: 6, sourceDuration: 20 }
      )
    ).toEqual({
      start: 2.5,
      end: 8.75,
      reason: 'The tank enters the frame.'
    })
  })

  it.each([
    'not json',
    '{}',
    '{"start":1,"end":8}',
    '{"start":"nope","end":8,"reason":"bad"}'
  ])('rejects malformed model output %j', output => {
    expect(() =>
      parseVideoSegmentSelection(output, {
        minimumDuration: 4,
        sourceDuration: 20
      })
    ).toThrow('ModelArk')
  })
})

describe('selectRelevantVideoSegment', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('sends narration, visual intent, duration bounds, and the resolved MP4 to ModelArk', async () => {
    vi.stubEnv('MODELARK_API_KEY', 'test-key')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '{"start":"00:03","end":"00:09.5","reason":"The strongest continuous action."}'
            }
          }
        ]
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await selectRelevantVideoSegment({
      narration: 'The advance began before dawn.',
      visualIntent: 'Show the tanks advancing through smoke.',
      minimumDuration: 6,
      sourceDuration: 18,
      videoUrl: 'https://media.example.com/play?id=reel',
      mimeType: 'video/mp4'
    })

    expect(result).toEqual({
      start: 3,
      end: 9.5,
      reason: 'The strongest continuous action.'
    })
    const request = fetchMock.mock.calls[0][1]
    const body = JSON.parse(String(request?.body))
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.messages[1].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'video_url',
          video_url: {
            url: 'https://media.example.com/play?id=reel'
          }
        }),
        expect.objectContaining({
          type: 'text',
          text: expect.stringContaining('minimum continuous window: 6 seconds')
        })
      ])
    )
  })

  it('rejects a too-short ModelArk candidate without making another request', async () => {
    vi.stubEnv('MODELARK_API_KEY', 'test-key')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"start":8,"end":11,"reason":"Brief action only."}'
            }
          }
        ]
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      selectRelevantVideoSegment({
        narration: 'Hold on the action.',
        visualIntent: 'Show one uninterrupted view.',
        minimumDuration: 5,
        sourceDuration: 20,
        videoUrl: 'https://archive.org/download/reel/reel.mp4'
      })
    ).rejects.toThrow('at least 5')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects non-MP4 input before making a ModelArk request', async () => {
    vi.stubEnv('MODELARK_API_KEY', 'test-key')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      selectRelevantVideoSegment({
        narration: 'Hold on the action.',
        visualIntent: 'Show one uninterrupted view.',
        minimumDuration: 5,
        sourceDuration: 20,
        videoUrl: 'https://archive.org/download/reel/reel.webm'
      })
    ).rejects.toThrow('resolved MP4')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
