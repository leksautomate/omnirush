import React from 'react'

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('remotion', () => ({
  AbsoluteFill: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div {...props}>{children}</div>
  ),
  Loop: ({ children }: React.PropsWithChildren) => <>{children}</>,
  Img: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt ?? ''} {...props} />
  ),
  OffthreadVideo: (props: React.VideoHTMLAttributes<HTMLVideoElement>) => (
    <video {...props} />
  ),
  staticFile: (src: string) => `/${src}`.replaceAll('//', '/'),
  useCurrentFrame: () => 45,
  useVideoConfig: () => ({ fps: 30, width: 1920, height: 1080 }),
  interpolate: (
    value: number,
    input: number[],
    output: Array<number | string>
  ) => (value >= input.at(-1)! ? output.at(-1) : output[0]),
  spring: () => 1
}))

import { ArchivalPhotoTreatment } from '../ArchivalPhotoTreatment'
import { DocumentaryBackground } from '../DocumentaryBackground'
import { DocumentaryGraphic } from '../DocumentaryGraphic'
import { DocumentaryGraphicBoundary } from '../DocumentaryGraphicBoundary'

const claimIds = ['claim-1']

function ThrowingGraphic(): React.ReactNode {
  throw new Error('overlay failed')
}

describe('documentary graphics', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it.each([
    [
      'date-location',
      {
        type: 'date-location',
        date: 'JUNE 1942',
        location: 'MIDWAY ATOLL',
        backgroundId: 'bg1'
      },
      'JUNE 1942'
    ],
    [
      'battle-map',
      {
        type: 'battle-map',
        theatre: 'MIDWAY ATOLL',
        units: [],
        routes: [],
        frontLines: [],
        objectives: [],
        annotations: [],
        backgroundId: 'bg4'
      },
      'MIDWAY ATOLL'
    ],
    [
      'military-timeline',
      {
        type: 'military-timeline',
        events: [
          {
            id: 'event-1',
            date: 'May 30',
            title: 'Yorktown repaired',
            importance: 'critical',
            claimIds
          }
        ],
        backgroundId: 'bg2'
      },
      'Yorktown repaired'
    ],
    [
      'force-comparison',
      {
        type: 'force-comparison',
        sides: [
          { name: 'US Task Forces', allegiance: 'allied', claimIds },
          { name: 'First Air Fleet', allegiance: 'axis', claimIds }
        ],
        backgroundId: 'bg4'
      },
      'First Air Fleet'
    ],
    [
      'equipment-spec',
      {
        type: 'equipment-spec',
        name: 'Mitsubishi A6M2 Zero',
        role: 'Carrier fighter',
        specifications: [
          { label: 'Top speed', value: 331, unit: 'mph', claimId: 'claim-1' }
        ],
        backgroundId: 'bg4'
      },
      'Mitsubishi A6M2 Zero'
    ],
    [
      'evidence-card',
      {
        type: 'evidence-card',
        documentTitle: 'Station HYPO',
        institution: 'US Navy',
        excerpt: 'AF is short of water.',
        citationId: 'citation-1',
        sourceUrl: 'https://www.history.navy.mil/midway',
        backgroundId: 'bg2'
      },
      'Station HYPO'
    ],
    [
      'statistics',
      {
        type: 'statistics',
        title: 'Carrier losses',
        display: 'counter',
        values: [{ label: 'carriers', value: 4, claimId: 'claim-1' }],
        backgroundId: 'bg4'
      },
      '4 carriers'
    ]
  ] as const)('renders %s data', (_type, graphic, expectedText) => {
    render(
      <DocumentaryGraphic graphic={graphic as never} durationInFrames={180} />
    )
    expect(screen.getByText(expectedText)).toBeInTheDocument()
  })

  it('always mutes documentary background video', () => {
    const { container } = render(<DocumentaryBackground id="bg1" />)
    expect((container.querySelector('video') as HTMLVideoElement).muted).toBe(
      true
    )
  })

  it('applies restrained film treatment without an AI label', () => {
    const { container } = render(
      <ArchivalPhotoTreatment
        src="/midway.jpg"
        subjectFocus={{ x: 0.62, y: 0.4 }}
        filmTreatment
      />
    )
    expect(container.querySelector('img')).toHaveAttribute('src', '/midway.jpg')
    expect(screen.queryByText(/AI[- ]generated/iu)).not.toBeInTheDocument()
  })

  it('falls back to the media layer and reports the affected beat', () => {
    const onError = vi.fn()
    render(
      <DocumentaryGraphicBoundary
        beatId="beat-7"
        fallback={<div>archive remains visible</div>}
        onError={onError}
      >
        <ThrowingGraphic />
      </DocumentaryGraphicBoundary>
    )
    expect(screen.getByText('archive remains visible')).toBeInTheDocument()
    expect(onError).toHaveBeenCalledWith('beat-7', expect.any(Error))
  })
})
