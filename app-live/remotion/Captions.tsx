// Frame-timed caption treatments selected by StoryboardInput.captionStyle. All timing
// derives from Remotion's current frame so Studio playback and final renders agree.
import React from 'react'

import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'

import type { CaptionStyle, CaptionWord, Shot } from './schema'

const YELLOW = '#ffe600'
const FONT_STACK =
  '"DejaVu Sans", system-ui, -apple-system, Segoe UI, Roboto, sans-serif'

const OUTLINE_TEXT_SHADOW = (width: number) =>
  [
    `-${width}px -${width}px 0 #000`,
    `${width}px -${width}px 0 #000`,
    `-${width}px ${width}px 0 #000`,
    `${width}px ${width}px 0 #000`,
    '0 4px 10px rgba(0,0,0,0.6)'
  ].join(', ')

type PublicCaptionStyle = Exclude<CaptionStyle, 'normal'>

interface TimedWord extends CaptionWord {
  index: number
  startFrame: number
  endFrame: number
}

interface CaptionRenderProps {
  accent: string
  activeIndex: number | null
  anchorIndex: number | null
  fps: number
  frame: number
  height: number
  width: number
  words: TimedWord[]
}

function secondsToFrame(seconds: number, fps: number) {
  return Math.round(seconds * fps)
}

function activeShot(shots: Shot[], frame: number, fps: number) {
  return (
    shots.find(shot => {
      const startFrame = secondsToFrame(shot.start, fps)
      const endFrame = secondsToFrame(shot.start + shot.duration, fps)
      return frame >= startFrame && frame < endFrame
    }) ??
    shots.find(shot =>
      shot.words?.some(word => frame < secondsToFrame(word.end, fps))
    )
  )
}

function prepareTimedWords(words: CaptionWord[], fps: number): TimedWord[] {
  return words.map((word, index) => {
    const startFrame = secondsToFrame(word.start, fps)
    return {
      ...word,
      index,
      startFrame,
      endFrame: Math.max(startFrame + 1, secondsToFrame(word.end, fps))
    }
  })
}

function resolveActiveWord(words: TimedWord[], frame: number) {
  const active = words.findIndex(
    word => frame >= word.startFrame && frame < word.endFrame
  )
  return active === -1 ? null : active
}

function resolveStartedWord(words: TimedWord[], frame: number) {
  for (let index = words.length - 1; index >= 0; index -= 1) {
    if (frame >= words[index].startFrame) return index
  }
  return null
}

/** Split timed words on long pauses, sentence endings, or a treatment's line limit. */
function groupTimedWords(
  words: TimedWord[],
  maxWords: number,
  maxPauseFrames: number
) {
  return words.reduce<TimedWord[][]>((groups, word) => {
    const current = groups.at(-1)
    const previous = current?.at(-1)
    const startsNewGroup =
      !current ||
      current.length >= maxWords ||
      (previous !== undefined &&
        (word.startFrame - previous.endFrame > maxPauseFrames ||
          /[.!?]["')\]]?$/.test(previous.word)))

    if (startsNewGroup) groups.push([word])
    else current.push(word)
    return groups
  }, [])
}

function activeWordGroup(
  words: TimedWord[],
  activeIndex: number,
  maxWords: number,
  fps: number
) {
  const groups = groupTimedWords(words, maxWords, Math.round(fps * 0.65))
  return (
    groups.find(group => group.some(word => word.index === activeIndex)) ??
    groups[0] ??
    []
  )
}

/** Shared title-safe inset used by every caption treatment. */
function safeArea(width: number, height: number, bottomRatio = 0.06) {
  return {
    left: Math.round(width * 0.06),
    right: Math.round(width * 0.06),
    bottom: Math.round(height * bottomRatio)
  } as const
}

function wordState(word: TimedWord, activeIndex: number | null, frame: number) {
  if (word.index === activeIndex) return 'active'
  return frame >= word.endFrame ? 'spoken' : 'upcoming'
}

function popFontMultiplier(frame: number, wordStartFrame: number, fps: number) {
  const popFrames = Math.max(2, Math.round(fps * 0.12))
  return interpolate(
    frame,
    [wordStartFrame - 1, wordStartFrame, wordStartFrame + popFrames],
    [1, 1.22, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )
}

const DocumentaryCaptions: React.FC<CaptionRenderProps> = ({
  anchorIndex,
  fps,
  height,
  width,
  words
}) => {
  if (anchorIndex === null) return null
  const phrase = activeWordGroup(words, anchorIndex, 7, fps)
  const fontSize = Math.round(height * 0.048)
  const strokeWidth = Math.max(2, Math.round(fontSize * 0.07))

  return (
    <div
      data-caption-style="documentary"
      data-safe-area="title"
      style={{
        position: 'absolute',
        ...safeArea(width, height, 0.075),
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: FONT_STACK,
        textAlign: 'center'
      }}
    >
      <div
        style={{
          maxWidth: '88%',
          color: YELLOW,
          fontSize,
          fontWeight: 850,
          lineHeight: 1.25,
          letterSpacing: '0.01em',
          textAlign: 'center',
          textShadow: OUTLINE_TEXT_SHADOW(strokeWidth)
        }}
      >
        {phrase.map(word => word.word).join(' ')}
      </div>
    </div>
  )
}

const KaraokeCaptions: React.FC<CaptionRenderProps> = ({
  accent,
  activeIndex,
  anchorIndex,
  fps,
  frame,
  height,
  width,
  words
}) => {
  if (anchorIndex === null) return null
  const phrase = activeWordGroup(words, anchorIndex, 8, fps)
  const fontSize = Math.round(height * 0.05)
  const strokeWidth = Math.max(2, Math.round(fontSize * 0.07))

  return (
    <div
      data-caption-style="karaoke"
      data-safe-area="title"
      style={{
        position: 'absolute',
        ...safeArea(width, height, 0.085),
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '0 0.28em',
        fontFamily: FONT_STACK,
        fontSize,
        fontWeight: 850,
        lineHeight: 1.2,
        textAlign: 'center'
      }}
    >
      {phrase.map(word => {
        const state = wordState(word, activeIndex, frame)
        return (
          <span
            key={word.index}
            data-word-state={state}
            style={{
              color:
                state === 'active'
                  ? YELLOW
                  : state === 'spoken'
                    ? '#ffffff'
                    : 'rgba(255,255,255,0.6)',
              display: 'inline-block',
              textShadow: OUTLINE_TEXT_SHADOW(strokeWidth)
            }}
          >
            {word.word}
          </span>
        )
      })}
    </div>
  )
}

const MinimalCaptions: React.FC<CaptionRenderProps> = ({
  anchorIndex,
  fps,
  height,
  width,
  words
}) => {
  if (anchorIndex === null) return null
  const phrase = activeWordGroup(words, anchorIndex, 9, fps)

  return (
    <div
      data-caption-style="minimal"
      data-safe-area="title"
      style={{
        position: 'absolute',
        ...safeArea(width, height, 0.045),
        color: '#ffffff',
        fontFamily: FONT_STACK,
        fontSize: Math.round(height * 0.032),
        fontWeight: 500,
        letterSpacing: '0.01em',
        lineHeight: 1.35,
        textAlign: 'center',
        textShadow: '0 2px 8px rgba(0,0,0,0.95)'
      }}
    >
      {phrase.map(word => word.word).join(' ')}
    </div>
  )
}

const TiktokCaptions: React.FC<CaptionRenderProps> = ({
  activeIndex,
  anchorIndex,
  fps,
  frame,
  height,
  width,
  words
}) => {
  if (anchorIndex === null) return null
  const start = Math.max(0, Math.min(anchorIndex - 1, words.length - 5))
  const windowWords = words.slice(start, start + 5)
  const fontSize = Math.round(Math.min(width, height) * 0.09)
  const inset = safeArea(width, height)

  return (
    <div
      data-caption-style="tiktok"
      data-safe-area="title"
      style={{
        position: 'absolute',
        left: inset.left,
        right: inset.right,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'baseline',
        gap: '0.15em 0.32em',
        fontFamily: FONT_STACK,
        fontSize,
        fontWeight: 900,
        lineHeight: 1.15,
        textAlign: 'center'
      }}
    >
      {windowWords.map(word => {
        const state = wordState(word, activeIndex, frame)
        const multiplier =
          state === 'active'
            ? popFontMultiplier(frame, word.startFrame, fps)
            : 1
        const wordFontSize = Math.round(fontSize * multiplier)

        return (
          <span
            key={word.index}
            data-word-state={state}
            style={{
              color: YELLOW,
              display: 'inline-block',
              fontSize: wordFontSize,
              opacity: state === 'active' ? 1 : 0.75,
              textShadow: OUTLINE_TEXT_SHADOW(
                Math.max(1, Math.round(wordFontSize * 0.06))
              )
            }}
          >
            {word.word}
          </span>
        )
      })}
    </div>
  )
}

const FullSentenceCaptions: React.FC<CaptionRenderProps> = ({
  fps,
  frame,
  height,
  width,
  words
}) => {
  const blocks = groupTimedWords(words, 12, Math.round(fps * 0.65))
  const block = blocks.find(group => {
    const first = group[0]
    const last = group.at(-1)
    return (
      first !== undefined &&
      last !== undefined &&
      frame >= first.startFrame &&
      frame < last.endFrame
    )
  })
  if (!block) return null
  const fontSize = Math.round(height * 0.048)
  const strokeWidth = Math.max(2, Math.round(fontSize * 0.07))

  return (
    <div
      data-caption-style="full-sentence"
      data-safe-area="title"
      style={{
        position: 'absolute',
        ...safeArea(width, height, 0.065),
        display: 'flex',
        justifyContent: 'center',
        fontFamily: FONT_STACK,
        textAlign: 'center'
      }}
    >
      <span
        style={{
          maxWidth: '88%',
          color: YELLOW,
          fontSize,
          fontWeight: 850,
          lineHeight: 1.25,
          letterSpacing: '0.01em',
          textAlign: 'center',
          textShadow: OUTLINE_TEXT_SHADOW(strokeWidth)
        }}
      >
        {block.map(word => word.word).join(' ')}
      </span>
    </div>
  )
}

const CAPTION_RENDERERS: Record<
  PublicCaptionStyle,
  React.FC<CaptionRenderProps>
> = {
  documentary: DocumentaryCaptions,
  karaoke: KaraokeCaptions,
  minimal: MinimalCaptions,
  tiktok: TiktokCaptions,
  'full-sentence': FullSentenceCaptions
}

export const Captions: React.FC<{
  shots: Shot[]
  accent: string
  captionStyle?: CaptionStyle
}> = ({ shots, accent, captionStyle = 'normal' }) => {
  const frame = useCurrentFrame()
  const { fps, height, width } = useVideoConfig()
  const shot = activeShot(shots, frame, fps)
  if (!shot?.words?.length) return null

  const words = prepareTimedWords(shot.words, fps)
  const activeIndex = resolveActiveWord(words, frame)
  const anchorIndex = resolveStartedWord(words, frame)
  const resolvedStyle: PublicCaptionStyle =
    captionStyle === 'normal' ? 'full-sentence' : captionStyle
  const Renderer = CAPTION_RENDERERS[resolvedStyle]

  return (
    <Renderer
      accent={accent}
      activeIndex={activeIndex}
      anchorIndex={anchorIndex}
      fps={fps}
      frame={frame}
      height={height}
      width={width}
      words={words}
    />
  )
}

export default Captions
