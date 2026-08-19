'use client'

import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconMovie
} from '@tabler/icons-react'

import { toPublicErrorPayload } from '@/lib/errors/public-error'
import type { ToolPart } from '@/lib/types/ai'
import { cn } from '@/lib/utils'

import ProcessHeader from './process-header'

interface DocumentarySectionProps {
  tool: ToolPart<'prepareDocumentary'>
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  borderless?: boolean
  isFirst?: boolean
  isLast?: boolean
}

export default function DocumentarySection({
  tool,
  isOpen,
  onOpenChange,
  borderless = false,
  isFirst = false,
  isLast = false
}: DocumentarySectionProps) {
  const input = tool.input
  const isRunning =
    tool.state === 'input-streaming' || tool.state === 'input-available'
  const output = tool.state === 'output-available' ? tool.output : undefined
  const failed = tool.state === 'output-error'
  const error = failed
    ? toPublicErrorPayload(tool.errorText, {
        fallbackMessage: 'Documentary preparation failed'
      }).error
    : undefined
  const title = input?.topic?.trim() || 'Supplied documentary script'

  return (
    <div className="relative">
      {borderless ? (
        <>
          {!isFirst ? (
            <div className="absolute left-[19.5px] top-0 h-2 w-px bg-border" />
          ) : null}
          {!isLast ? (
            <div className="absolute bottom-0 left-[19.5px] h-2 w-px bg-border" />
          ) : null}
        </>
      ) : null}
      <div
        className={cn(
          'rounded-lg',
          !borderless && 'border border-border bg-card'
        )}
      >
        <div
          className="flex cursor-pointer select-none items-center gap-2 p-3"
          onClick={() => output && onOpenChange(!isOpen)}
        >
          <div className="min-w-0 flex-1">
            <ProcessHeader
              onInspect={() => onOpenChange(!isOpen)}
              isLoading={isRunning}
              label={
                <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                  <IconMovie className="h-4 w-4 shrink-0 text-amber-500" />
                  <span className="block min-w-0 max-w-full truncate">
                    WWII documentary — {title}
                  </span>
                </div>
              }
              meta={
                output ? (
                  <>
                    {output.publishReady ? (
                      <IconCheck size={16} className="text-green-500" />
                    ) : (
                      <IconAlertTriangle size={16} className="text-amber-500" />
                    )}
                    <span>
                      {output.chapterCount} chapters · {output.targetMinutes}{' '}
                      min · {output.publishReady ? ' ready' : ' needs review'}
                    </span>
                  </>
                ) : failed ? (
                  <>
                    <IconAlertTriangle size={16} className="text-destructive" />
                    <span>{error}</span>
                  </>
                ) : (
                  <span className="animate-pulse">
                    Building research, chapters and evidence…
                  </span>
                )
              }
            />
          </div>
          {output ? (
            <IconChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                isOpen && 'rotate-180'
              )}
            />
          ) : null}
        </div>

        {output && isOpen ? (
          <div className="space-y-3 px-4 pb-4 text-sm">
            <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-3">
              <div>
                <div className="text-xs text-muted-foreground">Input</div>
                <div className="font-medium capitalize">{output.inputMode}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Project ID</div>
                <div className="truncate font-mono text-xs">
                  {output.documentaryId}
                </div>
              </div>
            </div>
            {output.issues.length ? (
              <div className="space-y-1.5">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Editorial review
                </div>
                {output.issues.map((issue, index) => (
                  <div
                    key={`${issue.code}-${index}`}
                    className={cn(
                      'rounded-md p-2 text-xs',
                      issue.severity === 'blocking'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    )}
                  >
                    <span className="font-semibold">{issue.code}:</span>{' '}
                    {issue.message}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <IconCheck className="h-4 w-4" /> Research and editorial checks
                passed.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
