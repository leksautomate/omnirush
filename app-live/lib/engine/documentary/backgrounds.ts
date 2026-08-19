import type { DocumentaryBackgroundId } from './schema'

export interface DocumentaryBackgroundDefinition {
  id: DocumentaryBackgroundId
  src: string
  role: 'dark-sepia' | 'archival-parchment' | 'film-gate' | 'tactical-grid'
  label: string
  muted: true
  fit: 'cover'
  opacity?: number
}

export const DOCUMENTARY_BACKGROUNDS = {
  bg1: {
    id: 'bg1',
    src: '/documentary/backgrounds/bg1.mp4',
    role: 'dark-sepia',
    label: 'Dark sepia',
    muted: true,
    fit: 'cover'
  },
  bg2: {
    id: 'bg2',
    src: '/documentary/backgrounds/bg2.mp4',
    role: 'archival-parchment',
    label: 'Archival parchment',
    muted: true,
    fit: 'cover'
  },
  bg3: {
    id: 'bg3',
    src: '/documentary/backgrounds/bg3.mp4',
    role: 'film-gate',
    label: 'Film gate',
    muted: true,
    fit: 'cover',
    opacity: 0.24
  },
  bg4: {
    id: 'bg4',
    src: '/documentary/backgrounds/bg4.mp4',
    role: 'tactical-grid',
    label: 'Tactical grid',
    muted: true,
    fit: 'cover'
  }
} as const satisfies Record<
  DocumentaryBackgroundId,
  DocumentaryBackgroundDefinition
>

export function getDocumentaryBackground(
  id: DocumentaryBackgroundId
): DocumentaryBackgroundDefinition {
  return DOCUMENTARY_BACKGROUNDS[id]
}
