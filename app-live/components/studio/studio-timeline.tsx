'use client'

import React, { useState } from 'react'

import {
  IconArrowLeft,
  IconArrowRight,
  IconClock,
  IconCopy,
  IconMovie,
  IconPhoto,
  IconPlayerPlay,
  IconPlus,
  IconSparkles,
  IconTrash,
  IconUser
} from '@tabler/icons-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import type { Shot } from '@/remotion/schema'

interface StudioTimelineProps {
  shots: Shot[]
  currentFrame: number
  fps: number
  accent: string
  onSeekToShot: (shotIndex: number) => void
  onUpdateShot: (index: number, updated: Partial<Shot>) => void
  onMoveShot: (index: number, direction: 'left' | 'right') => void
  onDuplicateShot: (index: number) => void
  onDeleteShot: (index: number) => void
  onAddShot: () => void
  onOpenAssetPicker: (index: number) => void
}

export function StudioTimeline({
  shots,
  currentFrame,
  fps,
  accent,
  onSeekToShot,
  onUpdateShot,
  onMoveShot,
  onDuplicateShot,
  onDeleteShot,
  onAddShot,
  onOpenAssetPicker
}: StudioTimelineProps) {
  const currentTime = currentFrame / fps
  const [editingNarrationIdx, setEditingNarrationIdx] = useState<number | null>(
    null
  )

  const getActiveShotIndex = () => {
    return shots.findIndex(
      s => currentTime >= s.start && currentTime < s.start + s.duration
    )
  }

  const activeIdx = getActiveShotIndex()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            Storyboard Timeline
          </h3>
          <Badge variant="secondary" className="text-xs font-normal">
            {shots.length} {shots.length === 1 ? 'Shot' : 'Shots'}
          </Badge>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddShot}
          className="h-8 gap-1.5 text-xs font-medium"
        >
          <IconPlus className="h-3.5 w-3.5" />
          Add Shot
        </Button>
      </div>

      {/* Horizontal scrolling timeline container */}
      <div className="flex gap-3 overflow-x-auto pb-3 pt-1">
        {shots.map((shot, idx) => {
          const isActive = idx === activeIdx
          const shotEnd = +(shot.start + shot.duration).toFixed(2)

          return (
            <div
              key={idx}
              className={cn(
                'group relative flex w-64 shrink-0 flex-col rounded-xl border bg-card p-3 shadow-xs transition-all duration-150',
                isActive
                  ? 'border-primary ring-2 ring-primary/30 shadow-md'
                  : 'border-border hover:border-border/80 hover:shadow-xs'
              )}
            >
              {/* Card Header: Index, Badges, Time */}
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground">
                    {idx + 1}
                  </span>
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1 px-1.5 py-0 text-[10px] font-medium capitalize"
                  >
                    {shot.kind === 'video' ? (
                      <IconMovie className="h-2.5 w-2.5 text-blue-500" />
                    ) : shot.kind === 'avatar' || shot.kind === 'a-roll' ? (
                      <IconUser className="h-2.5 w-2.5 text-purple-500" />
                    ) : (
                      <IconPhoto className="h-2.5 w-2.5 text-amber-500" />
                    )}
                    {shot.kind}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                  <IconClock className="h-3 w-3" />
                  <span>
                    {shot.start.toFixed(1)}s - {shotEnd.toFixed(1)}s
                  </span>
                </div>
              </div>

              {/* Visual Thumbnail & Play Trigger */}
              <div className="relative mb-2.5 aspect-video w-full overflow-hidden rounded-lg bg-black/60">
                {shot.src ? (
                  shot.kind === 'video' || shot.src.endsWith('.mp4') ? (
                    <video
                      src={shot.src}
                      muted
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={shot.src}
                      alt={shot.narration || 'Shot thumbnail'}
                      className="h-full w-full object-cover"
                    />
                  )
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{ backgroundColor: accent }}
                  >
                    <span className="text-[10px] font-medium text-white/80">
                      Brand Accent Card
                    </span>
                  </div>
                )}

                {/* Hover overlay with Seek & Replace actions */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    title="Seek preview to this shot"
                    onClick={() => onSeekToShot(idx)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-black shadow-md transition-transform hover:scale-110"
                  >
                    <IconPlayerPlay className="h-4 w-4 fill-black" />
                  </button>
                  <button
                    type="button"
                    title="Replace image or footage"
                    onClick={() => onOpenAssetPicker(idx)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-110"
                  >
                    <IconSparkles className="h-4 w-4" />
                  </button>
                </div>

                {/* Duration Badge */}
                <div className="absolute bottom-1 right-1 rounded-sm bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                  {shot.duration.toFixed(1)}s
                </div>
              </div>

              {/* Editable Narration / Caption */}
              <div className="mb-3 flex-1">
                {editingNarrationIdx === idx ? (
                  <textarea
                    autoFocus
                    rows={2}
                    value={shot.narration || ''}
                    onChange={e =>
                      onUpdateShot(idx, { narration: e.target.value })
                    }
                    onBlur={() => setEditingNarrationIdx(null)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') setEditingNarrationIdx(null)
                    }}
                    className="w-full rounded-md border border-primary bg-background p-1.5 text-xs text-foreground focus:outline-hidden"
                  />
                ) : (
                  <p
                    onClick={() => setEditingNarrationIdx(idx)}
                    title="Click to edit narration caption"
                    className="line-clamp-2 cursor-pointer rounded-md p-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {shot.narration || (
                      <span className="italic text-muted-foreground/60">
                        (No narration text - click to edit)
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Duration Stepper Controls */}
              <div className="mb-2.5 flex items-center justify-between border-t border-border/60 pt-2">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Duration
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateShot(idx, {
                        duration: Math.max(0.5, +(shot.duration - 0.5).toFixed(1))
                      })
                    }
                    className="flex h-5 w-5 items-center justify-center rounded-sm bg-muted text-xs font-bold text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  >
                    -
                  </button>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.2"
                    max="60"
                    value={shot.duration}
                    onChange={e => {
                      const val = parseFloat(e.target.value)
                      if (!isNaN(val) && val > 0) {
                        onUpdateShot(idx, { duration: val })
                      }
                    }}
                    className="h-5 w-12 p-0 text-center font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateShot(idx, {
                        duration: +(shot.duration + 0.5).toFixed(1)
                      })
                    }
                    className="flex h-5 w-5 items-center justify-center rounded-sm bg-muted text-xs font-bold text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between border-t border-border/60 pt-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => onMoveShot(idx, 'left')}
                    title="Move Shot Left"
                    className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                  >
                    <IconArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === shots.length - 1}
                    onClick={() => onMoveShot(idx, 'right')}
                    title="Move Shot Right"
                    className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                  >
                    <IconArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onDuplicateShot(idx)}
                    title="Duplicate Shot"
                    className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <IconCopy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={shots.length <= 1}
                    onClick={() => onDeleteShot(idx)}
                    title="Delete Shot"
                    className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {/* Append New Shot Card */}
        <div
          onClick={onAddShot}
          className="flex w-36 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 p-4 text-center transition-colors hover:border-primary hover:bg-card/70"
        >
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <IconPlus className="h-4 w-4" />
          </div>
          <span className="text-xs font-semibold text-foreground">Add Shot</span>
          <span className="mt-0.5 text-[10px] text-muted-foreground">
            Insert next scene
          </span>
        </div>
      </div>
    </div>
  )
}
