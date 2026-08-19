export const MIN_FIT_PIXELS_PER_SECOND = 0.001
export const MAX_PIXELS_PER_SECOND = 180
export const MIN_TIMELINE_HEIGHT = 320
export const MAX_TIMELINE_HEIGHT = 480

export function fitPixelsPerSecond(
  totalDuration: number,
  viewportWidth: number,
  fixedHeaderWidth: number,
  padding: number
) {
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
    return MAX_PIXELS_PER_SECOND
  }

  const safeViewport = Number.isFinite(viewportWidth)
    ? Math.max(0, viewportWidth)
    : 0
  const safeHeader = Number.isFinite(fixedHeaderWidth)
    ? Math.max(0, fixedHeaderWidth)
    : 0
  const safePadding = Number.isFinite(padding) ? Math.max(0, padding) : 0
  const availableWidth = Math.max(0, safeViewport - safeHeader - safePadding)

  return Math.min(
    MAX_PIXELS_PER_SECOND,
    Math.max(MIN_FIT_PIXELS_PER_SECOND, availableWidth / totalDuration)
  )
}

export function clampTimelineHeight(height: number, viewportHeight: number) {
  const safeViewportHeight = Number.isFinite(viewportHeight)
    ? Math.max(0, viewportHeight)
    : 0
  const viewportMaximum = Math.max(
    MIN_TIMELINE_HEIGHT,
    safeViewportHeight * 0.55
  )
  const maximum = Math.min(MAX_TIMELINE_HEIGHT, viewportMaximum)
  const safeHeight = Number.isFinite(height) ? height : MIN_TIMELINE_HEIGHT

  return Math.min(maximum, Math.max(MIN_TIMELINE_HEIGHT, safeHeight))
}
