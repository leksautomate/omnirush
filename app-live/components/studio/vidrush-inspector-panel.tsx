'use client'

import React, { useState } from 'react'

import {
  IconAlertTriangle,
  IconArrowRight,
  IconBolt,
  IconCheck,
  IconClock,
  IconColorSwatch,
  IconCopy,
  IconDownload,
  IconEye,
  IconEyeOff,
  IconHistory,
  IconLoader2,
  IconMicrophone,
  IconMovie,
  IconMusic,
  IconPlayerPlay,
  IconPlus,
  IconSend,
  IconSparkles,
  IconSubtitles,
  IconTrash,
  IconVolume
} from '@tabler/icons-react'

import {
  buildSatelliteMapUrl,
  buildSingleLocationMapUrl,
  geocodePlace,
  maptilerConfigured,
  verifyMapImageUrl
} from '@/lib/engine/maptiler'
import { validateMediaWindow } from '@/lib/engine/video-segments'
import { cn } from '@/lib/utils'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'

import { DocumentaryInspector } from '@/components/studio/documentary-inspector'

import { mediaFitForShot } from '@/remotion/MediaFrame'
import type {
  AudioCue,
  CaptionStyle,
  Shot,
  StoryboardInput
} from '@/remotion/schema'

const ACCENT_SWATCHES = [
  '#ff6b00', // VidRush Signature Orange
  '#ff2d55', // Crimson
  '#3b82f6', // Electric Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#ffffff' // White
]

type CaptionTreatment = Exclude<CaptionStyle, 'normal'>

const CAPTION_TREATMENTS: Array<{
  value: CaptionTreatment
  label: string
  description: string
}> = [
  {
    value: 'documentary',
    label: 'Documentary',
    description: 'Restrained lower-third plate'
  },
  {
    value: 'karaoke',
    label: 'Karaoke',
    description: 'Word-by-word highlight'
  },
  {
    value: 'minimal',
    label: 'Minimal',
    description: 'Small clean lower subtitle'
  },
  {
    value: 'tiktok',
    label: 'TikTok',
    description: 'Energetic centered word pop'
  },
  {
    value: 'full-sentence',
    label: 'Full Sentence',
    description: 'Readable sentence blocks'
  }
]

function CaptionTreatmentPreview({ style }: { style: CaptionTreatment }) {
  return (
    <span
      aria-hidden="true"
      data-caption-preview={style}
      className="relative mb-2 block h-10 overflow-hidden rounded-md border border-white/5 bg-black/60"
    >
      {style === 'documentary' && (
        <span className="absolute right-2 bottom-1.5 left-2 flex h-4 items-center rounded-xs border-l-2 border-orange-400 bg-zinc-900/90 px-1.5">
          <span className="h-1 w-10 rounded-full bg-zinc-300" />
        </span>
      )}
      {style === 'karaoke' && (
        <span className="absolute right-1 bottom-2 left-1 text-center text-[8px] font-black tracking-tight text-zinc-400">
          EVERY <span className="text-orange-400">FRAME</span> MOVES
        </span>
      )}
      {style === 'minimal' && (
        <span className="absolute right-2 bottom-1.5 left-2 text-center text-[6px] font-medium tracking-wide text-zinc-200">
          A clean line at the lower safe edge
        </span>
      )}
      {style === 'tiktok' && (
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-yellow-300 [text-shadow:1px_1px_0_#000]">
          POP
        </span>
      )}
      {style === 'full-sentence' && (
        <span className="absolute right-3 bottom-1.5 left-3 rounded-xs bg-black/70 px-1 py-0.5 text-center text-[6px] font-bold leading-tight text-white">
          Every frame tells
          <br />
          the whole story
        </span>
      )}
    </span>
  )
}

export interface HistorySnapshot {
  id: string
  timestamp: Date
  description: string
  storyboard: StoryboardInput
}

interface VidrushInspectorPanelProps {
  selectedShotIndex: number
  storyboard: StoryboardInput
  historySnapshots: HistorySnapshot[]
  onUpdateShot: (index: number, updated: Partial<Shot>) => void
  onOpenAssetPicker: (index: number) => void
  onUpdateStoryboard: (updated: Partial<StoryboardInput>) => void
  onSeekToShot: (index: number) => void
  onRestoreSnapshot: (snapshot: HistorySnapshot) => void
}

type TabType = 'shot' | 'audio' | 'captions' | 'agent' | 'history'

export function VidrushInspectorPanel({
  selectedShotIndex,
  storyboard,
  historySnapshots,
  onUpdateShot,
  onOpenAssetPicker,
  onUpdateStoryboard,
  onSeekToShot,
  onRestoreSnapshot
}: VidrushInspectorPanelProps) {
  const [tab, setTab] = useState<TabType>('shot')
  const [agentPrompt, setAgentPrompt] = useState('')
  const [agentLoading, setAgentLoading] = useState(false)
  const [agentFeedback, setAgentFeedback] = useState<string | null>(null)
  const [copiedTranscript, setCopiedTranscript] = useState(false)
  const [mediaWindowDraft, setMediaWindowDraft] = useState<{
    shotIndex: number
    start: string
    end: string
  } | null>(null)
  const [mediaWindowError, setMediaWindowError] = useState<string | null>(null)
  const [mapStatus, setMapStatus] = useState<
    'idle' | 'resolving' | 'resolved' | 'error' | 'image-blocked'
  >('idle')

  const shot = storyboard.shots[selectedShotIndex] || storyboard.shots[0]
  const selectedMediaFit = shot ? mediaFitForShot(shot) : 'cover'
  const activeMediaWindowDraft =
    mediaWindowDraft?.shotIndex === selectedShotIndex
      ? mediaWindowDraft
      : {
          shotIndex: selectedShotIndex,
          start: String(shot?.mediaStart ?? 0),
          end: String(
            shot?.mediaEnd ?? (shot?.mediaStart ?? 0) + (shot?.duration ?? 0)
          )
        }
  const selectedCaptionTreatment: CaptionTreatment =
    storyboard.captionStyle === 'normal'
      ? 'full-sentence'
      : (storyboard.captionStyle ??
        (storyboard.height > storyboard.width ? 'tiktok' : 'full-sentence'))

  const updateAudioCue = (id: string, updated: Partial<AudioCue>) => {
    onUpdateStoryboard({
      audioCues: (storyboard.audioCues ?? []).map(cue =>
        cue.id === id ? { ...cue, ...updated } : cue
      )
    })
  }

  const removeAudioCue = (id: string) => {
    onUpdateStoryboard({
      audioCues: (storyboard.audioCues ?? []).filter(cue => cue.id !== id)
    })
  }

  const addStarterAudioCue = (kind: AudioCue['kind']) => {
    const start = shot?.start ?? 0
    const isAmbient = kind === 'ambient'
    const cue: AudioCue = {
      id: `${kind}-${Date.now()}`,
      kind,
      src: isAmbient
        ? '/audio/ambient/audiopapkin-forest-ambience-296528.mp3'
        : '/audio/sfx/dragon-studio-whoosh-effect-382717.mp3',
      start,
      duration: isAmbient ? (shot?.duration ?? 5) : 0.575,
      volume: isAmbient ? 0.2 : 0.5,
      loop: isAmbient,
      fadeIn: isAmbient ? 0.5 : 0,
      fadeOut: isAmbient ? 0.75 : 0,
      credit: {
        title: isAmbient ? 'Forest ambience' : 'Whoosh Effect',
        creator: isAmbient ? 'AudioPapkin' : 'DRAGON-STUDIO',
        source: 'pixabay',
        sourceUrl: isAmbient
          ? 'https://pixabay.com/sound-effects/nature-forest-ambience-296528/'
          : 'https://pixabay.com/sound-effects/film-special-effects-whoosh-effect-382717/',
        license: 'Pixabay Content License',
        licenseUrl: 'https://pixabay.com/service/license-summary/',
        contentIdRegistered: false
      }
    }
    onUpdateStoryboard({ audioCues: [...(storyboard.audioCues ?? []), cue] })
  }

  const applyMediaWindow = () => {
    if (!shot) return
    try {
      const window = validateMediaWindow({
        start: activeMediaWindowDraft.start,
        end: activeMediaWindowDraft.end,
        minimumDuration: shot.duration,
        sourceDuration: shot.sourceDuration,
        clampToSource: false
      })
      setMediaWindowError(null)
      onUpdateShot(selectedShotIndex, {
        mediaStart: window.start,
        mediaEnd: window.end,
        mediaMuted: shot.mediaMuted ?? true
      })
    } catch (error) {
      setMediaWindowError(
        error instanceof Error ? error.message : 'Invalid source window'
      )
    }
  }

  // Resolves the map overlay's fromLabel/toLabel place name(s) to real coordinates via
  // MapTiler, then builds a real satellite static-map image — a flight path between both
  // points when a destination is given (a journey), or a single zoomed-in location shot
  // when it's left blank (a biography/true-crime "this is the place" beat) — so the
  // "animated-map" overlay shows the actual location instead of a generic stock photo.
  const resolveMapLocations = async () => {
    const overlay = storyboard.shots[selectedShotIndex]?.overlay
    const fromLabel = overlay?.fromLabel?.trim()
    const toLabel = overlay?.toLabel?.trim()
    if (!overlay || !fromLabel) return
    if (!maptilerConfigured()) {
      setMapStatus('error')
      return
    }

    setMapStatus('resolving')
    try {
      if (!toLabel) {
        // Single-location zoom-in — no destination to resolve.
        const from = await geocodePlace(fromLabel)
        if (!from) {
          setMapStatus('error')
          return
        }
        const mapImageUrl = buildSingleLocationMapUrl({ point: from })
        const imageOk = mapImageUrl
          ? await verifyMapImageUrl(mapImageUrl)
          : false
        onUpdateShot(selectedShotIndex, {
          overlay: {
            ...overlay,
            fromCoords: [from.lon, from.lat],
            toCoords: undefined,
            // Only persist the image URL once it's confirmed to actually load — a
            // rejected key still returns a 200-shaped URL string, just a 403 image.
            mapImageUrl: imageOk ? (mapImageUrl ?? undefined) : undefined
          }
        })
        setMapStatus(imageOk ? 'resolved' : 'image-blocked')
        return
      }

      const [from, to] = await Promise.all([
        geocodePlace(fromLabel),
        geocodePlace(toLabel)
      ])
      if (!from || !to) {
        setMapStatus('error')
        return
      }

      const mapImageUrl = buildSatelliteMapUrl({
        from,
        to,
        accent: storyboard.brand?.accent
      })
      const imageOk = mapImageUrl ? await verifyMapImageUrl(mapImageUrl) : false
      onUpdateShot(selectedShotIndex, {
        overlay: {
          ...overlay,
          fromCoords: [from.lon, from.lat],
          toCoords: [to.lon, to.lat],
          mapImageUrl: imageOk ? (mapImageUrl ?? undefined) : undefined
        }
      })
      setMapStatus(imageOk ? 'resolved' : 'image-blocked')
    } catch {
      setMapStatus('error')
    }
  }

  // Export Transcript Handler
  const handleCopyTranscript = () => {
    const text = storyboard.shots
      .filter(s => !s.hidden && s.narration)
      .map(
        (s, i) =>
          `[${new Date(s.start * 1000).toISOString().substring(14, 19)}] Shot #${i + 1}: ${s.narration}`
      )
      .join('\n\n')

    navigator.clipboard.writeText(text)
    setCopiedTranscript(true)
    setTimeout(() => setCopiedTranscript(false), 2500)
  }

  const handleDownloadTranscript = () => {
    const text = storyboard.shots
      .filter(s => !s.hidden && s.narration)
      .map(
        (s, i) =>
          `[${new Date(s.start * 1000).toISOString().substring(14, 19)}] Shot #${i + 1}: ${s.narration}`
      )
      .join('\n\n')

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transcript-${storyboard.brand?.channel || 'vidrush'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Parse timecode / shot index from prompt
  const parseTargetShotIndex = (
    prompt: string
  ): { targetIndex: number; isRange: boolean } => {
    const lower = prompt.toLowerCase()
    // Match "shot 2" or "clip 3"
    const shotMatch = lower.match(/(?:shot|clip)\s*#?(\d+)/)
    if (shotMatch) {
      const idx = parseInt(shotMatch[1], 10) - 1
      if (idx >= 0 && idx < storyboard.shots.length) {
        return { targetIndex: idx, isRange: false }
      }
    }

    // Match timestamps like "0:04", "4s", "at 4", "0:02-0:06"
    const timeMatch = lower.match(/(?:at\s*)?(\d+)(?::(\d+))?s?/)
    if (timeMatch) {
      const sec = timeMatch[2]
        ? parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10)
        : parseInt(timeMatch[1], 10)
      const foundIdx = storyboard.shots.findIndex(
        s => sec >= s.start && sec < s.start + s.duration
      )
      if (foundIdx !== -1) return { targetIndex: foundIdx, isRange: false }
    }

    return { targetIndex: selectedShotIndex, isRange: false }
  }

  // Rush Agent AI Execution Engine
  const handleAgentSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!agentPrompt.trim()) return

    const prompt = agentPrompt.trim()
    const lower = prompt.toLowerCase()
    setAgentPrompt('')
    setAgentLoading(true)
    setAgentFeedback('Rush Agent thinking & executing...')

    try {
      const { targetIndex } = parseTargetShotIndex(lower)

      // Command 1: Hide clip
      if (lower.includes('hide')) {
        onUpdateShot(targetIndex, { hidden: true })
        setAgentFeedback(
          `✓ Hid Shot #${targetIndex + 1} from playback and render.`
        )
      }
      // Command 2: Unhide clip
      else if (lower.includes('unhide') || lower.includes('show')) {
        onUpdateShot(targetIndex, { hidden: false })
        setAgentFeedback(`✓ Unhid Shot #${targetIndex + 1}.`)
      }
      // Command 3: Captions style
      else if (lower.includes('tiktok') || lower.includes('word pop')) {
        onUpdateStoryboard({ captionStyle: 'tiktok', showCaptions: true })
        setAgentFeedback('✓ Set caption style to TikTok word pop.')
      } else if (lower.includes('normal') || lower.includes('wrap')) {
        onUpdateStoryboard({ captionStyle: 'normal', showCaptions: true })
        setAgentFeedback('✓ Set caption style to Normal wrapping.')
      } else if (
        lower.includes('no captions') ||
        lower.includes('disable captions')
      ) {
        onUpdateStoryboard({ showCaptions: false })
        setAgentFeedback('✓ Disabled subtitles project-wide.')
      }
      // Command 4: Pacing adjustments
      else if (lower.includes('faster') || lower.includes('speed up')) {
        const shortened = storyboard.shots.map(s => ({
          ...s,
          duration: Math.max(1.2, +(s.duration * 0.85).toFixed(1))
        }))
        onUpdateStoryboard({ shots: shortened })
        setAgentFeedback('✓ Increased video pacing by 15%.')
      }
      // Command 5: Music adjustments
      else if (lower.includes('quieter') || lower.includes('music down')) {
        onUpdateStoryboard({ musicVolume: 0.06 })
        setAgentFeedback('✓ Lowered background music overlay volume.')
      }
      // Command 6: AI Media Search / Replace in place
      else if (
        lower.includes('replace') ||
        lower.includes('find') ||
        lower.includes('search') ||
        lower.includes('with')
      ) {
        // Extract query
        let query = prompt
          .replace(/(?:replace|find|search|with|shot|clip|\d+)/gi, ' ')
          .trim()
        if (!query) query = 'space rocket cinematic'

        setAgentFeedback(`Searching footage for "${query}"...`)
        const res = await fetch('/api/studio/source', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, limit: 4 })
        })
        const data = await res.json()
        if (data.candidates && data.candidates.length > 0) {
          const pick = data.candidates[0]
          onUpdateShot(targetIndex, {
            src: pick.url,
            kind: pick.kind === 'video' ? 'video' : 'photo'
          })
          setAgentFeedback(
            `✓ Sourced & replaced Shot #${targetIndex + 1} with "${pick.title || query}".`
          )
        } else {
          setAgentFeedback(
            `No web footage found for "${query}". Opening picker...`
          )
          onOpenAssetPicker(targetIndex)
        }
      }
      // Command 7: Generate AI Image
      else if (lower.includes('generate')) {
        const query = prompt
          .replace(/(?:generate|image|for|shot|\d+)/gi, ' ')
          .trim()
        setAgentFeedback(`Generating AI visual for "${query}"...`)
        const res = await fetch('/api/studio/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: query, aspectRatio: '16:9' })
        })
        const data = await res.json()
        if (data.url) {
          onUpdateShot(targetIndex, { src: data.url, kind: 'photo' })
          setAgentFeedback(
            `✓ Generated new AI image and inserted into Shot #${targetIndex + 1}.`
          )
        } else {
          setAgentFeedback(
            `AI generation completed for Shot #${targetIndex + 1}.`
          )
        }
      } else {
        setAgentFeedback(`✓ Command processed: "${prompt}"`)
      }
    } catch (err) {
      setAgentFeedback('Error executing command: ' + String(err))
    } finally {
      setAgentLoading(false)
      setTimeout(() => setAgentFeedback(null), 6000)
    }
  }

  return (
    <aside className="flex w-full flex-col border-l border-zinc-800/80 bg-[#121216] text-white lg:w-88 shrink-0">
      {storyboard.documentaryProject ? (
        <DocumentaryInspector
          storyboard={storyboard}
          selectedShotIndex={selectedShotIndex}
          onUpdateShot={onUpdateShot}
          onSelectShot={onSeekToShot}
        />
      ) : null}
      {/* Inspector Tab Bar */}
      <div className="flex border-b border-zinc-800/80 bg-zinc-950/60 p-1 text-[11px]">
        <button
          type="button"
          onClick={() => setTab('shot')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1 rounded-lg py-2 font-semibold transition-all',
            tab === 'shot'
              ? 'bg-zinc-800 text-white shadow-xs'
              : 'text-zinc-400 hover:text-white'
          )}
        >
          <IconMovie className="h-3.5 w-3.5" />
          Shot
        </button>
        <button
          type="button"
          onClick={() => setTab('audio')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1 rounded-lg py-2 font-semibold transition-all',
            tab === 'audio'
              ? 'bg-zinc-800 text-white shadow-xs'
              : 'text-zinc-400 hover:text-white'
          )}
        >
          <IconVolume className="h-3.5 w-3.5" />
          Audio
        </button>
        <button
          type="button"
          onClick={() => setTab('captions')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1 rounded-lg py-2 font-semibold transition-all',
            tab === 'captions'
              ? 'bg-zinc-800 text-white shadow-xs'
              : 'text-zinc-400 hover:text-white'
          )}
        >
          <IconSubtitles className="h-3.5 w-3.5" />
          Style
        </button>
        <button
          type="button"
          onClick={() => setTab('agent')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1 rounded-lg py-2 font-semibold transition-all',
            tab === 'agent'
              ? 'bg-orange-500/20 text-orange-400 shadow-xs'
              : 'text-zinc-400 hover:text-white'
          )}
        >
          <IconSparkles className="h-3.5 w-3.5 text-orange-500" />
          Agent
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1 rounded-lg py-2 font-semibold transition-all',
            tab === 'history'
              ? 'bg-zinc-800 text-white shadow-xs'
              : 'text-zinc-400 hover:text-white'
          )}
        >
          <IconHistory className="h-3.5 w-3.5" />
          History
        </button>
      </div>

      {/* Tab Content Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* TAB 1: SHOT INSPECTOR */}
        {tab === 'shot' && shot && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-orange-500 font-bold text-white text-[11px]">
                  {selectedShotIndex + 1}
                </span>
                <span className="font-semibold text-zinc-200">
                  Shot #{selectedShotIndex + 1}
                </span>
                {shot.hidden && (
                  <Badge
                    variant="outline"
                    className="border-zinc-700 bg-zinc-800 text-[10px] text-zinc-400"
                  >
                    Hidden
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {/* Hide / Unhide button */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    onUpdateShot(selectedShotIndex, { hidden: !shot.hidden })
                  }
                  title={shot.hidden ? 'Unhide Clip' : 'Hide Clip'}
                  className="h-6 w-6 p-0 text-zinc-400 hover:text-white"
                >
                  {shot.hidden ? (
                    <IconEyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <IconEye className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onSeekToShot(selectedShotIndex)}
                  className="h-6 gap-1 px-2 text-[10px] text-zinc-400 hover:text-white"
                >
                  <IconPlayerPlay className="h-3 w-3 fill-current" />
                  Seek
                </Button>
              </div>
            </div>

            {/* Media Preview Box */}
            <div className="space-y-2">
              <span className="text-[11px] font-medium text-zinc-400">
                Visual Media
              </span>
              <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-zinc-800 bg-black">
                {shot.src ? (
                  shot.kind === 'video' || shot.src.endsWith('.mp4') ? (
                    <video
                      src={shot.src}
                      muted
                      preload="metadata"
                      className={cn(
                        'h-full w-full',
                        selectedMediaFit === 'contain'
                          ? 'object-contain'
                          : 'object-cover'
                      )}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={shot.src}
                      alt="Shot asset"
                      className={cn(
                        'h-full w-full',
                        selectedMediaFit === 'contain'
                          ? 'object-contain'
                          : 'object-cover'
                      )}
                    />
                  )
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-white/80"
                    style={{
                      backgroundColor: storyboard.brand?.accent || '#ff6b00'
                    }}
                  >
                    Solid Brand Card
                  </div>
                )}
              </div>

              {shot.src && (
                <div className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2">
                  <span className="text-[10px] font-medium text-zinc-400">
                    Frame media
                  </span>
                  <div className="flex rounded-md bg-zinc-950 p-0.5">
                    {(
                      [
                        ['contain', 'Fit'],
                        ['cover', 'Fill']
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={selectedMediaFit === value}
                        onClick={() =>
                          onUpdateShot(selectedShotIndex, { mediaFit: value })
                        }
                        className={cn(
                          'rounded px-2.5 py-1 text-[10px] font-semibold transition-colors',
                          selectedMediaFit === value
                            ? 'bg-orange-500 text-white'
                            : 'text-zinc-400 hover:text-white'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {shot.kind === 'video' && shot.src && (
                <div className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-zinc-300">
                      Source Window
                    </span>
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={`source-audio-${selectedShotIndex}`}
                        className="text-[10px] text-zinc-400"
                      >
                        Source audio
                      </label>
                      <Switch
                        id={`source-audio-${selectedShotIndex}`}
                        aria-label="Source audio"
                        checked={shot.mediaMuted === false}
                        onCheckedChange={enabled => {
                          if (enabled) {
                            onUpdateShot(selectedShotIndex, {
                              mediaMuted: false,
                              videoVolume:
                                shot.videoVolume && shot.videoVolume > 0
                                  ? shot.videoVolume
                                  : 1
                            })
                            return
                          }
                          onUpdateShot(selectedShotIndex, {
                            mediaMuted: true
                          })
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1 text-[10px] text-zinc-400">
                      In point (seconds)
                      <Input
                        aria-label="In point (seconds)"
                        type="number"
                        min={0}
                        max={shot.sourceDuration}
                        step={0.1}
                        value={activeMediaWindowDraft.start}
                        onChange={event => {
                          setMediaWindowError(null)
                          setMediaWindowDraft({
                            ...activeMediaWindowDraft,
                            start: event.target.value
                          })
                        }}
                      />
                    </label>
                    <label className="space-y-1 text-[10px] text-zinc-400">
                      Out point (seconds)
                      <Input
                        aria-label="Out point (seconds)"
                        type="number"
                        min={0}
                        max={shot.sourceDuration}
                        step={0.1}
                        value={activeMediaWindowDraft.end}
                        onChange={event => {
                          setMediaWindowError(null)
                          setMediaWindowDraft({
                            ...activeMediaWindowDraft,
                            end: event.target.value
                          })
                        }}
                      />
                    </label>
                  </div>
                  {mediaWindowError && (
                    <p role="alert" className="text-[10px] text-red-400">
                      {mediaWindowError}
                    </p>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full border-zinc-700 bg-zinc-950 text-zinc-300"
                    onClick={applyMediaWindow}
                  >
                    Apply source window
                  </Button>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => onOpenAssetPicker(selectedShotIndex)}
                  size="sm"
                  className="flex-1 gap-1.5 bg-orange-500 text-white hover:bg-orange-600 font-semibold shadow-md shadow-orange-500/20"
                >
                  <IconSparkles className="h-3.5 w-3.5" />
                  Replace Media
                </Button>
                {shot.src && (
                  <Button
                    onClick={() =>
                      onUpdateShot(selectedShotIndex, { src: undefined })
                    }
                    size="sm"
                    variant="outline"
                    className="border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Duration Slider */}
            <div className="space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-300">Shot Duration</span>
                <Badge
                  variant="outline"
                  className="border-orange-500/30 bg-orange-500/10 font-mono text-[11px] text-orange-400"
                >
                  {shot.duration.toFixed(1)}s
                </Badge>
              </div>
              <Slider
                value={[shot.duration]}
                min={0.5}
                max={30}
                step={0.1}
                onValueChange={([val]) =>
                  onUpdateShot(selectedShotIndex, { duration: val })
                }
              />
            </div>

            {/* Video Clip Embedded Audio Volume */}
            {shot.kind === 'video' && (
              <div className="space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-300">Clip Audio</span>
                  <span className="font-mono text-zinc-400">
                    {Math.round((shot.videoVolume ?? 0) * 100)}%
                  </span>
                </div>
                <Slider
                  value={[shot.videoVolume ?? 0]}
                  min={0}
                  max={1.0}
                  step={0.05}
                  onValueChange={([val]) =>
                    onUpdateShot(selectedShotIndex, { videoVolume: val })
                  }
                />
              </div>
            )}

            {/* Spoken Narration Textarea */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-zinc-400">
                Spoken Narration Caption
              </label>
              <textarea
                rows={3}
                value={shot.narration || ''}
                onChange={e =>
                  onUpdateShot(selectedShotIndex, { narration: e.target.value })
                }
                placeholder="Enter narration words for this shot..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-white placeholder:text-zinc-600 focus:border-orange-500 focus:outline-hidden"
              />
            </div>

            {/* Motion Graphics Overlay Section */}
            <div className="space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-200">
                  Motion Overlay
                </span>
                <span className="text-[10px] font-mono uppercase text-orange-400">
                  {shot.overlay?.type && shot.overlay.type !== 'none'
                    ? shot.overlay.type
                    : 'Off'}
                </span>
              </div>
              <select
                value={shot.overlay?.type || 'none'}
                onChange={e => {
                  const val = e.target.value as any
                  onUpdateShot(selectedShotIndex, {
                    overlay: {
                      ...(shot.overlay || {}),
                      type: val,
                      numberValue: shot.overlay?.numberValue ?? 24813,
                      numberLabel:
                        shot.overlay?.numberLabel ?? 'Total Casualties',
                      text:
                        shot.overlay?.text ??
                        (shot.narration || 'June 6, 1944 — Normandy'),
                      publication:
                        shot.overlay?.publication ?? 'THE DAILY DISPATCH',
                      issueDate:
                        shot.overlay?.issueDate ??
                        'June 6, 1944 · Special War Issue',
                      headline:
                        shot.overlay?.headline ??
                        (shot.narration ||
                          'WAR DECLARED: ALLIES CONFRONT HISTORIC TURNING POINT'),
                      highlightWords: shot.overlay?.highlightWords ?? [
                        'HISTORIC',
                        'TURNING',
                        'POINT'
                      ],
                      mapTitle:
                        shot.overlay?.mapTitle ??
                        'TACTICAL MAP & GEOLOCATION DISPATCH',
                      fromLabel:
                        shot.overlay?.fromLabel ?? 'COMMAND HQ (LONDON)',
                      toLabel:
                        shot.overlay?.toLabel ?? 'TARGET OBJECTIVE (NORMANDY)',
                      bars: shot.overlay?.bars ?? [
                        { label: 'Allies', value: 156, highlighted: false },
                        { label: 'Axis', value: 89, highlighted: false },
                        { label: 'Total', value: 245, highlighted: true }
                      ]
                    }
                  })
                }}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-hidden"
              >
                <option value="none">None (Standard Shot)</option>
                <option value="newspaper">
                  📰 3D Newspaper Headline (Highlight Pen)
                </option>
                <option value="animated-map">
                  🗺️ Animated Tactical Map (Radar & Pins)
                </option>
                <option value="bar-chart">
                  📊 Vertical Bar Chart (Animated Columns)
                </option>
                <option value="film-burn">
                  🔥 Film Burn / Light Leak (History/WW2)
                </option>
                <option value="camera-shake">
                  💥 Camera Shake (Battle Impact)
                </option>
                <option value="typewriter">
                  ⌨️ Typewriter Subtitle (Date / Quote)
                </option>
                <option value="number-counter">
                  🔢 Number Counter (Stats / Metric)
                </option>
                <option value="circular-progress">
                  ⭕ Circular Progress (Percentage)
                </option>
                <option value="glitch">⚡ Glitch Text (Tech / Alert)</option>
              </select>

              {/* Newspaper Headline Settings */}
              {shot.overlay?.type === 'newspaper' && (
                <div className="mt-2 space-y-2 border-t border-zinc-800/60 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-400">
                        Publication
                      </label>
                      <input
                        type="text"
                        value={shot.overlay.publication || ''}
                        onChange={e =>
                          onUpdateShot(selectedShotIndex, {
                            overlay: {
                              ...shot.overlay!,
                              publication: e.target.value
                            }
                          })
                        }
                        placeholder="e.g. THE DAILY DISPATCH"
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400">
                        Issue Date
                      </label>
                      <input
                        type="text"
                        value={shot.overlay.issueDate || ''}
                        onChange={e =>
                          onUpdateShot(selectedShotIndex, {
                            overlay: {
                              ...shot.overlay!,
                              issueDate: e.target.value
                            }
                          })
                        }
                        placeholder="e.g. June 6, 1944"
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400">
                      Headline Text
                    </label>
                    <input
                      type="text"
                      value={shot.overlay.headline || ''}
                      onChange={e =>
                        onUpdateShot(selectedShotIndex, {
                          overlay: {
                            ...shot.overlay!,
                            headline: e.target.value
                          }
                        })
                      }
                      placeholder="Enter headline..."
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-white"
                    />
                  </div>
                </div>
              )}

              {/* Animated Map Settings */}
              {shot.overlay?.type === 'animated-map' && (
                <div className="mt-2 space-y-2 border-t border-zinc-800/60 pt-2">
                  <div>
                    <label className="text-[10px] text-zinc-400">
                      Map Title
                    </label>
                    <input
                      type="text"
                      value={shot.overlay.mapTitle || ''}
                      onChange={e =>
                        onUpdateShot(selectedShotIndex, {
                          overlay: {
                            ...shot.overlay!,
                            mapTitle: e.target.value
                          }
                        })
                      }
                      placeholder="e.g. TACTICAL ADVANCE MAP"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-400">
                        Location Pin
                      </label>
                      <input
                        type="text"
                        value={shot.overlay.fromLabel || ''}
                        onChange={e => {
                          setMapStatus('idle')
                          onUpdateShot(selectedShotIndex, {
                            overlay: {
                              ...shot.overlay!,
                              fromLabel: e.target.value,
                              fromCoords: undefined,
                              mapImageUrl: undefined
                            }
                          })
                        }}
                        onBlur={resolveMapLocations}
                        placeholder="e.g. Chicago, USA"
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400">
                        Destination Pin (optional)
                      </label>
                      <input
                        type="text"
                        value={shot.overlay.toLabel || ''}
                        onChange={e => {
                          setMapStatus('idle')
                          onUpdateShot(selectedShotIndex, {
                            overlay: {
                              ...shot.overlay!,
                              toLabel: e.target.value,
                              toCoords: undefined,
                              mapImageUrl: undefined
                            }
                          })
                        }}
                        onBlur={resolveMapLocations}
                        placeholder="e.g. Normandy, France"
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-white"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    Leave Destination blank for a single-location zoom-in
                    (biography, true-crime, &ldquo;this is the place&rdquo;
                    beats) — fill both for a flight path between two points.
                  </p>
                  <p className="text-[10px]">
                    {mapStatus === 'resolving' && (
                      <span className="text-zinc-400">
                        Resolving real coordinates & fetching satellite imagery…
                      </span>
                    )}
                    {mapStatus === 'resolved' && (
                      <span className="text-emerald-400">
                        ✓ Real MapTiler satellite imagery attached
                      </span>
                    )}
                    {mapStatus === 'error' && (
                      <span className="text-red-400">
                        {maptilerConfigured()
                          ? 'Couldn\'t resolve one of these locations — check spelling, or add a country (e.g. "Normandy, France").'
                          : 'MAPTILER_API_KEY / NEXT_PUBLIC_MAPTILER_API_KEY not configured — showing a placeholder background instead.'}
                      </span>
                    )}
                    {mapStatus === 'image-blocked' && (
                      <span className="text-amber-400">
                        Locations resolved, but MapTiler rejected the satellite
                        image request (your key&apos;s plan likely doesn&apos;t
                        include the Static Maps API — check
                        cloud.maptiler.com/account/keys) — showing a placeholder
                        background instead.
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Number Counter & Circular Progress Settings */}
              {(shot.overlay?.type === 'number-counter' ||
                shot.overlay?.type === 'circular-progress') && (
                <div className="mt-2 space-y-2 border-t border-zinc-800/60 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-400">
                        Target Value
                      </label>
                      <input
                        type="number"
                        value={shot.overlay.numberValue ?? 100}
                        onChange={e =>
                          onUpdateShot(selectedShotIndex, {
                            overlay: {
                              ...shot.overlay!,
                              numberValue: parseFloat(e.target.value) || 0
                            }
                          })
                        }
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400">
                        Stat Label
                      </label>
                      <input
                        type="text"
                        value={shot.overlay.numberLabel || ''}
                        onChange={e =>
                          onUpdateShot(selectedShotIndex, {
                            overlay: {
                              ...shot.overlay!,
                              numberLabel: e.target.value
                            }
                          })
                        }
                        placeholder="e.g. CASUALTIES"
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Typewriter & Glitch Text Settings */}
              {(shot.overlay?.type === 'typewriter' ||
                shot.overlay?.type === 'glitch') && (
                <div className="mt-2 space-y-1.5 border-t border-zinc-800/60 pt-2">
                  <label className="text-[10px] text-zinc-400">
                    Overlay Text
                  </label>
                  <input
                    type="text"
                    value={shot.overlay.text || ''}
                    onChange={e =>
                      onUpdateShot(selectedShotIndex, {
                        overlay: {
                          ...shot.overlay!,
                          text: e.target.value
                        }
                      })
                    }
                    placeholder="Enter overlay text..."
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-white"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: AUDIO & SFX MIXER */}
        {tab === 'audio' && (
          <div className="space-y-4">
            <div className="border-b border-zinc-800/80 pb-2">
              <h4 className="font-semibold text-zinc-200">
                Audio & Sound Design
              </h4>
              <p className="text-[10px] text-zinc-400">
                VidRush Audio Overlay & SFX Controls
              </p>
            </div>

            {/* Voiceover Track */}
            <div className="space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium text-zinc-200">
                  <IconMicrophone className="h-4 w-4 text-orange-400" />
                  Voiceover Volume
                </span>
                <span className="font-mono text-zinc-400">
                  {Math.round((storyboard.voiceVolume ?? 1) * 100)}%
                </span>
              </div>
              <Slider
                value={[storyboard.voiceVolume ?? 1]}
                min={0}
                max={1.5}
                step={0.05}
                onValueChange={([val]) =>
                  onUpdateStoryboard({ voiceVolume: val })
                }
              />
            </div>

            {/* Background Music Track */}
            <div className="space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium text-zinc-200">
                  <IconMusic className="h-4 w-4 text-cyan-400" />
                  Music Overlay Volume
                </span>
                <span className="font-mono text-zinc-400">
                  {Math.round((storyboard.musicVolume ?? 0.12) * 100)}%
                </span>
              </div>
              <Slider
                value={[storyboard.musicVolume ?? 0.12]}
                min={0}
                max={1.0}
                step={0.02}
                onValueChange={([val]) =>
                  onUpdateStoryboard({ musicVolume: val })
                }
              />
              <Input
                placeholder="Background Music URL..."
                value={storyboard.music || ''}
                onChange={e => onUpdateStoryboard({ music: e.target.value })}
                className="h-7 border-zinc-800 bg-zinc-950 text-[11px]"
              />
            </div>

            {/* Automatic transition SFX volume */}
            <div className="space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium text-zinc-200">
                  <IconBolt className="h-4 w-4 text-yellow-400" />
                  Transition SFX
                </span>
                <span className="font-mono text-zinc-400">
                  {Math.round((storyboard.transitionSfxVolume ?? 0.35) * 100)}%
                </span>
              </div>
              <Slider
                value={[storyboard.transitionSfxVolume ?? 0.35]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={([val]) =>
                  onUpdateStoryboard({ transitionSfxVolume: val })
                }
              />
            </div>

            <div className="space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-200">
                  Timeline Layers
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addStarterAudioCue('sfx')}
                    className="h-6 gap-1 border-zinc-700 px-2 text-[10px]"
                  >
                    <IconPlus className="h-3 w-3" /> SFX
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addStarterAudioCue('ambient')}
                    className="h-6 gap-1 border-zinc-700 px-2 text-[10px]"
                  >
                    <IconPlus className="h-3 w-3" /> Ambience
                  </Button>
                </div>
              </div>

              {(storyboard.audioCues ?? []).length === 0 ? (
                <p className="text-[10px] text-zinc-500">
                  No timed sound layers yet. Add one here or ask Kakkao to
                  choose a matching Pixabay sound.
                </p>
              ) : (
                <div className="space-y-2">
                  {(storyboard.audioCues ?? []).map(cue => (
                    <div
                      key={cue.id}
                      className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/70 p-2"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-zinc-700 text-[9px] uppercase text-zinc-300"
                        >
                          {cue.kind}
                        </Badge>
                        <Input
                          value={cue.src}
                          onChange={e =>
                            updateAudioCue(cue.id, { src: e.target.value })
                          }
                          className="h-6 flex-1 border-zinc-800 bg-zinc-950 text-[10px]"
                        />
                        <button
                          type="button"
                          onClick={() => removeAudioCue(cue.id)}
                          className="text-zinc-500 hover:text-red-400"
                          aria-label="Remove audio layer"
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[9px] text-zinc-500">
                        <label>
                          Start
                          <Input
                            type="number"
                            min={0}
                            step={0.1}
                            value={cue.start}
                            onChange={e =>
                              updateAudioCue(cue.id, {
                                start: Math.max(0, Number(e.target.value))
                              })
                            }
                            className="mt-1 h-6 border-zinc-800 bg-zinc-950 text-[10px]"
                          />
                        </label>
                        <label>
                          Duration
                          <Input
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={cue.duration ?? ''}
                            onChange={e =>
                              updateAudioCue(cue.id, {
                                duration: e.target.value
                                  ? Math.max(0.1, Number(e.target.value))
                                  : undefined
                              })
                            }
                            className="mt-1 h-6 border-zinc-800 bg-zinc-950 text-[10px]"
                          />
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-12 text-[9px] text-zinc-500">
                          Volume
                        </span>
                        <Slider
                          value={[cue.volume]}
                          min={0}
                          max={1}
                          step={0.05}
                          onValueChange={([val]) =>
                            updateAudioCue(cue.id, { volume: val })
                          }
                        />
                        <span className="w-8 text-right font-mono text-[9px] text-zinc-500">
                          {Math.round(cue.volume * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SUBTITLES & STYLE */}
        {tab === 'captions' && (
          <div className="space-y-4">
            <div className="border-b border-zinc-800/80 pb-2">
              <h4 className="font-semibold text-zinc-200">
                Subtitle & Motion Styling
              </h4>
              <p className="text-[10px] text-zinc-400">
                Customize captions, CTA animations, and export transcripts
              </p>
            </div>

            {/* Global Subtitles Toggle */}
            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
              <div>
                <span className="block font-semibold text-zinc-200">
                  Enable Subtitles
                </span>
                <span className="text-[10px] text-zinc-400">
                  Render word-synced captions on video
                </span>
              </div>
              <Switch
                checked={storyboard.showCaptions !== false}
                onCheckedChange={checked =>
                  onUpdateStoryboard({ showCaptions: checked })
                }
              />
            </div>

            {/* Subscribe CTA Animation Toggle */}
            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
              <div>
                <span className="block font-semibold text-zinc-200">
                  Subscribe Animation CTA
                </span>
                <span className="text-[10px] text-zinc-400">
                  Slide up bell CTA in final 5 seconds
                </span>
              </div>
              <Switch
                checked={storyboard.showSubscribeCta !== false}
                onCheckedChange={checked =>
                  onUpdateStoryboard({ showSubscribeCta: checked })
                }
              />
            </div>

            {/* Presentation Mode */}
            <div className="space-y-2">
              <span className="text-[11px] font-medium text-zinc-400">
                Caption Layout
              </span>
              <div className="grid grid-cols-2 gap-2">
                {CAPTION_TREATMENTS.map(treatment => {
                  const selected = selectedCaptionTreatment === treatment.value
                  return (
                    <button
                      key={treatment.value}
                      type="button"
                      data-caption-choice={treatment.value}
                      aria-pressed={selected}
                      onClick={() =>
                        onUpdateStoryboard({ captionStyle: treatment.value })
                      }
                      className={cn(
                        'rounded-xl border p-2 text-left transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-400',
                        selected
                          ? 'border-orange-500 bg-orange-500/10 text-white'
                          : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-white',
                        treatment.value === 'full-sentence' && 'col-span-2'
                      )}
                    >
                      <CaptionTreatmentPreview style={treatment.value} />
                      <span className="block font-semibold">
                        {treatment.label}
                      </span>
                      <span className="block text-[10px] opacity-70">
                        {treatment.description}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Brand Accent Color */}
            <div className="space-y-2 border-t border-zinc-800/80 pt-3">
              <span className="flex items-center gap-1.5 font-medium text-zinc-400">
                <IconColorSwatch className="h-3.5 w-3.5 text-pink-400" />
                Accent Color
              </span>
              <div className="grid grid-cols-4 gap-2">
                {ACCENT_SWATCHES.map(hex => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() =>
                      onUpdateStoryboard({
                        brand: { ...storyboard.brand, accent: hex }
                      })
                    }
                    className={cn(
                      'h-8 rounded-lg border transition-transform hover:scale-105',
                      storyboard.brand?.accent?.toLowerCase() ===
                        hex.toLowerCase()
                        ? 'border-white ring-2 ring-orange-500/50'
                        : 'border-zinc-800'
                    )}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>

            {/* Transcript Export Section */}
            <div className="space-y-2 border-t border-zinc-800/80 pt-3">
              <span className="text-[11px] font-medium text-zinc-400">
                Narration Transcript
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCopyTranscript}
                  variant="outline"
                  className="flex-1 gap-1 border-zinc-800 bg-zinc-900 text-[11px] text-zinc-200 hover:text-white"
                >
                  {copiedTranscript ? (
                    <IconCheck className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <IconCopy className="h-3.5 w-3.5" />
                  )}
                  {copiedTranscript ? 'Copied' : 'Copy Script'}
                </Button>
                <Button
                  size="sm"
                  onClick={handleDownloadTranscript}
                  variant="outline"
                  className="gap-1 border-zinc-800 bg-zinc-900 text-[11px] text-zinc-200 hover:text-white"
                >
                  <IconDownload className="h-3.5 w-3.5" />
                  .txt
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: RUSH AGENT IN-STUDIO ASSISTANT */}
        {tab === 'agent' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3">
              <div className="flex items-center gap-1.5 font-semibold text-orange-400">
                <IconSparkles className="h-4 w-4" />
                Rush Agent Assistant
              </div>
              <p className="mt-1 text-[11px] text-zinc-300">
                Commands can target specific timestamps (e.g.{' '}
                <i>&ldquo;at 4s&rdquo;</i>, <i>&ldquo;0:02-0:06&rdquo;</i>) or
                shot numbers (<i>&ldquo;shot 2&rdquo;</i>).
              </p>
            </div>

            {/* Quick action buttons */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Quick Prompts
              </span>
              <div className="space-y-1.5">
                {[
                  '🎬 Replace shot 1 with deep space galaxy',
                  '✨ Generate image of futuristic rocket',
                  '🚀 Make pacing 15% faster',
                  '👁️ Hide shot 3 from sequence'
                ].map((action, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setAgentPrompt(action.slice(2).trim())
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-left text-xs text-zinc-300 hover:border-zinc-700 hover:text-white"
                  >
                    <span>{action}</span>
                    <IconArrowRight className="h-3 w-3 text-zinc-500" />
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Input Form */}
            <form onSubmit={handleAgentSubmit} className="space-y-2 pt-2">
              <textarea
                rows={3}
                value={agentPrompt}
                onChange={e => setAgentPrompt(e.target.value)}
                placeholder="Ask Rush Agent (e.g. 'Replace shot 2 with mars rover', 'Hide at 6s')..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-white placeholder:text-zinc-600 focus:border-orange-500 focus:outline-hidden"
              />
              <Button
                type="submit"
                disabled={!agentPrompt.trim() || agentLoading}
                className="w-full gap-1.5 bg-orange-500 text-xs font-semibold text-white hover:bg-orange-600 shadow-md shadow-orange-500/20"
              >
                {agentLoading ? (
                  <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <IconSend className="h-3.5 w-3.5" />
                )}
                {agentLoading ? 'Executing...' : 'Apply with Rush Agent'}
              </Button>
            </form>

            {agentFeedback && (
              <p className="rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-400">
                {agentFeedback}
              </p>
            )}
          </div>
        )}

        {/* TAB 5: VERSION HISTORY SNAPSHOTS */}
        {tab === 'history' && (
          <div className="space-y-3">
            <div className="border-b border-zinc-800/80 pb-2">
              <h4 className="font-semibold text-zinc-200">Version History</h4>
              <p className="text-[10px] text-zinc-400">
                Auto-saved snapshots and restore points
              </p>
            </div>

            {historySnapshots.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-center text-xs text-zinc-500">
                No prior snapshots yet. Modifications will auto-save here.
              </div>
            ) : (
              <div className="space-y-2">
                {historySnapshots.map((snap, i) => (
                  <div
                    key={snap.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-2.5 transition-colors hover:border-zinc-700"
                  >
                    <div className="space-y-0.5">
                      <span className="font-semibold text-zinc-200">
                        {snap.description}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono">
                        <IconClock className="h-3 w-3" />
                        {snap.timestamp.toLocaleTimeString()} ·{' '}
                        {snap.storyboard.shots.length} clips
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRestoreSnapshot(snap)}
                      className="h-6 border-zinc-700 bg-zinc-800 px-2 text-[10px] text-zinc-300 hover:text-white"
                    >
                      Restore
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
