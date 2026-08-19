'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

import {
  clampTimelineHeight,
  MAX_TIMELINE_HEIGHT,
  MIN_TIMELINE_HEIGHT
} from './timeline-scale'

export const DEFAULT_TIMELINE_HEIGHT = 336

export function ResizableTimelinePane({ children }: { children: ReactNode }) {
  const resizeStartRef = useRef<{
    clientY: number
    height: number
  } | null>(null)
  const [height, setHeight] = useState(() =>
    clampTimelineHeight(
      DEFAULT_TIMELINE_HEIGHT,
      typeof window === 'undefined' ? 1000 : window.innerHeight
    )
  )
  const [isResizing, setIsResizing] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      setHeight(current => clampTimelineHeight(current, window.innerHeight))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (event: MouseEvent) => {
      const start = resizeStartRef.current
      if (!start) return
      setHeight(
        clampTimelineHeight(
          start.height + start.clientY - event.clientY,
          window.innerHeight
        )
      )
    }
    const handleMouseUp = () => {
      resizeStartRef.current = null
      setIsResizing(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  return (
    <>
      <div
        role="separator"
        aria-label="Resize timeline"
        aria-orientation="horizontal"
        aria-valuemin={MIN_TIMELINE_HEIGHT}
        aria-valuemax={MAX_TIMELINE_HEIGHT}
        aria-valuenow={height}
        tabIndex={0}
        onMouseDown={event => {
          resizeStartRef.current = {
            clientY: event.clientY,
            height
          }
          setIsResizing(true)
        }}
        onDoubleClick={() =>
          setHeight(
            clampTimelineHeight(DEFAULT_TIMELINE_HEIGHT, window.innerHeight)
          )
        }
        onKeyDown={event => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
          event.preventDefault()
          const delta = event.key === 'ArrowUp' ? 16 : -16
          setHeight(current =>
            clampTimelineHeight(current + delta, window.innerHeight)
          )
        }}
        className={cn(
          'group relative h-2 shrink-0 cursor-row-resize border-y border-zinc-800 bg-zinc-950 outline-hidden focus-visible:border-orange-500',
          isResizing && 'border-orange-500 bg-orange-500/10'
        )}
      >
        <div className="absolute top-1/2 left-1/2 h-0.5 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-700 transition-colors group-hover:bg-orange-500 group-focus-visible:bg-orange-500" />
      </div>
      <div
        data-testid="timeline-pane-content"
        className="min-h-0 shrink-0"
        style={{ height: `${height}px` }}
      >
        {children}
      </div>
    </>
  )
}
