'use client'

import { useState } from 'react'

import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconFileDescription,
  IconRobot
} from '@tabler/icons-react'

import { DOCUMENTARY_BACKGROUNDS } from '@/lib/engine/documentary/backgrounds'
import { exportYouTubeCredits } from '@/lib/engine/documentary/credits'
import type { DocumentaryBackgroundId } from '@/lib/engine/documentary/schema'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import type { DocumentaryGraphic } from '@/remotion/documentary-schema'
import type { Shot, StoryboardInput } from '@/remotion/schema'

interface DocumentaryInspectorProps {
  storyboard: StoryboardInput
  selectedShotIndex: number
  onUpdateShot: (index: number, updated: Partial<Shot>) => void
  onSelectShot?: (index: number) => void
}

function prettyLicense(value: string) {
  const label = value.replaceAll('-', ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function allowedBackground(
  type: DocumentaryGraphic['type'],
  id: DocumentaryBackgroundId
) {
  if (id === 'bg3') return true
  if (
    type === 'force-comparison' ||
    type === 'equipment-spec' ||
    type === 'strategic-overlay'
  ) {
    return id === 'bg4'
  }
  if (type === 'evidence-card' || type === 'quote-card') {
    return id === 'bg1' || id === 'bg2'
  }
  if (
    type === 'battle-map' ||
    type === 'military-timeline' ||
    type === 'statistics'
  ) {
    return id === 'bg2' || id === 'bg4'
  }
  return id === 'bg1' || id === 'bg2' || id === 'bg4'
}

export function DocumentaryInspector({
  storyboard,
  selectedShotIndex,
  onUpdateShot,
  onSelectShot
}: DocumentaryInspectorProps) {
  const [copied, setCopied] = useState(false)
  const project = storyboard.documentaryProject
  const shot = storyboard.shots[selectedShotIndex]
  const documentary = shot?.documentary
  if (!project || !shot || !documentary) return null

  const chapter = project.chapters.find(
    item => item.id === documentary.chapterId
  )
  const graphic = documentary.graphic
  const citations = project.citations
  const updateGraphic = (updated: Record<string, unknown>) => {
    if (!graphic) return
    onUpdateShot(selectedShotIndex, {
      documentary: {
        ...documentary,
        graphic: { ...graphic, ...updated } as typeof graphic
      }
    })
  }
  const selectBackground = (id: DocumentaryBackgroundId) => {
    if (id === 'bg3') {
      onUpdateShot(selectedShotIndex, {
        documentary: {
          ...documentary,
          filmTreatmentBackgroundId:
            documentary.filmTreatmentBackgroundId === 'bg3' ? undefined : 'bg3'
        }
      })
      return
    }
    if (graphic && allowedBackground(graphic.type, id)) {
      updateGraphic({ backgroundId: id })
    }
  }
  const copyCredits = () => {
    navigator.clipboard
      ?.writeText(exportYouTubeCredits(storyboard))
      .catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="border-b border-zinc-800 bg-[#0e0e12] p-3 text-white">
      <nav
        aria-label="Documentary chapters"
        className="mb-3 flex gap-1 overflow-x-auto"
      >
        {project.chapters.map((item, index) => {
          const targetIndex = storyboard.shots.findIndex(
            candidate => candidate.documentary?.chapterId === item.id
          )
          return (
            <button
              key={item.id}
              type="button"
              disabled={targetIndex < 0}
              onClick={() => targetIndex >= 0 && onSelectShot?.(targetIndex)}
              className={`shrink-0 rounded px-2 py-1 text-[10px] ${item.id === chapter?.id ? 'bg-amber-400/15 text-amber-300' : 'bg-zinc-900 text-zinc-500'}`}
              title={item.title}
            >
              {index + 1}. {item.act.replaceAll('-', ' ')}
            </button>
          )
        })}
      </nav>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-amber-400">
            {chapter?.act.replaceAll('-', ' ') ?? 'Documentary'}
          </div>
          <div className="mt-1 text-sm font-semibold">
            {chapter?.title ?? documentary.chapterId}
          </div>
        </div>
        {project.qa.publishReady ? (
          <Badge className="gap-1 bg-emerald-500/15 text-emerald-300">
            <IconCheck className="h-3 w-3" /> Publish ready
          </Badge>
        ) : (
          <Badge className="gap-1 bg-red-500/15 text-red-300">
            <IconAlertTriangle className="h-3 w-3" /> Blocked
          </Badge>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="outline">{documentary.beatType}</Badge>
        {documentary.claimIds.map(claimId => (
          <Badge key={claimId} variant="outline" className="font-mono">
            {claimId}
          </Badge>
        ))}
        {documentary.reconstruction ? (
          <Badge className="gap-1 bg-violet-500/15 text-violet-300">
            <IconRobot className="h-3 w-3" /> AI reconstruction
          </Badge>
        ) : null}
      </div>

      {documentary.rights ? (
        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <IconFileDescription className="h-3.5 w-3.5 text-amber-400" />
            {prettyLicense(documentary.rights.license)}
          </div>
          <div className="mt-1 text-zinc-400">
            {documentary.rights.institution ??
              documentary.rights.creator ??
              documentary.rights.provider}
          </div>
          {documentary.rights.sourceUrl ? (
            <a
              href={documentary.rights.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block truncate text-amber-300 hover:underline"
            >
              View source
            </a>
          ) : null}
        </div>
      ) : null}

      {citations.length ? (
        <div className="mt-3 space-y-1 rounded-lg border border-zinc-800 p-2 text-xs">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            Research citations
          </div>
          {citations.map(citation => (
            <a
              key={citation.id}
              href={citation.url}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-amber-300 hover:underline"
            >
              {citation.title} · {citation.authorOrInstitution}
            </a>
          ))}
        </div>
      ) : null}

      {graphic?.type === 'date-location' ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-[11px] text-zinc-400">
            Date label
            <input
              aria-label="Date label"
              value={graphic.date}
              onChange={event => updateGraphic({ date: event.target.value })}
              className="mt-1 h-8 w-full rounded border border-zinc-700 bg-zinc-950 px-2 text-xs text-white"
            />
          </label>
          <label className="text-[11px] text-zinc-400">
            Location
            <input
              aria-label="Location label"
              value={graphic.location}
              onChange={event =>
                updateGraphic({ location: event.target.value })
              }
              className="mt-1 h-8 w-full rounded border border-zinc-700 bg-zinc-950 px-2 text-xs text-white"
            />
          </label>
        </div>
      ) : null}

      {graphic?.type === 'battle-map' ? (
        <div className="mt-3 space-y-2">
          <label className="block text-[11px] text-zinc-400">
            Theatre
            <input
              aria-label="Map theatre"
              value={graphic.theatre}
              onChange={event => updateGraphic({ theatre: event.target.value })}
              className="mt-1 h-8 w-full rounded border border-zinc-700 bg-zinc-950 px-2 text-xs text-white"
            />
          </label>
          <label className="block text-[11px] text-zinc-400">
            Date
            <input
              aria-label="Map date"
              value={graphic.dateLabel ?? ''}
              onChange={event =>
                updateGraphic({ dateLabel: event.target.value })
              }
              className="mt-1 h-8 w-full rounded border border-zinc-700 bg-zinc-950 px-2 text-xs text-white"
            />
          </label>
          <label className="block text-[11px] text-zinc-400">
            Annotations (one per line)
            <textarea
              aria-label="Map annotations"
              value={graphic.annotations.join('\n')}
              onChange={event =>
                updateGraphic({
                  annotations: event.target.value
                    .split('\n')
                    .map(value => value.trim())
                    .filter(Boolean)
                })
              }
              className="mt-1 min-h-16 w-full rounded border border-zinc-700 bg-zinc-950 p-2 text-xs text-white"
            />
          </label>
          <div className="text-[10px] text-zinc-500">
            {graphic.units.length} units · {graphic.routes.length} routes ·{' '}
            {graphic.objectives.length} objectives
          </div>
        </div>
      ) : null}

      {graphic?.type === 'military-timeline' ? (
        <div className="mt-3 space-y-2">
          {graphic.events.map((event, index) => (
            <div key={event.id} className="grid grid-cols-[0.8fr_1.2fr] gap-1">
              <input
                aria-label={`Timeline event ${index + 1} date`}
                value={event.date}
                onChange={change => {
                  const events = [...graphic.events]
                  events[index] = { ...event, date: change.target.value }
                  updateGraphic({ events })
                }}
                className="h-8 rounded border border-zinc-700 bg-zinc-950 px-2 text-xs"
              />
              <input
                aria-label={`Timeline event ${index + 1} title`}
                value={event.title}
                onChange={change => {
                  const events = [...graphic.events]
                  events[index] = { ...event, title: change.target.value }
                  updateGraphic({ events })
                }}
                className="h-8 rounded border border-zinc-700 bg-zinc-950 px-2 text-xs"
              />
            </div>
          ))}
        </div>
      ) : null}

      {graphic?.type === 'force-comparison' ? (
        <div className="mt-3 space-y-2">
          {graphic.sides.map((side, index) => (
            <div
              key={`${side.name}-${index}`}
              className="rounded border border-zinc-800 p-2"
            >
              <input
                aria-label={`Force ${index + 1} name`}
                value={side.name}
                onChange={event => {
                  const sides = [...graphic.sides]
                  sides[index] = { ...side, name: event.target.value }
                  updateGraphic({ sides })
                }}
                className="h-8 w-full rounded border border-zinc-700 bg-zinc-950 px-2 text-xs"
              />
              <div className="mt-1 text-[10px] text-zinc-500">
                Personnel {side.personnel ?? '—'} · Aircraft{' '}
                {side.aircraft ?? '—'} · Ships {side.ships ?? '—'}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {graphic?.type === 'equipment-spec' ? (
        <div className="mt-3 space-y-2">
          <input
            aria-label="Equipment name"
            value={graphic.name}
            onChange={event => updateGraphic({ name: event.target.value })}
            className="h-8 w-full rounded border border-zinc-700 bg-zinc-950 px-2 text-xs"
          />
          {graphic.specifications.map((specification, index) => (
            <div
              key={`${specification.label}-${index}`}
              className="grid grid-cols-3 gap-1"
            >
              {(['label', 'value', 'unit'] as const).map(field => (
                <input
                  key={field}
                  aria-label={`Specification ${index + 1} ${field}`}
                  value={specification[field] ?? ''}
                  onChange={event => {
                    const specifications = [...graphic.specifications]
                    specifications[index] = {
                      ...specification,
                      [field]: event.target.value
                    }
                    updateGraphic({ specifications })
                  }}
                  className="h-8 min-w-0 rounded border border-zinc-700 bg-zinc-950 px-2 text-xs"
                />
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {graphic?.type === 'statistics' ? (
        <div className="mt-3 space-y-2">
          <input
            aria-label="Statistics title"
            value={graphic.title}
            onChange={event => updateGraphic({ title: event.target.value })}
            className="h-8 w-full rounded border border-zinc-700 bg-zinc-950 px-2 text-xs"
          />
          {graphic.values.map((statistic, index) => (
            <div
              key={`${statistic.label}-${index}`}
              className="grid grid-cols-3 gap-1"
            >
              <input
                aria-label={`Statistic ${index + 1} label`}
                value={statistic.label}
                onChange={event => {
                  const values = [...graphic.values]
                  values[index] = { ...statistic, label: event.target.value }
                  updateGraphic({ values })
                }}
                className="h-8 min-w-0 rounded border border-zinc-700 bg-zinc-950 px-2 text-xs"
              />
              <input
                aria-label={`Statistic ${index + 1} value`}
                type="number"
                value={statistic.value}
                onChange={event => {
                  const values = [...graphic.values]
                  values[index] = {
                    ...statistic,
                    value: Number(event.target.value)
                  }
                  updateGraphic({ values })
                }}
                className="h-8 min-w-0 rounded border border-zinc-700 bg-zinc-950 px-2 text-xs"
              />
              <input
                aria-label={`Statistic ${index + 1} unit`}
                value={statistic.unit ?? ''}
                onChange={event => {
                  const values = [...graphic.values]
                  values[index] = { ...statistic, unit: event.target.value }
                  updateGraphic({ values })
                }}
                className="h-8 min-w-0 rounded border border-zinc-700 bg-zinc-950 px-2 text-xs"
              />
            </div>
          ))}
        </div>
      ) : null}

      {graphic?.type === 'evidence-card' || graphic?.type === 'quote-card' ? (
        <div className="mt-3 space-y-2">
          <textarea
            aria-label={
              graphic.type === 'evidence-card'
                ? 'Evidence excerpt'
                : 'Quotation'
            }
            value={
              graphic.type === 'evidence-card' ? graphic.excerpt : graphic.quote
            }
            onChange={event =>
              updateGraphic(
                graphic.type === 'evidence-card'
                  ? { excerpt: event.target.value }
                  : { quote: event.target.value }
              )
            }
            className="min-h-20 w-full rounded border border-zinc-700 bg-zinc-950 p-2 text-xs"
          />
          <a
            href={graphic.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-xs text-amber-300 hover:underline"
          >
            Open evidence source
          </a>
        </div>
      ) : null}

      <div className="mt-3">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
          Documentary background
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.values(DOCUMENTARY_BACKGROUNDS).map(background => {
            const selected =
              background.id === 'bg3'
                ? documentary.filmTreatmentBackgroundId === 'bg3'
                : graphic?.backgroundId === background.id
            const enabled = graphic
              ? allowedBackground(graphic.type, background.id)
              : background.id === 'bg3'
            return (
              <button
                key={background.id}
                type="button"
                disabled={!enabled}
                onClick={() => selectBackground(background.id)}
                className={`rounded border px-2 py-1.5 text-left text-[11px] ${selected ? 'border-amber-400 bg-amber-400/10 text-amber-200' : 'border-zinc-800 text-zinc-400'} disabled:opacity-35`}
              >
                {background.label}
              </button>
            )
          })}
        </div>
      </div>

      {project.qa.issues.length ? (
        <div className="mt-3 space-y-1">
          {project.qa.issues.map((qaIssue, index) => (
            <div
              key={`${qaIssue.code}-${index}`}
              className={`rounded p-2 text-[11px] ${qaIssue.severity === 'blocking' ? 'bg-red-500/10 text-red-200' : 'bg-amber-500/10 text-amber-200'}`}
            >
              <b>{qaIssue.code}</b>: {qaIssue.message}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between">
        <div className="text-[10px] text-zinc-500">
          {project.citations.length} research source(s)
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={copyCredits}
          className="h-7 gap-1 text-[10px]"
        >
          <IconCopy className="h-3 w-3" /> {copied ? 'Copied' : 'Copy credits'}
        </Button>
      </div>
    </section>
  )
}
