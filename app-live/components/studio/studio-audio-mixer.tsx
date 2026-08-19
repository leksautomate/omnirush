'use client'

import React from 'react'

import {
  IconColorSwatch,
  IconMicrophone,
  IconMusic,
  IconVolume,
  IconVolume3
} from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

const PRESET_ACCENTS = [
  '#ff2d55', // Kakkao Crimson
  '#3b82f6', // Electric Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#ffffff' // Pure White
]

interface StudioAudioMixerProps {
  voice?: string
  voiceVolume: number
  onVoiceVolumeChange: (vol: number) => void
  music?: string
  musicVolume: number
  onMusicVolumeChange: (vol: number) => void
  onMusicUrlChange: (url: string) => void
  accent: string
  onAccentChange: (accent: string) => void
}

export function StudioAudioMixer({
  voice,
  voiceVolume,
  onVoiceVolumeChange,
  music,
  musicVolume,
  onMusicVolumeChange,
  onMusicUrlChange,
  accent,
  onAccentChange
}: StudioAudioMixerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 border-border bg-background px-2.5 text-xs font-medium"
        >
          <IconVolume className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Audio & Style</span>
          <span
            className="ml-1 h-2.5 w-2.5 rounded-full border border-black/20"
            style={{ backgroundColor: accent }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 space-y-4 rounded-xl p-4 shadow-xl"
      >
        <div className="border-b border-border pb-2">
          <h4 className="text-xs font-semibold text-foreground">
            Audio Levels & Brand Style
          </h4>
          <p className="text-[11px] text-muted-foreground">
            Adjust track volumes and brand accent color.
          </p>
        </div>

        {/* Voiceover Volume */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <IconMicrophone className="h-3.5 w-3.5 text-blue-500" />
              Voiceover
            </span>
            <span className="text-muted-foreground">
              {Math.round(voiceVolume * 100)}%
            </span>
          </div>
          {voice ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onVoiceVolumeChange(voiceVolume > 0 ? 0 : 1)}
                className="text-muted-foreground hover:text-foreground"
              >
                {voiceVolume === 0 ? (
                  <IconVolume3 className="h-4 w-4 text-destructive" />
                ) : (
                  <IconVolume className="h-4 w-4" />
                )}
              </button>
              <Slider
                value={[voiceVolume]}
                min={0}
                max={1.5}
                step={0.05}
                onValueChange={([val]) => onVoiceVolumeChange(val)}
                className="flex-1"
              />
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">
              No voiceover track on this storyboard.
            </p>
          )}
        </div>

        {/* Background Music Volume */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <IconMusic className="h-3.5 w-3.5 text-emerald-500" />
              Background Music
            </span>
            <span className="text-muted-foreground">
              {Math.round(musicVolume * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onMusicVolumeChange(musicVolume > 0 ? 0 : 0.15)}
              className="text-muted-foreground hover:text-foreground"
            >
              {musicVolume === 0 ? (
                <IconVolume3 className="h-4 w-4 text-destructive" />
              ) : (
                <IconVolume className="h-4 w-4" />
              )}
            </button>
            <Slider
              value={[musicVolume]}
              min={0}
              max={1.0}
              step={0.02}
              onValueChange={([val]) => onMusicVolumeChange(val)}
              className="flex-1"
            />
          </div>
          <Input
            placeholder="Music URL (mp3/wav)..."
            value={music || ''}
            onChange={e => onMusicUrlChange(e.target.value)}
            className="h-7 text-[11px]"
          />
        </div>

        {/* Brand Accent Color */}
        <div className="space-y-2 border-t border-border pt-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <IconColorSwatch className="h-3.5 w-3.5 text-pink-500" />
            Brand Accent Color
          </span>
          <div className="flex items-center gap-1.5">
            {PRESET_ACCENTS.map(hex => (
              <button
                key={hex}
                type="button"
                onClick={() => onAccentChange(hex)}
                className={cn(
                  'h-6 w-6 rounded-full border transition-transform hover:scale-110',
                  accent.toLowerCase() === hex.toLowerCase()
                    ? 'scale-110 border-primary ring-2 ring-primary/40'
                    : 'border-border'
                )}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={accent}
              onChange={e => onAccentChange(e.target.value)}
              placeholder="#ff2d55"
              className="h-7 font-mono text-[11px]"
            />
            <div
              className="h-7 w-8 rounded-md border border-border"
              style={{ backgroundColor: accent }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
