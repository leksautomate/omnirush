'use client'

import {
  IconAlertCircle as AlertCircle,
  IconCheck as Check,
  IconChevronDown as ChevronDown,
  IconWaveSine as WaveSine
} from '@tabler/icons-react'

import { toPublicErrorPayload } from '@/lib/errors/public-error'
import type { ToolPart } from '@/lib/types/ai'
import { cn } from '@/lib/utils'

import ProcessHeader from './process-header'

interface SourceAudioSectionProps {
  tool: ToolPart<'sourceAudio'>
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  borderless?: boolean
  isFirst?: boolean
  isLast?: boolean
}

export function SourceAudioSection({
  tool,
  isOpen,
  onOpenChange,
  borderless = false,
  isFirst = false,
  isLast = false
}: SourceAudioSectionProps) {
  const isRunning =
    tool.state === 'input-streaming' || tool.state === 'input-available'
  const output = tool.state === 'output-available' ? tool.output : undefined
  const cue = output?.audioCue
  const kind = tool.input?.kind ?? cue?.kind
  const title =
    output?.title ||
    (kind === 'ambient'
      ? 'Ambience'
      : kind === 'sfx'
        ? 'Sound effect'
        : 'Audio')
  const failed = tool.state === 'output-error'
  const error = failed
    ? toPublicErrorPayload(tool.errorText, {
        fallbackMessage: 'Sound selection failed'
      }).error
    : undefined

  return (
    <div className="relative">
      {borderless && (
        <>
          {!isFirst && (
            <div className="absolute left-[19.5px] top-0 h-2 w-px bg-border" />
          )}
          {!isLast && (
            <div className="absolute bottom-0 left-[19.5px] h-2 w-px bg-border" />
          )}
        </>
      )}
      <div
        className={cn(
          'rounded-lg',
          !borderless && 'border border-border bg-card'
        )}
      >
        <div
          className="flex cursor-pointer select-none items-center gap-2 p-3"
          onClick={() => cue && onOpenChange(!isOpen)}
        >
          <div className="min-w-0 flex-1">
            <ProcessHeader
              onInspect={() => onOpenChange(!isOpen)}
              isLoading={isRunning}
              label={
                <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                  <WaveSine className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{title}</span>
                </div>
              }
              meta={
                cue ? (
                  <>
                    <Check size={16} className="text-green-500" />
                    <span>Added at {cue.start.toFixed(1)}s</span>
                  </>
                ) : failed ? (
                  <>
                    <AlertCircle size={16} className="text-destructive" />
                    <span>{error}</span>
                  </>
                ) : (
                  <span className="animate-pulse">Selecting from catalogue…</span>
                )
              }
            />
          </div>
          {cue && (
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                isOpen && 'rotate-180'
              )}
            />
          )}
        </div>
        {cue && isOpen && (
          <div className="space-y-2 px-4 pb-4">
            <audio controls preload="metadata" src={cue.src} className="w-full" />
            <p className="text-xs text-muted-foreground">
              {cue.credit?.title} by {cue.credit?.creator} · {cue.kind} ·{' '}
              {Math.round(cue.volume * 100)}% volume
            </p>
            {cue.credit && (
              <p className="text-xs text-muted-foreground">
                <a
                  className="underline underline-offset-2"
                  href={cue.credit.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Pixabay source
                </a>{' '}
                ·{' '}
                <a
                  className="underline underline-offset-2"
                  href={cue.credit.licenseUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  licence
                </a>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default SourceAudioSection
