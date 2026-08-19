// Storyboard composition — the React port of lib/engine/render.ts (the former ffmpeg
// pipeline). Same behavior, now WYSIWYG in the browser (Player preview) and on Lambda:
//   • Ken Burns push/pull on stills (alternating zoom-in / zoom-out per shot)
//   • real clips scaled to cover
//   • drift-free crossfades — each shot owns [start, start+duration+FADE) and fades in
//     over FADE while the previous shot's tail plays underneath, so the merged timeline
//     is exactly Σ durations and stays locked to the voiceover
//   • word-timed karaoke captions
//   • a ducked voiceover + music mix (music loops and fades out at the end)
//   • missing/absent assets fall back to a clean solid-accent brand card (no text)
import React from 'react'

import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig
} from 'remotion'

import { ArchivalPhotoTreatment } from './documentary/ArchivalPhotoTreatment'
import { DocumentaryGraphic } from './documentary/DocumentaryGraphic'
import { DocumentaryGraphicBoundary } from './documentary/DocumentaryGraphicBoundary'
import { EvidenceCard } from './documentary/EvidenceCard'
import { AnimatedMap } from './overlays/AnimatedMap'
import { CameraShake } from './overlays/CameraShake'
import { CircularProgress } from './overlays/CircularProgress'
import { FilmBurn } from './overlays/FilmBurn'
import { GlitchText } from './overlays/GlitchText'
import { NewspaperHeadline } from './overlays/NewspaperHeadline'
import { NumberCounter } from './overlays/NumberCounter'
import { RealSatelliteMap } from './overlays/RealSatelliteMap'
import { TypewriterSubtitle } from './overlays/TypewriterSubtitle'
import { VerticalBarChart } from './overlays/VerticalBarChart'
import { audioCueVolumeAtTime, transitionPresentation } from './audio-mix'
import { Captions } from './Captions'
import { ComparisonGrid } from './ComparisonGrid'
import { mediaFitForShot, MediaFrame } from './MediaFrame'
import {
  type AudioCue,
  FADE_SECONDS,
  type Shot,
  type StoryboardInput,
  totalSeconds,
  type TransitionType
} from './schema'
import { SoundEffect } from './sfx'
import { SubscribeCta } from './SubscribeCta'

// Formats a resolved [lon, lat] pair as the "51.5074° N, 0.1278° W" HUD readout.
// (Kept local rather than imported from lib/engine — remotion/ never crosses the
// '@/lib' alias, since the Remotion Lambda bundler doesn't reliably resolve it.)
function formatCoordsText([lon, lat]: [number, number]): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lonDir = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`
}

const resolveMediaSrc = (src: string) =>
  src.startsWith('/') ? staticFile(src.slice(1)) : src

function isImageSrc(src: string): boolean {
  if (!src) return false
  if (src.startsWith('data:image/')) return true
  const cleanUrl = src.split('?')[0].split('#')[0].toLowerCase()
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(cleanUrl)
}

// A single shot layer: Ken Burns still, cover-fit clip, comparison grid, or a clean accent card.
const ShotLayer: React.FC<{
  shot: Shot
  index: number
  fadeInFrames: number
  transitionType: TransitionType
  accent: string
}> = ({ shot, index, fadeInFrames, transitionType, accent }) => {
  const frame = useCurrentFrame()
  const { durationInFrames, fps } = useVideoConfig()

  // Crossfade: fade in over the first `fadeInFrames` (0 for the first shot, whose layer
  // sits at the bottom of the stack).
  const progress =
    fadeInFrames > 0
      ? interpolate(frame, [0, fadeInFrames], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp'
        })
      : 1
  const presentation = transitionPresentation(transitionType, progress)
  const mediaFit = mediaFitForShot(shot)

  const isVideo =
    !!shot.src &&
    (shot.kind === 'video' ||
      shot.kind === 'avatar' ||
      shot.kind === 'a-roll' ||
      shot.src.endsWith('.mp4') ||
      shot.src.startsWith('data:video/')) &&
    !isImageSrc(shot.src)

  let inner: React.ReactNode
  if (shot.kind === 'comparison' && shot.comparisonCards?.length) {
    inner = <ComparisonGrid cards={shot.comparisonCards} accent={accent} />
  } else if (!shot.src) {
    // Clean fallback card — a solid accent frame, no text (the "no card clutter" rule).
    inner = <AbsoluteFill style={{ backgroundColor: accent }} />
  } else if (isVideo) {
    const videoVolume = shot.videoVolume ?? 0
    const mediaMuted =
      shot.mediaMuted ??
      (shot.mediaOrigin === 'researched' || videoVolume === 0)
    const videoProps =
      shot.mediaStart !== undefined || shot.mediaEnd !== undefined
        ? {
            trimBefore:
              shot.mediaStart === undefined
                ? undefined
                : Math.round(shot.mediaStart * fps),
            trimAfter:
              shot.mediaEnd === undefined
                ? undefined
                : Math.round(shot.mediaEnd * fps)
          }
        : undefined
    inner = (
      <MediaFrame
        src={resolveMediaSrc(shot.src)}
        mediaType="video"
        fit={mediaFit}
        muted={mediaMuted}
        volume={videoVolume}
        videoProps={videoProps}
      />
    )
  } else {
    // Ken Burns: alternate a slow push-in and pull-out, 1.00 ↔ 1.09, matching the engine.
    const zoomIn = index % 2 === 0
    const scale = interpolate(
      frame,
      [0, durationInFrames],
      zoomIn ? [1, 1.09] : [1.09, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    )
    inner =
      shot.documentary?.beatType === 'archival-photo' ? (
        <ArchivalPhotoTreatment
          src={resolveMediaSrc(shot.src)}
          mediaFit={mediaFit}
          filmTreatment={shot.documentary.filmTreatmentBackgroundId === 'bg3'}
        />
      ) : (
        <MediaFrame
          src={resolveMediaSrc(shot.src)}
          fit={mediaFit}
          foregroundStyle={
            mediaFit === 'cover'
              ? {
                  transform: `scale(${scale})`,
                  transformOrigin: 'center center'
                }
              : undefined
          }
        />
      )
  }

  const documentaryNode = shot.documentary?.graphic ? (
    <DocumentaryGraphicBoundary
      beatId={shot.id ?? `${shot.documentary.chapterId}-${index}`}
      fallback={null}
    >
      <DocumentaryGraphic
        graphic={shot.documentary.graphic}
        durationInFrames={Math.max(1, Math.round(shot.duration * fps))}
      />
    </DocumentaryGraphicBoundary>
  ) : null

  // Visual Overlay layers
  const overlay = shot.overlay
  let overlayNode: React.ReactNode = null
  if (overlay && overlay.type !== 'none') {
    if (overlay.type === 'film-burn') {
      overlayNode = <FilmBurn durationFrames={durationInFrames} />
    } else if (overlay.type === 'number-counter') {
      overlayNode = (
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 30
          }}
        >
          <NumberCounter
            targetValue={overlay.numberValue ?? 100}
            label={overlay.numberLabel}
            prefix={overlay.numberPrefix}
            suffix={overlay.numberSuffix}
            accent={accent}
            durationFrames={Math.min(60, durationInFrames)}
          />
        </AbsoluteFill>
      )
    } else if (overlay.type === 'circular-progress') {
      overlayNode = (
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 30
          }}
        >
          <CircularProgress
            targetPercentage={overlay.numberValue ?? 80}
            label={overlay.numberLabel}
            accent={accent}
            durationFrames={Math.min(60, durationInFrames)}
          />
        </AbsoluteFill>
      )
    } else if (overlay.type === 'typewriter') {
      overlayNode = (
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 30
          }}
        >
          <TypewriterSubtitle
            text={overlay.text || shot.narration || ''}
            durationFrames={Math.min(50, durationInFrames)}
          />
        </AbsoluteFill>
      )
    } else if (overlay.type === 'glitch') {
      overlayNode = (
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 30
          }}
        >
          <GlitchText text={overlay.text || 'CONFIDENTIAL'} />
        </AbsoluteFill>
      )
    } else if (overlay.type === 'newspaper') {
      overlayNode = (
        <NewspaperHeadline
          publication={overlay.publication}
          issueDate={overlay.issueDate}
          category={overlay.category}
          headline={overlay.headline || shot.narration}
          highlightWords={overlay.highlightWords}
          summary={overlay.summary}
          byline={overlay.byline}
        />
      )
    } else if (overlay.type === 'bar-chart') {
      overlayNode = (
        <VerticalBarChart
          title={overlay.text || 'Historical Comparison Statistics'}
          bars={overlay.bars}
          accent={accent}
        />
      )
    } else if (overlay.type === 'animated-map') {
      overlayNode = (
        <RealSatelliteMap
          title={overlay.mapTitle || overlay.text || undefined}
          fromCity={overlay.fromLabel || undefined}
          // Omit entirely (not a fallback string) when unset, so the component falls
          // back to a single-location zoom-in instead of a fake two-point flight.
          toCity={overlay.toLabel?.trim() || undefined}
          fromCoordsText={
            overlay.fromCoords
              ? formatCoordsText(overlay.fromCoords)
              : undefined
          }
          toCoordsText={
            overlay.toCoords ? formatCoordsText(overlay.toCoords) : undefined
          }
          satelliteImageUrl={overlay.mapImageUrl}
          accent={accent}
        />
      )
    } else if (overlay.type === 'quote-card') {
      overlayNode = (
        <EvidenceCard
          graphic={{
            type: 'quote-card',
            quote: overlay.quote || overlay.text || shot.narration || '',
            speaker: overlay.speaker || 'Historical source',
            role: overlay.role,
            institution: overlay.institution,
            date: overlay.date,
            citationId: shot.id || 'quote-overlay',
            sourceUrl: 'https://kakkao.local/quote-overlay',
            backgroundId: 'bg1'
          }}
        />
      )
    }
  }

  const content = (
    <AbsoluteFill
      style={{
        opacity: presentation.opacity,
        transform: `translateX(${presentation.translateX}%) scale(${presentation.scale})`,
        filter:
          presentation.blur > 0 ? `blur(${presentation.blur}px)` : undefined
      }}
    >
      {inner}
      {overlayNode}
      {documentaryNode}
      {presentation.burnOpacity > 0 ? (
        <AbsoluteFill
          style={{
            opacity: presentation.burnOpacity,
            mixBlendMode: 'screen',
            background:
              'radial-gradient(circle at 35% 50%, #fff7b2 0%, #ff7a00 22%, #ff2300 48%, transparent 72%)',
            pointerEvents: 'none'
          }}
        />
      ) : null}
    </AbsoluteFill>
  )

  if (overlay?.type === 'camera-shake') {
    return <CameraShake intensity={12}>{content}</CameraShake>
  }

  return content
}

export const Storyboard: React.FC<StoryboardInput> = props => {
  const { fps, height } = useVideoConfig()
  // Only render active (non-hidden) shots
  const activeShots = props.shots.filter(s => !s.hidden)
  const accent = props.brand?.accent || '#ff2d55'
  const total = totalSeconds(props)
  // Explicit choice wins; otherwise default by aspect ratio — vertical frames (Shorts/
  // Reels/TikTok proportions) get the tiktok-style rolling window, everything else gets
  // the full-sentence layout.
  const captionStyle =
    props.captionStyle ?? (props.height > props.width ? 'tiktok' : 'normal')

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      {/* Shot stack — later shots paint over earlier ones so the fade-in reads as a
          crossfade against the outgoing shot's tail. */}
      {activeShots.map((shot, i) => {
        const isLast = i === activeShots.length - 1
        const from = Math.round(shot.start * fps)
        const transitionOut = shot.transitionOut ?? {
          type: 'crossfade' as const,
          duration: FADE_SECONDS
        }
        const outgoingTransitionSeconds =
          transitionOut.type === 'cut' ? 0 : transitionOut.duration
        const incomingTransition =
          i === 0
            ? { type: 'cut' as const, duration: 0 }
            : (activeShots[i - 1].transitionOut ?? {
                type: 'crossfade' as const,
                duration: FADE_SECONDS
              })
        // Own the shot plus its transition tail (except the last) so the next shot has something
        // to cross-dissolve against.
        const dur = Math.round(
          (shot.duration + (isLast ? 0 : outgoingTransitionSeconds)) * fps
        )
        const fadeInFrames =
          incomingTransition.type === 'cut'
            ? 0
            : Math.round(incomingTransition.duration * fps)
        return (
          <Sequence
            key={i}
            from={from}
            durationInFrames={Math.max(1, dur)}
            layout="none"
          >
            <ShotLayer
              shot={shot}
              index={i}
              fadeInFrames={fadeInFrames}
              transitionType={incomingTransition.type}
              accent={accent}
            />
          </Sequence>
        )
      })}

      {/* Continuous caption layer on top of every shot (can be globally disabled). */}
      {props.showCaptions !== false && (
        <Captions
          shots={activeShots}
          accent={accent}
          captionStyle={captionStyle}
        />
      )}

      {/* Transition sound effects on cuts */}
      {activeShots.map((shot, i) => {
        if (i === 0) return null
        const transition = activeShots[i - 1].transitionOut ?? {
          type: 'crossfade' as const,
          duration: FADE_SECONDS
        }
        if (transition.type === 'cut' || transition.type === 'crossfade') {
          return null
        }
        return (
          <SoundEffect
            key={`sfx-${i}`}
            type={transition.type === 'film-burn' ? 'pop' : 'whoosh'}
            from={Math.round(shot.start * fps)}
            volume={props.transitionSfxVolume ?? 0.35}
          />
        )
      })}

      {(props.audioCues ?? []).map(cue => (
        <AudioCueLayer key={cue.id} cue={cue} total={total} />
      ))}

      {/* YouTube Subscribe Call-To-Action overlay near the end */}
      {props.showSubscribeCta !== false && (
        <SubscribeCta
          channelName={props.brand?.channel || 'Kakkao Live'}
          accent={accent}
          totalSeconds={total}
        />
      )}

      {/* Audio: voiceover full-length; music looped, ducked under the VO, faded out. */}
      {props.voice ? (
        <Audio src={props.voice} volume={props.voiceVolume ?? 1} />
      ) : null}
      {props.music ? (
        <MusicBed
          src={props.music}
          total={total}
          ducked={!!props.voice}
          customVolume={props.musicVolume}
        />
      ) : null}
    </AbsoluteFill>
  )
}

const resolveAudioSrc = (src: string) =>
  src.startsWith('/audio/') ? staticFile(src.slice(1)) : src

const AudioCueLayer: React.FC<{ cue: AudioCue; total: number }> = ({
  cue,
  total
}) => {
  const { fps } = useVideoConfig()
  const availableSeconds = Math.max(0, total - cue.start)
  const durationSeconds = Math.min(
    cue.duration ?? availableSeconds,
    availableSeconds
  )
  const cueEnvelope = { ...cue, duration: durationSeconds }
  if (durationSeconds <= 0 || cue.volume <= 0) return null

  return (
    <Sequence
      from={Math.round(cue.start * fps)}
      durationInFrames={Math.max(1, Math.round(durationSeconds * fps))}
      layout="none"
    >
      <Audio
        src={resolveAudioSrc(cue.src)}
        loop={cue.loop}
        volume={frame => audioCueVolumeAtTime(cueEnvelope, frame / fps)}
      />
    </Sequence>
  )
}

// Music bed — loops to cover the timeline, ducked when a voiceover is present, with a
// 2s fade-out at the end (mirrors the engine's volume + afade).
const MusicBed: React.FC<{
  src: string
  total: number
  ducked: boolean
  customVolume?: number
}> = ({ src, total, ducked, customVolume }) => {
  const { fps } = useVideoConfig()
  const base = customVolume != null ? customVolume : ducked ? 0.12 : 0.5
  const fadeStart = Math.max(0, total - 2)
  return (
    <Audio
      src={resolveAudioSrc(src)}
      loop
      volume={frame => {
        const t = frame / fps
        if (t < fadeStart) return base
        return interpolate(t, [fadeStart, total], [base, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp'
        })
      }}
    />
  )
}

export default Storyboard
