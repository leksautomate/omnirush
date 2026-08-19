'use client'

// The VidRush Studio workstation — full edge-to-edge professional NLE layout matching
// vidrush.ai with multi-track timeline, orange narration blocks, transition markers,
// center preview canvas with floating transport controls, inspector panel,
// auto-save, history snapshots, and ghost-clip detection.
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Player, type PlayerRef } from '@remotion/player'
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBolt,
  IconCheck,
  IconDeviceMobile,
  IconDeviceTv,
  IconDeviceWatch,
  IconDownload,
  IconLoader2,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerSkipBack,
  IconPlayerSkipForward,
  IconRefresh,
  IconRocket
} from '@tabler/icons-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { ResizableTimelinePane } from './studio/resizable-timeline-pane'
import { StudioAssetPicker } from './studio/studio-asset-picker'
import {
  type HistorySnapshot,
  VidrushInspectorPanel
} from './studio/vidrush-inspector-panel'
import { VidrushMultiTrackTimeline } from './studio/vidrush-multi-track-timeline'
import {
  type TransitionType,
  VidrushTransitionModal
} from './studio/vidrush-transition-modal'

import {
  durationInFrames,
  recalculateShotTimings,
  type Shot,
  type StoryboardInput,
  totalSeconds
} from '@/remotion/schema'
import { Storyboard } from '@/remotion/Storyboard'

type Status = 'idle' | 'rendering' | 'done' | 'error'
type AspectRatioKey = '16:9' | '9:16' | '1:1'

const FORMAT_PRESETS: Record<
  AspectRatioKey,
  { width: number; height: number; label: string }
> = {
  '16:9': { width: 1280, height: 720, label: '16:9 Landscape' },
  '9:16': { width: 720, height: 1280, label: '9:16 Vertical (Shorts/Reels)' },
  '1:1': { width: 1080, height: 1080, label: '1:1 Square' }
}

function detectFormatKey(width: number, height: number): AspectRatioKey {
  if (height > width) return '9:16'
  if (width === height) return '1:1'
  return '16:9'
}

export function StudioCanvas({
  id,
  storyboard: initialStoryboard
}: {
  id: string
  storyboard: StoryboardInput
}) {
  const [storyboard, setStoryboard] = useState<StoryboardInput>(() => ({
    ...initialStoryboard,
    shots: recalculateShotTimings(initialStoryboard.shots),
    voiceVolume: initialStoryboard.voiceVolume ?? 1,
    musicVolume: initialStoryboard.musicVolume ?? 0.12,
    showCaptions: initialStoryboard.showCaptions ?? true,
    showSubscribeCta: initialStoryboard.showSubscribeCta ?? true,
    captionStyle:
      initialStoryboard.captionStyle ??
      (initialStoryboard.height > initialStoryboard.width ? 'tiktok' : 'normal')
  }))

  const playerRef = useRef<PlayerRef>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [currentFrame, setCurrentFrame] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [selectedShotIndex, setSelectedShotIndex] = useState(0)
  const [showTransitions, setShowTransitions] = useState(true)

  // Modals state
  const [assetPickerOpen, setAssetPickerOpen] = useState(false)
  const [assetPickerShotIdx, setAssetPickerShotIdx] = useState(0)
  const [transitionModalOpen, setTransitionModalOpen] = useState(false)
  const [transitionShotIdx, setTransitionShotIdx] = useState(0)

  // Auto-Save & History Snapshots state
  const [historySnapshots, setHistorySnapshots] = useState<HistorySnapshot[]>(
    () => [
      {
        id: 'initial',
        timestamp: new Date(),
        description: 'Initial AI Generation',
        storyboard: initialStoryboard
      }
    ]
  )
  const [undoStack, setUndoStack] = useState<StoryboardInput[]>([])
  const [redoStack, setRedoStack] = useState<StoryboardInput[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  // Render State
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | undefined>()
  const [videoFormat, setVideoFormat] = useState<'mp4' | 'webm' | undefined>()
  const [error, setError] = useState<string | undefined>()

  const frames = durationInFrames(storyboard)
  const durationSec = totalSeconds(storyboard)
  const formatKey = detectFormatKey(storyboard.width, storyboard.height)

  // Ghost clip detection: clips that have no source and are not hidden
  const ghostClipsCount = storyboard.shots.filter(
    s => !s.src && !s.hidden
  ).length

  // Synchronize player playback state and current frame
  useEffect(() => {
    const player = playerRef.current
    if (!player) return

    const handleFrameChange = (e: { detail: { frame: number } }) => {
      setCurrentFrame(e.detail.frame)
    }
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    player.addEventListener('frameupdate', handleFrameChange as any)
    player.addEventListener('play', handlePlay)
    player.addEventListener('pause', handlePause)

    return () => {
      player.removeEventListener('frameupdate', handleFrameChange as any)
      player.removeEventListener('play', handlePlay)
      player.removeEventListener('pause', handlePause)
      if (pollRef.current) clearTimeout(pollRef.current)
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [])

  // Auto-Save Debouncer (3 seconds after any change)
  const triggerAutoSave = useCallback(
    (nextState: StoryboardInput) => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = setTimeout(async () => {
        setIsSaving(true)
        try {
          await fetch('/api/studio/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, storyboard: nextState })
          })
          setSavedSuccess(true)
          setTimeout(() => setSavedSuccess(false), 2500)
        } catch (e) {
          console.error('Auto-save error:', e)
        } finally {
          setIsSaving(false)
        }
      }, 3000)
    },
    [id]
  )

  // State updater with history recording
  const updateStoryboardWithHistory = (
    updater: (prev: StoryboardInput) => StoryboardInput,
    description = 'Edit'
  ) => {
    setStoryboard(prev => {
      setUndoStack(u => [...u.slice(-15), prev])
      setRedoStack([])
      const next = updater(prev)
      triggerAutoSave(next)

      // Add snapshot every few meaningful edits
      setHistorySnapshots(h => [
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date(),
          description,
          storyboard: next
        },
        ...h.slice(0, 10)
      ])

      return next
    })
  }

  // Undo Handler
  const handleUndo = () => {
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setUndoStack(u => u.slice(0, -1))
    setRedoStack(r => [...r, storyboard])
    setStoryboard(prev)
    triggerAutoSave(prev)
  }

  // Redo Handler
  const handleRedo = () => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setRedoStack(r => r.slice(0, -1))
    setUndoStack(u => [...u, storyboard])
    setStoryboard(next)
    triggerAutoSave(next)
  }

  // Restore History Snapshot
  const handleRestoreSnapshot = (snapshot: HistorySnapshot) => {
    setUndoStack(u => [...u, storyboard])
    setStoryboard(snapshot.storyboard)
    triggerAutoSave(snapshot.storyboard)
    handleSeekFrame(0)
  }

  // Format Switcher
  const handleFormatChange = (key: AspectRatioKey) => {
    const preset = FORMAT_PRESETS[key]
    updateStoryboardWithHistory(
      prev => ({
        ...prev,
        width: preset.width,
        height: preset.height,
        captionStyle: key === '9:16' ? 'tiktok' : prev.captionStyle
      }),
      `Format ${key}`
    )
  }

  // Shot Updates
  const handleUpdateShot = (index: number, updated: Partial<Shot>) => {
    updateStoryboardWithHistory(
      prev => {
        const nextShots = [...prev.shots]
        nextShots[index] = { ...nextShots[index], ...updated }
        const recalculated =
          updated.duration != null || updated.hidden != null
            ? recalculateShotTimings(nextShots)
            : nextShots
        return { ...prev, shots: recalculated }
      },
      `Shot #${index + 1} edit`
    )
  }

  // Toggle Hide Shot
  const handleToggleHideShot = (index: number) => {
    const shot = storyboard.shots[index]
    if (!shot) return
    handleUpdateShot(index, { hidden: !shot.hidden })
  }

  // Add New Shot
  const handleAddShot = () => {
    updateStoryboardWithHistory(
      prev => {
        const newShot: Shot = {
          kind: 'photo',
          duration: 3.0,
          start: totalSeconds(prev),
          narration: ''
        }
        const nextShots = [...prev.shots, newShot]
        return { ...prev, shots: recalculateShotTimings(nextShots) }
      },
      'Add Clip'
    )
  }

  // Seek Remotion Player to Shot
  const handleSeekToShot = (index: number) => {
    const shot = storyboard.shots[index]
    if (!shot || !playerRef.current) return
    const frame = Math.round(shot.start * storyboard.fps)
    playerRef.current.seekTo(frame)
    setSelectedShotIndex(index)
  }

  // Seek to specific frame
  const handleSeekFrame = (frame: number) => {
    if (!playerRef.current) return
    playerRef.current.seekTo(frame)
    const time = frame / storyboard.fps
    const activeIdx = storyboard.shots.findIndex(
      s => time >= s.start && time < s.start + s.duration
    )
    if (activeIdx !== -1) setSelectedShotIndex(activeIdx)
  }

  // Toggle Play / Pause
  const handleTogglePlay = () => {
    if (!playerRef.current) return
    if (isPlaying) {
      playerRef.current.pause()
    } else {
      playerRef.current.play()
    }
  }

  // Step frames (1 second forward or back)
  const handleStepSeconds = (deltaSeconds: number) => {
    if (!playerRef.current) return
    const targetFrame = Math.max(
      0,
      Math.min(frames, currentFrame + Math.round(deltaSeconds * storyboard.fps))
    )
    handleSeekFrame(targetFrame)
  }

  // Magic Reset (Revert to initial AI generation)
  const handleMagicReset = () => {
    updateStoryboardWithHistory(
      () => ({
        ...initialStoryboard,
        shots: recalculateShotTimings(initialStoryboard.shots),
        voiceVolume: initialStoryboard.voiceVolume ?? 1,
        musicVolume: initialStoryboard.musicVolume ?? 0.12,
        showCaptions: true,
        showSubscribeCta: true
      }),
      'Reset Timeline'
    )
    handleSeekFrame(0)
  }

  // Manual Save Storyboard to KV
  const handleManualSave = async () => {
    setIsSaving(true)
    setSavedSuccess(false)
    try {
      const res = await fetch('/api/studio/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, storyboard })
      })
      if (!res.ok) throw new Error('Save failed')
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3000)
    } catch (e) {
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }

  // In-Browser Client-Side Render (Zero AWS required).
  // Remotion's <Player> renders to DOM, not a <canvas>, so this can only
  // actually capture a video when the composition itself paints onto a
  // canvas element. Otherwise there is nothing to record client-side —
  // surface that honestly instead of faking progress and handing back a
  // JSON file with a "Download MP4" label.
  const renderInBrowser = useCallback(async () => {
    setStatus('rendering')
    setProgress(0)
    setError(undefined)
    setVideoUrl(undefined)
    setVideoFormat(undefined)

    const player = playerRef.current
    if (!player) {
      setStatus('error')
      setError('Player not initialized')
      return
    }

    try {
      player.pause()
      player.seekTo(0)

      const container = document.querySelector('canvas')
      if (!(container instanceof HTMLCanvasElement)) {
        throw new Error(
          'In-browser export is unavailable for this preview (it renders via DOM, not canvas). Configure Remotion Lambda to export an MP4 — see ENV.md.'
        )
      }

      const mimeType = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
      ].find(type => MediaRecorder.isTypeSupported(type))
      if (!mimeType) {
        throw new Error('This browser does not support in-browser video recording.')
      }

      const stream = container.captureStream(storyboard.fps)
      const chunks: Blob[] = []
      const recorder = new MediaRecorder(stream, { mimeType })
      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      const recordingDone = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
        recorder.onerror = () => reject(new Error('Recording failed'))
      })

      recorder.start()
      player.play()

      const startTime = performance.now()
      const durationMs = durationSec * 1000
      await new Promise<void>(resolve => {
        const tick = () => {
          const elapsed = performance.now() - startTime
          setProgress(Math.min(99, Math.round((elapsed / durationMs) * 100)))
          if (elapsed >= durationMs) {
            resolve()
          } else {
            requestAnimationFrame(tick)
          }
        }
        requestAnimationFrame(tick)
      })

      player.pause()
      recorder.stop()
      const blob = await recordingDone

      setProgress(100)
      setStatus('done')
      setVideoFormat('webm')
      setVideoUrl(URL.createObjectURL(blob))
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'In-browser render failed')
    }
  }, [durationSec, storyboard.fps])

  // Render Handler (Lambda with graceful In-Browser Fallback)
  const render = useCallback(async () => {
    setStatus('rendering')
    setProgress(0)
    setError(undefined)
    setVideoUrl(undefined)
    setVideoFormat(undefined)
    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, inputProps: storyboard })
      })
      const data = await res.json()

      // If Lambda is not configured on AWS, run In-Browser local export!
      if (!res.ok) {
        if (data.lambdaConfigured === false || data.error?.includes('not configured')) {
          console.log('Lambda not configured; switching to In-Browser Export fallback...')
          return renderInBrowser()
        }
        throw new Error(data.error || 'Failed to start render')
      }

      const { renderId, bucketName } = data as {
        renderId: string
        bucketName: string
      }
      const poll = async () => {
        const r = await fetch(
          `/api/render?renderId=${encodeURIComponent(renderId)}&bucketName=${encodeURIComponent(bucketName)}`
        )
        const p = await r.json()
        if (!r.ok) throw new Error(p.error || 'Progress check failed')
        setProgress(p.progress ?? 0)
        if (p.error) {
          setStatus('error')
          setError(p.error)
          return
        }
        if (p.done) {
          setStatus('done')
          setVideoFormat('mp4')
          setVideoUrl(p.url)
          return
        }
        pollRef.current = setTimeout(poll, 2000)
      }
      poll()
    } catch (e) {
      // Fallback to in-browser render
      console.warn('Lambda render attempt failed, running in-browser export:', e)
      renderInBrowser()
    }
  }, [id, renderInBrowser, storyboard])

  const rendering = status === 'rendering'

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full flex-col overflow-hidden bg-[#0a0a0d] text-white">
      {/* 1. TOP CONTROL BAR (VidRush Header) */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800/80 bg-[#111115] px-4">
        {/* Left: Project title & Branding */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-tr from-orange-600 to-amber-500 font-black text-white text-xs shadow-md shadow-orange-500/20">
              V
            </span>
            <span className="font-bold tracking-tight text-sm text-zinc-100">
              VidRush Studio
            </span>
          </div>
          <span className="text-zinc-700">|</span>
          <span className="text-xs text-zinc-400 font-mono">
            {storyboard.shots.filter(s => !s.hidden).length} active shots ·{' '}
            {durationSec.toFixed(1)}s
          </span>

          {/* Undo / Redo controls */}
          <div className="ml-2 flex items-center rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
            <button
              type="button"
              disabled={undoStack.length === 0}
              onClick={handleUndo}
              title="Undo (Ctrl + Z)"
              className="p-1 text-zinc-400 hover:text-white disabled:opacity-30"
            >
              <IconArrowBackUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={redoStack.length === 0}
              onClick={handleRedo}
              title="Redo (Ctrl + Y)"
              className="p-1 text-zinc-400 hover:text-white disabled:opacity-30"
            >
              <IconArrowForwardUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Center: Format Switcher & Transitions Global Toggle */}
        <div className="flex items-center gap-3">
          {/* 16:9 / 9:16 / 1:1 Aspect Ratio Pills */}
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
            <button
              type="button"
              onClick={() => handleFormatChange('16:9')}
              title="16:9 Landscape (YouTube)"
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                formatKey === '16:9'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <IconDeviceTv className="h-3.5 w-3.5" />
              16:9
            </button>
            <button
              type="button"
              onClick={() => handleFormatChange('9:16')}
              title="9:16 Vertical (Shorts/TikTok)"
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                formatKey === '9:16'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <IconDeviceMobile className="h-3.5 w-3.5" />
              9:16
            </button>
            <button
              type="button"
              onClick={() => handleFormatChange('1:1')}
              title="1:1 Square (Instagram)"
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                formatKey === '1:1'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <IconDeviceWatch className="h-3.5 w-3.5" />
              1:1
            </button>
          </div>

          {/* Show Transitions Toggle */}
          <button
            type="button"
            onClick={() => setShowTransitions(!showTransitions)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
              showTransitions
                ? 'border-orange-500/40 bg-orange-500/10 text-orange-400'
                : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <IconBolt className="h-3.5 w-3.5" />
            <span>Transitions</span>
          </button>
        </div>

        {/* Right: Magic Reset, Save, and Render Button */}
        <div className="flex items-center gap-2">
          {/* Magic Reset */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMagicReset}
            title="Revert to original AI generation"
            className="h-8 gap-1 px-2.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <IconRefresh className="h-3.5 w-3.5" />
            Reset
          </Button>

          {/* Save / Auto-saved Indicator */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualSave}
            disabled={isSaving}
            className="h-8 gap-1 border-zinc-800 bg-zinc-900 text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-white"
          >
            {isSaving ? (
              <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
            ) : savedSuccess ? (
              <IconCheck className="h-3.5 w-3.5 text-emerald-400" />
            ) : null}
            {isSaving ? 'Saving...' : savedSuccess ? 'Auto-Saved' : 'Save'}
          </Button>

          {/* Download Button */}
          {status === 'done' && videoUrl && (
            <a
              href={videoUrl}
              download={`${id}.${videoFormat ?? 'mp4'}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-8 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/20 px-3 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30"
            >
              <IconDownload className="h-3.5 w-3.5" />
              Download {videoFormat === 'webm' ? 'WebM' : 'MP4'}
            </a>
          )}

          {/* Render on Lambda */}
          <Button
            onClick={render}
            disabled={rendering}
            size="sm"
            className="h-8 gap-1.5 bg-gradient-to-r from-orange-500 to-amber-600 px-3.5 text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-700 disabled:opacity-60"
          >
            {rendering ? (
              <>
                <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                Rendering {progress}%
              </>
            ) : (
              <>
                <IconRocket className="h-3.5 w-3.5" />
                Render MP4
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Ghost Clip Warning Bar */}
      {ghostClipsCount > 0 && (
        <div className="flex items-center justify-between border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <IconAlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              <b>Ghost Clip Alert:</b> {ghostClipsCount} scene(s) have solid card
              fallbacks. Click replace to add footage or AI stills before rendering.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const ghostIdx = storyboard.shots.findIndex(
                s => !s.src && !s.hidden
              )
              if (ghostIdx !== -1) {
                setAssetPickerShotIdx(ghostIdx)
                setAssetPickerOpen(true)
              }
            }}
            className="h-6 border-amber-500/40 bg-amber-500/20 text-[10px] text-amber-200 hover:bg-amber-500/30"
          >
            Fix First Ghost Clip
          </Button>
        </div>
      )}

      {/* 2. CENTER WORKSPACE (Player + Right Inspector Side-by-Side) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main Stage: Player Preview */}
        <main className="relative flex flex-1 flex-col items-center justify-center bg-[#070709] p-4 overflow-hidden">
          {/* Remotion Canvas Container */}
          <div
            className="relative flex items-center justify-center overflow-hidden rounded-xl border border-zinc-800/80 bg-black shadow-2xl"
            style={{
              width: '100%',
              maxWidth: formatKey === '9:16' ? '380px' : '720px',
              maxHeight: 'calc(100vh - 22rem)',
              aspectRatio: `${storyboard.width} / ${storyboard.height}`
            }}
          >
            <Player
              ref={playerRef}
              component={Storyboard}
              inputProps={storyboard}
              durationInFrames={frames}
              fps={storyboard.fps}
              compositionWidth={storyboard.width}
              compositionHeight={storyboard.height}
              style={{ width: '100%', height: '100%' }}
              controls={false}
              acknowledgeRemotionLicense
            />
          </div>

          {/* Floating Transport Control Bar */}
          <div className="mt-3 flex items-center gap-3 rounded-full border border-zinc-800/80 bg-zinc-950/90 px-4 py-1.5 shadow-xl backdrop-blur-md">
            <button
              type="button"
              onClick={() => handleStepSeconds(-1)}
              title="Step back 1s"
              className="text-zinc-400 hover:text-white"
            >
              <IconPlayerSkipBack className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleTogglePlay}
              title={isPlaying ? 'Pause' : 'Play'}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-white shadow-md shadow-orange-500/30 transition-transform hover:scale-110"
            >
              {isPlaying ? (
                <IconPlayerPause className="h-4 w-4 fill-current" />
              ) : (
                <IconPlayerPlay className="h-4 w-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleStepSeconds(1)}
              title="Step forward 1s"
              className="text-zinc-400 hover:text-white"
            >
              <IconPlayerSkipForward className="h-4 w-4" />
            </button>

            <span className="text-zinc-700">|</span>

            {/* Timecode display */}
            <span className="font-mono text-xs font-semibold text-zinc-200">
              {new Date((currentFrame / storyboard.fps) * 1000)
                .toISOString()
                .substring(14, 22)}{' '}
              /{' '}
              {new Date(durationSec * 1000).toISOString().substring(14, 22)}
            </span>
          </div>

          {/* Render Progress Banner */}
          {rendering && (
            <div className="absolute bottom-4 left-4 right-4 z-40 rounded-xl border border-orange-500/30 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-md">
              <div className="flex justify-between text-xs font-semibold text-orange-400">
                <span>Rendering across AWS Lambda...</span>
                <span className="font-mono">{progress}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full bg-orange-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="absolute bottom-4 left-4 right-4 z-40 flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <IconAlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </main>

        {/* Right Inspector & Rush Agent Side Panel */}
        <VidrushInspectorPanel
          selectedShotIndex={selectedShotIndex}
          storyboard={storyboard}
          historySnapshots={historySnapshots}
          onUpdateShot={handleUpdateShot}
          onOpenAssetPicker={idx => {
            setAssetPickerShotIdx(idx)
            setAssetPickerOpen(true)
          }}
          onUpdateStoryboard={updated =>
            updateStoryboardWithHistory(
              prev => ({ ...prev, ...updated }),
              'Style edit'
            )
          }
          onSeekToShot={handleSeekToShot}
          onRestoreSnapshot={handleRestoreSnapshot}
        />
      </div>

      {/* 3. BOTTOM MULTI-TRACK TIMELINE (VidRush Signature Timeline) */}
      <ResizableTimelinePane>
        <VidrushMultiTrackTimeline
          shots={storyboard.shots}
          currentFrame={currentFrame}
          fps={storyboard.fps}
          totalDurationSec={durationSec}
          selectedShotIndex={selectedShotIndex}
          showTransitions={showTransitions}
          accent={storyboard.brand?.accent || '#ff6b00'}
          onSelectShot={setSelectedShotIndex}
          onSeekFrame={handleSeekFrame}
          onToggleHideShot={handleToggleHideShot}
          onUpdateShotDuration={(idx, dur) =>
            handleUpdateShot(idx, { duration: dur })
          }
          onOpenTransitionModal={idx => {
            setTransitionShotIdx(idx)
            setTransitionModalOpen(true)
          }}
          onOpenAssetPicker={idx => {
            setAssetPickerShotIdx(idx)
            setAssetPickerOpen(true)
          }}
          onAddShot={handleAddShot}
        />
      </ResizableTimelinePane>

      {/* Asset Picker Modal */}
      {storyboard.shots[assetPickerShotIdx] && (
        <StudioAssetPicker
          open={assetPickerOpen}
          onOpenChange={setAssetPickerOpen}
          shotIndex={assetPickerShotIdx}
          shot={storyboard.shots[assetPickerShotIdx]}
          onSelectAsset={asset => {
            handleUpdateShot(assetPickerShotIdx, {
              src: asset.src,
              kind: asset.kind
            })
          }}
        />
      )}

      {/* Transition Picker Modal */}
      <VidrushTransitionModal
        key={`${transitionShotIdx}-${transitionModalOpen}`}
        open={transitionModalOpen}
        onOpenChange={setTransitionModalOpen}
        shotIndex={transitionShotIdx}
        currentTransition={
          storyboard.shots[transitionShotIdx]?.transitionOut?.type
        }
        durationSeconds={
          storyboard.shots[transitionShotIdx]?.transitionOut?.duration
        }
        onSaveTransition={(type: TransitionType, duration: number) => {
          handleUpdateShot(transitionShotIdx, {
            transitionOut: { type, duration }
          })
        }}
      />
    </div>
  )
}

export default StudioCanvas
