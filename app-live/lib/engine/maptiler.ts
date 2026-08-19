// Real-location resolution for the "animated-map" shot overlay (RealSatelliteMap.tsx).
// Uses the MapTiler client key (safe to expose — MapTiler's NEXT_PUBLIC_* key is meant
// for browser use and is domain-restricted from the MapTiler dashboard), so this can run
// directly in the Studio editor with no server round-trip.

export interface GeoPoint {
  lon: number
  lat: number
}

function apiKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY || process.env.MAPTILER_API_KEY
  )?.trim()
}

export function maptilerConfigured(): boolean {
  return Boolean(apiKey())
}

/** Resolves a free-text place name (e.g. "Normandy") to real coordinates via MapTiler Geocoding. */
export async function geocodePlace(query: string): Promise<GeoPoint | null> {
  const key = apiKey()
  const trimmed = query.trim()
  if (!key || !trimmed) return null

  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(trimmed)}.json?key=${key}&limit=1`
  const res = await fetch(url)
  if (!res.ok) return null

  const data = await res.json()
  const center = data?.features?.[0]?.center
  if (!Array.isArray(center) || center.length !== 2) return null
  return { lon: center[0], lat: center[1] }
}

/** Builds a real MapTiler satellite static-image URL framing both points with a flight path drawn between them. */
export function buildSatelliteMapUrl({
  from,
  to,
  width = 1280,
  height = 720,
  accent = '#ff6b00'
}: {
  from: GeoPoint
  to: GeoPoint
  width?: number
  height?: number
  accent?: string
}): string | null {
  const key = apiKey()
  if (!key) return null

  const color = `0x${accent.replace('#', '')}`
  const path = `stroke:${color}|width:3|${from.lon},${from.lat}|${to.lon},${to.lat}`
  return `https://api.maptiler.com/maps/satellite/static/auto/${width}x${height}@2x.png?path=${encodeURIComponent(path)}&key=${key}`
}

/**
 * Builds a real MapTiler satellite static-image URL centered and zoomed on a single point —
 * for a biography/true-crime "this is the place" zoom-in, as opposed to the two-point
 * flight path in buildSatelliteMapUrl. zoom 13 reads as a town/neighborhood-level view.
 */
export function buildSingleLocationMapUrl({
  point,
  width = 1280,
  height = 720,
  zoom = 13
}: {
  point: GeoPoint
  width?: number
  height?: number
  zoom?: number
}): string | null {
  const key = apiKey()
  if (!key) return null

  return `https://api.maptiler.com/maps/satellite/static/${point.lon},${point.lat},${zoom}/${width}x${height}@2x.png?key=${key}`
}

/**
 * Confirms a built static-map URL actually returns an image before the app treats it as
 * "resolved" — a free-tier MapTiler key can reject the Static Maps product with a 403
 * (Content-Type: image/png error graphic, correct status) even though geocoding on the
 * same key succeeds, so success can't be assumed just because a URL was built. Checked
 * with HEAD since MapTiler sends CORS: * on this endpoint.
 */
export async function verifyMapImageUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

/** Formats a coordinate as the "51.51° N, 0.13° W" style readout used by the tactical HUD. */
export function formatCoordsText({ lon, lat }: GeoPoint): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lonDir = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`
}
