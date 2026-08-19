'use client'

// Multi-Track Timeline implementing Remotion's timeline architecture and VidRush's
// visual aesthetic. Includes smooth draggable ruler scrubbing, clip trimming,
// hide/unhide clips, ghost clip detection, and orange narration tracks.
import React, { useCallback, useEffect, useRef, useState } from 'react'

import {
  IconAlertTriangle,
  IconBolt,
  IconEye,
  IconEyeOff,
  IconMicrophone,
  IconMovie,
  IconMusic,
  IconPlus,
  IconSparkles,
  IconSubtitles,
  IconZoomIn,
  IconZoomOut
} from '@tabler/icons-react'

import { cn } from '@/lib/utils'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import {
  fitPixelsPerSecond,
  MAX_PIXELS_PER_SECOND,
  MIN_FIT_PIXELS_PER_SECOND
} from './timeline-scale'

import type { Shot } from '@/remotion/schema'

const TRACK_HEADER_WIDTH = 144
const TIMELINE_END_PADDING = 24
const MANUAL_ZOOM_STEP = 15

function chooseTickInterval(pixelsPerSecond: number) {
  const intervals = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
  return (
    intervals.find(interval => interval * pixelsPerSecond >= 56) ??
    intervals.at(-1)!
  )
}

function formatTick(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

interface VidrushMultiTrackTimelineProps {
  shots: Shot[]
  currentFrame: number
  fps: number
  totalDurationSec: number
  selectedShotIndex: number
  showTransitions?: boolean
  accent: string
  onSelectShot: (index: number) => void
  onSeekFrame: (frame: number) => void
  onToggleHideShot?: (index: number) => void
  onUpdateShotDuration?: (index: number, newDuration: number) => void
  onOpenTransitionModal: (index: number) => void
  onOpenAssetPicker: (index: number) => void
  onAddShot: () => void
}

export function VidrushMultiTrackTimeline({
  shots,
  currentFrame,
  fps,
  totalDurationSec,
  selectedShotIndex,
  showTransitions = true,
  accent,
  onSelectShot,
  onSeekFrame,
  onToggleHideShot,
  onUpdateShotDuration,
  onOpenTransitionModal,
  onOpenAssetPicker,
  onAddShot
}: VidrushMultiTrackTimelineProps) {
  const rulerRef = useRef<HTMLDivElement>(null)
  const scrollViewportRef = useRef<HTMLDivElement>(null)
  const currentTime = currentFrame / fps

  // Timeline scale: pixels per second (can be zoomed)
  const [manualPixelsPerSecond, setManualPixelsPerSecond] = useState(75)
  const [isFit, setIsFit] = useState(true)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [isScrubbing, setIsScrubbing] = useState(false)

  // Drag-to-trim state
  const [trimmingShotIdx, setTrimmingShotIdx] = useState<number | null>(null)
  const [trimStartX, setTrimStartX] = useState(0)
  const [trimStartDuration, setTrimStartDuration] = useState(0)

  const pixelsPerSecond = isFit
    ? fitPixelsPerSecond(
        totalDurationSec,
        viewportWidth,
        TRACK_HEADER_WIDTH,
        TIMELINE_END_PADDING
      )
    : manualPixelsPerSecond
  const timelinePixelWidth = Math.max(
    MIN_FIT_PIXELS_PER_SECOND,
    totalDurationSec * pixelsPerSecond
  )
  const totalWidth = timelinePixelWidth + TIMELINE_END_PADDING
  const visibleTimelineWidth = Math.max(0, viewportWidth - TRACK_HEADER_WIDTH)
  const overviewWidthPercent = Math.min(
    100,
    (visibleTimelineWidth / timelinePixelWidth) * 100
  )
  const overviewLeftPercent = Math.min(
    100 - overviewWidthPercent,
    Math.max(0, (scrollLeft / timelinePixelWidth) * 100)
  )

  useEffect(() => {
    const viewport = scrollViewportRef.current
    if (!viewport) return

    const measure = () => setViewportWidth(viewport.clientWidth)
    measure()
    window.addEventListener('resize', measure)

    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure)
    observer?.observe(viewport)

    return () => {
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [])

  const fitTimeline = () => {
    setIsFit(true)
    const viewport = scrollViewportRef.current
    if (viewport) {
      viewport.scrollLeft = 0
      setScrollLeft(0)
    }
  }

  useEffect(() => {
    const viewport = scrollViewportRef.current
    const selectedShot = shots[selectedShotIndex]
    if (!viewport || !selectedShot || isFit) return

    const midpoint =
      (selectedShot.start + selectedShot.duration / 2) * pixelsPerSecond
    const maximumScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    const targetScroll = Math.min(
      maximumScroll,
      Math.max(0, midpoint - visibleTimelineWidth / 2)
    )

    if (typeof viewport.scrollTo === 'function') {
      viewport.scrollTo({ left: targetScroll, behavior: 'smooth' })
    } else {
      viewport.scrollLeft = targetScroll
    }
  }, [isFit, pixelsPerSecond, selectedShotIndex, shots, visibleTimelineWidth])

  const changeZoom = (delta: number) => {
    setManualPixelsPerSecond(
      Math.min(
        MAX_PIXELS_PER_SECOND,
        Math.max(MIN_FIT_PIXELS_PER_SECOND, pixelsPerSecond + delta)
      )
    )
    setIsFit(false)
  }

  // Seek helper
  const seekToClientX = useCallback((clientX: number) => {
    if (!rulerRef.current) return
    const rect = rulerRef.current.getBoundingClientRect()
    const clickX = clientX - rect.left
    const targetSeconds = Math.max(
      0,
      Math.min(totalDurationSec, clickX / pixelsPerSecond)
    )
    onSeekFrame(Math.round(targetSeconds * fps))
  }, [fps, onSeekFrame, pixelsPerSecond, totalDurationSec])

  // Handle ruler mouse down (starts scrubbing)
  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsScrubbing(true)
    seekToClientX(e.clientX)
  }

  // Window listeners for mouse drag scrubbing & clip trimming
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isScrubbing) {
        seekToClientX(e.clientX)
      } else if (trimmingShotIdx != null && onUpdateShotDuration) {
        const deltaX = e.clientX - trimStartX
        const deltaSeconds = deltaX / pixelsPerSecond
        const nextDuration = Math.max(
          0.5,
          +(trimStartDuration + deltaSeconds).toFixed(1)
        )
        onUpdateShotDuration(trimmingShotIdx, nextDuration)
      }
    }

    const handleMouseUp = () => {
      setIsScrubbing(false)
      setTrimmingShotIdx(null)
    }

    if (isScrubbing || trimmingShotIdx != null) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [
    isScrubbing,
    trimmingShotIdx,
    trimStartX,
    trimStartDuration,
    pixelsPerSecond,
    totalDurationSec,
    fps,
    seekToClientX,
    onUpdateShotDuration
  ])

  // Playhead needle horizontal position in pixels
  const playheadX = currentTime * pixelsPerSecond

  // Generate ruler tick marks
  const tickInterval = chooseTickInterval(pixelsPerSecond)
  const tickCount = Math.ceil(totalDurationSec / tickInterval) + 1
  const ticks = Array.from(
    { length: tickCount },
    (_, i) => i * tickInterval
  )

  return (
    <div
      data-testid="timeline-root"
      className="flex h-full min-h-0 flex-col overflow-hidden border-t border-zinc-800/80 bg-[#0d0d10] text-white select-none"
    >
      {/* Timeline Controls Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/80 px-4 py-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-semibold text-orange-400">
            {new Date(currentTime * 1000).toISOString().substring(14, 22)}
          </span>
          <span className="text-zinc-600">/</span>
          <span className="font-mono text-xs text-zinc-400">
            {new Date(totalDurationSec * 1000).toISOString().substring(14, 22)}
          </span>
          <Badge
            variant="outline"
            className="border-zinc-800 bg-zinc-900 text-[10px] text-zinc-400"
          >
            {shots.filter(s => !s.hidden).length} Active Clips
          </Badge>
          {shots.some(s => s.hidden) && (
            <Badge
              variant="outline"
              className="border-zinc-700 bg-zinc-800/60 text-[10px] text-zinc-400"
            >
              {shots.filter(s => s.hidden).length} Hidden
            </Badge>
          )}
          <span className="text-[10px] text-zinc-500 italic">
            Drag ruler to scrub · Drag clip edges to trim
          </span>
        </div>

        {/* Zoom & Add Shot Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900/60 p-0.5">
            <button
              type="button"
              aria-label="Fit timeline"
              aria-pressed={isFit}
              onClick={fitTimeline}
              className={cn(
                'rounded-md px-2 py-1 text-[10px] font-semibold transition-colors',
                isFit
                  ? 'bg-orange-500 text-white'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              Fit
            </button>
            <button
              type="button"
              onClick={() => changeZoom(-MANUAL_ZOOM_STEP)}
              title="Zoom Out"
              className="p-1 text-zinc-400 hover:text-white"
            >
              <IconZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => changeZoom(MANUAL_ZOOM_STEP)}
              title="Zoom In"
              className="p-1 text-zinc-400 hover:text-white"
            >
              <IconZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>

          <Button
            size="sm"
            onClick={onAddShot}
            className="h-7 gap-1 bg-orange-500 text-[11px] font-semibold text-white hover:bg-orange-600 shadow-xs shadow-orange-500/20"
          >
            <IconPlus className="h-3 w-3" />
            Add Clip
          </Button>
        </div>
      </div>

      {/* Whole-project overview */}
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-zinc-800/80 bg-zinc-950/70 px-3">
        <span className="w-16 shrink-0 text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">
          Overview
        </span>
        <div
          aria-label="Timeline overview"
          className="relative h-3 flex-1 overflow-hidden rounded-sm border border-zinc-700/80 bg-zinc-900"
        >
          {shots.map((shot, index) => (
            <div
              key={shot.id ?? index}
              className={cn(
                'absolute top-0 bottom-0 border-r border-zinc-950/60',
                shot.hidden ? 'bg-zinc-700/40' : 'bg-orange-500/45'
              )}
              style={{
                left: `${totalDurationSec > 0 ? (shot.start / totalDurationSec) * 100 : 0}%`,
                width: `${totalDurationSec > 0 ? (shot.duration / totalDurationSec) * 100 : 0}%`
              }}
            />
          ))}
          <div
            aria-label="Visible timeline range"
            className="absolute top-0 bottom-0 rounded-xs border border-white/80 bg-white/15 shadow-[0_0_5px_rgba(255,255,255,0.25)]"
            style={{
              left: `${overviewLeftPercent}%`,
              width: `${overviewWidthPercent}%`
            }}
          />
        </div>
      </div>

      {/* Main Multi-Track Scroll Area */}
      <div
        ref={scrollViewportRef}
        data-testid="timeline-scroll-viewport"
        onScroll={event => setScrollLeft(event.currentTarget.scrollLeft)}
        className="relative flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden"
      >
        {/* Track Headers (Left fixed column) */}
        <div className="sticky left-0 z-20 flex w-36 shrink-0 flex-col border-r border-zinc-800/80 bg-[#0f0f13] shadow-md">
          <div className="h-7 border-b border-zinc-800/60 px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            Tracks
          </div>
          {/* Visual Track Header */}
          <div className="flex h-20 items-center gap-2 border-b border-zinc-800/60 px-3 text-xs font-semibold text-zinc-300">
            <IconMovie className="h-4 w-4 text-blue-400" />
            <span>Visuals</span>
          </div>
          {/* Orange Narration Track Header */}
          <div className="flex h-12 items-center gap-2 border-b border-zinc-800/60 px-3 text-xs font-semibold text-orange-400">
            <IconMicrophone className="h-4 w-4" />
            <span>Narration</span>
          </div>
          {/* Subtitles Track Header */}
          <div className="flex h-10 items-center gap-2 border-b border-zinc-800/60 px-3 text-xs font-semibold text-yellow-400">
            <IconSubtitles className="h-4 w-4" />
            <span>Captions</span>
          </div>
          {/* Music Track Header */}
          <div className="flex h-10 items-center gap-2 px-3 text-xs font-semibold text-cyan-400">
            <IconMusic className="h-4 w-4" />
            <span>Music Bed</span>
          </div>
        </div>

        {/* Tracks Timeline Body */}
        <div
          ref={rulerRef}
          data-testid="timeline-track-body"
          onMouseDown={handleRulerMouseDown}
          className="relative shrink-0 cursor-pointer"
          style={{ width: `${totalWidth}px`, minWidth: `${totalWidth}px` }}
        >
          {/* Vertical Draggable Playhead Needle */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-30 flex flex-col items-center transition-all duration-75 ease-linear"
            style={{ transform: `translateX(${playheadX}px)` }}
          >
            {/* Playhead Top Pin */}
            <div className="h-0 w-0 border-x-4 border-x-transparent border-t-6 border-t-orange-500" />
            {/* Red / Orange Vertical Laser Line */}
            <div className="w-[1.5px] flex-1 bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
          </div>

          {/* Time Ruler (Seconds Ticks) */}
          <div className="relative h-7 border-b border-zinc-800/60 bg-zinc-950/40">
            {ticks.map(sec => {
              const left = sec * pixelsPerSecond
              if (left > totalWidth) return null
              return (
                <div
                  key={sec}
                  className="absolute top-0 flex flex-col items-start"
                  style={{ left: `${left}px` }}
                >
                  <span className="pl-1 font-mono text-[9px] text-zinc-500">
                    {formatTick(sec)}
                  </span>
                  <div className="h-2 w-[1px] bg-zinc-800" />
                </div>
              )
            })}
          </div>

          {/* TRACK 1: VISUAL MEDIA STRIP */}
          <div className="relative flex h-20 items-center border-b border-zinc-800/60 bg-zinc-950/20 py-1.5">
            {shots.map((shot, idx) => {
              const left = shot.start * pixelsPerSecond
              const width = Math.max(
                isFit ? 1 : 48,
                shot.duration * pixelsPerSecond
              )
              const isSelected = idx === selectedShotIndex
              const isGhost = !shot.src && !shot.hidden

              return (
                <React.Fragment key={idx}>
                  {/* Clip Box */}
                  <div
                    onClick={e => {
                      e.stopPropagation()
                      onSelectShot(idx)
                      if (!shot.hidden) {
                        onSeekFrame(Math.round(shot.start * fps))
                      }
                    }}
                    className={cn(
                      'group absolute top-1 bottom-1 flex cursor-pointer overflow-hidden rounded-lg border transition-all duration-150',
                      shot.hidden
                        ? 'border-dashed border-zinc-700 bg-zinc-900/30 opacity-40 hover:opacity-75'
                        : isSelected
                          ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/50 shadow-md'
                          : isGhost
                            ? 'border-amber-500/60 bg-amber-500/10 hover:border-amber-500'
                            : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                    )}
                    style={{
                      left: `${left}px`,
                      width: `${width}px`
                    }}
                  >
                    {/* Thumbnail — video-backed shots get a real first-frame preview via
                        <video>; an <img> pointed at a video URL just shows a broken icon.
                        No shot ever carries a separate poster/thumb asset today. */}
                    {shot.src ? (
                      shot.kind === 'photo' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={shot.src}
                          alt="Thumbnail"
                          className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                        />
                      ) : (
                        <video
                          src={shot.src}
                          muted
                          playsInline
                          preload="metadata"
                          className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                        />
                      )
                    ) : (
                      <div
                        className="h-full w-full opacity-60"
                        style={{ backgroundColor: accent }}
                      />
                    )}

                    {/* Ghost Clip Warning */}
                    {isGhost && (
                      <div className="absolute top-1 right-7 flex items-center gap-0.5 rounded-xs bg-amber-500/80 px-1 py-0.5 font-mono text-[8px] font-bold text-black shadow-xs">
                        <IconAlertTriangle className="h-2.5 w-2.5" />
                        GHOST
                      </div>
                    )}

                    {/* Clip Info Overlay */}
                    <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/80 via-transparent to-black/60 p-1 text-[9px]">
                      <div className="flex items-center justify-between">
                        <span className="rounded-xs bg-black/70 px-1 font-bold text-white">
                          #{idx + 1}
                        </span>
                        <span className="font-mono text-zinc-300">
                          {shot.duration.toFixed(1)}s
                        </span>
                      </div>
                      <span className="line-clamp-1 font-medium text-white/90">
                        {shot.narration || shot.kind}
                      </span>
                    </div>

                    {/* Actions Hover Toolbar */}
                    <div className="absolute right-2.5 bottom-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {/* Hide / Unhide Toggle */}
                      {onToggleHideShot && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            onToggleHideShot(idx)
                          }}
                          title={shot.hidden ? 'Unhide Clip' : 'Hide Clip'}
                          className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-800 text-zinc-300 shadow-md hover:bg-zinc-700 hover:text-white"
                        >
                          {shot.hidden ? (
                            <IconEyeOff className="h-3 w-3" />
                          ) : (
                            <IconEye className="h-3 w-3" />
                          )}
                        </button>
                      )}

                      {/* Replace Media Button */}
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          onOpenAssetPicker(idx)
                        }}
                        title="Replace Media"
                        className="flex h-5 w-5 items-center justify-center rounded-md bg-orange-500 text-white shadow-md hover:bg-orange-600"
                      >
                        <IconSparkles className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Drag-to-Trim Right Handle */}
                    {!shot.hidden && (
                      <div
                        onMouseDown={e => {
                          e.stopPropagation()
                          setTrimmingShotIdx(idx)
                          setTrimStartX(e.clientX)
                          setTrimStartDuration(shot.duration)
                        }}
                        title="Drag to trim duration"
                        className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize bg-orange-500/0 transition-colors hover:bg-orange-500/80 group-hover:bg-orange-500/40"
                      />
                    )}
                  </div>

                  {/* Clickable Transition Marker between clips */}
                  {showTransitions && !shot.hidden && idx < shots.length - 1 && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        onOpenTransitionModal(idx)
                      }}
                      title="Edit Transition"
                      className="absolute top-1/2 z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-orange-500/60 bg-[#17171d] text-orange-400 shadow-md transition-transform hover:scale-125 hover:bg-orange-500 hover:text-white"
                      style={{
                        left: `${(shot.start + shot.duration) * pixelsPerSecond}px`
                      }}
                    >
                      <IconBolt className="h-3 w-3" />
                    </button>
                  )}
                </React.Fragment>
              )
            })}
          </div>

          {/* TRACK 2: VIDRUSH SIGNATURE ORANGE NARRATION BLOCKS */}
          <div className="relative h-12 border-b border-zinc-800/60 bg-zinc-950/40 py-1">
            {shots.map((shot, idx) => {
              const left = shot.start * pixelsPerSecond
              const width = Math.max(
                isFit ? 1 : 36,
                shot.duration * pixelsPerSecond
              )
              const wordCount = shot.words?.length || 0

              return (
                <div
                  key={idx}
                  onClick={e => {
                    e.stopPropagation()
                    onSelectShot(idx)
                    if (!shot.hidden) {
                      onSeekFrame(Math.round(shot.start * fps))
                    }
                  }}
                  className={cn(
                    'absolute top-1 bottom-1 flex cursor-pointer items-center justify-between overflow-hidden rounded-md border px-2 text-[10px] font-semibold transition-opacity',
                    shot.hidden
                      ? 'border-dashed border-zinc-700 bg-zinc-900/40 text-zinc-500 opacity-40'
                      : 'border-orange-600/60 bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-xs hover:opacity-90'
                  )}
                  style={{
                    left: `${left}px`,
                    width: `${width}px`
                  }}
                >
                  <span className="line-clamp-1 drop-shadow-xs">
                    {shot.narration || 'Voice narration'}
                  </span>
                  {wordCount > 0 && !shot.hidden && (
                    <span className="shrink-0 rounded-xs bg-black/30 px-1 font-mono text-[9px]">
                      {wordCount}w
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* TRACK 3: SUBTITLES / CAPTIONS TRACK */}
          <div className="relative h-10 border-b border-zinc-800/60 bg-zinc-950/20 py-1">
            {shots
              .filter(s => !s.hidden)
              .map((shot, idx) => {
                const left = shot.start * pixelsPerSecond
                const width = Math.max(
                  isFit ? 1 : 30,
                  shot.duration * pixelsPerSecond
                )

                return (
                  <div
                    key={idx}
                    className="absolute top-1 bottom-1 flex items-center overflow-hidden rounded-sm border border-yellow-600/40 bg-yellow-500/15 px-1.5 font-mono text-[9px] text-yellow-300"
                    style={{
                      left: `${left}px`,
                      width: `${width}px`
                    }}
                  >
                    <span className="line-clamp-1">{shot.narration}</span>
                  </div>
                )
              })}
          </div>

          {/* TRACK 4: BACKGROUND MUSIC BED */}
          <div className="relative h-10 bg-zinc-950/30 py-1">
            <div
              className="absolute top-1 bottom-1 flex items-center rounded-md border border-cyan-600/50 bg-gradient-to-r from-cyan-900/60 via-cyan-800/40 to-cyan-900/60 px-3 text-[10px] font-semibold text-cyan-300 shadow-xs"
              style={{
                left: '0px',
                width: `${totalDurationSec * pixelsPerSecond}px`
              }}
            >
              <span>♫ Background Music Bed (Auto-Ducked)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
