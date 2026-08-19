'use client'

import React, { useState } from 'react'

import {
  IconBolt,
  IconCheck,
  IconCut,
  IconDirectionHorizontal,
  IconFlame,
  IconFocus2,
  IconRotateClockwise,
  IconSparkles
} from '@tabler/icons-react'

import { cn } from '@/lib/utils'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'

export type TransitionType =
  | 'crossfade'
  | 'whip-pan'
  | 'zoom-blur'
  | 'slide'
  | 'film-burn'
  | 'cut'

interface TransitionOption {
  id: TransitionType
  name: string
  description: string
  icon: React.ElementType
}

const TRANSITIONS: TransitionOption[] = [
  {
    id: 'crossfade',
    name: 'Crossfade',
    description: 'Smooth dissolve blend between outgoing and incoming clip',
    icon: IconSparkles
  },
  {
    id: 'whip-pan',
    name: 'Whip Pan',
    description: 'Fast horizontal camera sweep for high-energy cuts',
    icon: IconDirectionHorizontal
  },
  {
    id: 'zoom-blur',
    name: 'Zoom Blur',
    description: 'Kinetic push-in blur transition into the next subject',
    icon: IconFocus2
  },
  {
    id: 'slide',
    name: 'Push Slide',
    description: 'Incoming scene pushes the previous frame out of view',
    icon: IconRotateClockwise
  },
  {
    id: 'film-burn',
    name: 'Film Burn / Glitch',
    description: 'Vintage cinematic light leak and RGB glitch pulse',
    icon: IconFlame
  },
  {
    id: 'cut',
    name: 'Hard Cut',
    description: 'Instant zero-frame transition without blend effect',
    icon: IconCut
  }
]

interface VidrushTransitionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shotIndex: number
  currentTransition?: TransitionType
  durationSeconds?: number
  onSaveTransition: (type: TransitionType, duration: number) => void
}

export function VidrushTransitionModal({
  open,
  onOpenChange,
  shotIndex,
  currentTransition = 'crossfade',
  durationSeconds = 0.25,
  onSaveTransition
}: VidrushTransitionModalProps) {
  const [selectedType, setSelectedType] =
    useState<TransitionType>(currentTransition)
  const [duration, setDuration] = useState<number>(durationSeconds)

  const handleApply = () => {
    onSaveTransition(selectedType, selectedType === 'cut' ? 0 : duration)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border/80 bg-[#121216] p-5 text-white shadow-2xl sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-white">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-500/20 text-orange-500">
              <IconBolt className="h-4 w-4" />
            </span>
            <span>Transition: Shot #{shotIndex + 1} ➔ #{shotIndex + 2}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Choose the visual transition and timing between these two scenes.
          </DialogDescription>
        </DialogHeader>

        {/* Transition Options Grid */}
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          {TRANSITIONS.map(item => {
            const Icon = item.icon
            const isSelected = selectedType === item.id

            return (
              <div
                key={item.id}
                onClick={() => setSelectedType(item.id)}
                className={cn(
                  'relative flex cursor-pointer flex-col rounded-xl border p-3 transition-all',
                  isSelected
                    ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500'
                    : 'border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/80'
                )}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg',
                      isSelected
                        ? 'bg-orange-500 text-white'
                        : 'bg-zinc-800 text-zinc-400'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  {isSelected && (
                    <IconCheck className="h-4 w-4 text-orange-400" />
                  )}
                </div>
                <span className="mt-2 text-xs font-semibold text-zinc-200">
                  {item.name}
                </span>
                <span className="line-clamp-2 mt-0.5 text-[10px] text-zinc-400">
                  {item.description}
                </span>
              </div>
            )
          })}
        </div>

        {/* Duration Slider */}
        {selectedType !== 'cut' && (
          <div className="space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-300">
                Transition Length
              </span>
              <Badge
                variant="outline"
                className="border-orange-500/30 bg-orange-500/10 font-mono text-[11px] text-orange-400"
              >
                {duration.toFixed(2)}s
              </Badge>
            </div>
            <Slider
              value={[duration]}
              min={0.1}
              max={0.5}
              step={0.05}
              onValueChange={([val]) => setDuration(val)}
              className="py-1"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="border-zinc-800 bg-transparent text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleApply}
            className="bg-orange-500 text-xs font-semibold text-white hover:bg-orange-600 shadow-md shadow-orange-500/20"
          >
            Apply Transition
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
