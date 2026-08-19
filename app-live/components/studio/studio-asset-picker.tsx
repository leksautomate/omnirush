'use client'

import React, { useState } from 'react'

import {
  IconCheck,
  IconColorSwatch,
  IconLink,
  IconLoader2,
  IconMovie,
  IconPhoto,
  IconSearch,
  IconSparkles
} from '@tabler/icons-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import type { Shot } from '@/remotion/schema'

export interface SourcedAsset {
  kind: 'video' | 'photo'
  src: string
  thumb: string
  title: string
  credit: string
  source: string
}

interface StudioAssetPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shotIndex: number
  shot: Shot
  onSelectAsset: (asset: { src?: string; kind: Shot['kind'] }) => void
}

type TabType = 'search' | 'generate' | 'url' | 'brand'

export function StudioAssetPicker({
  open,
  onOpenChange,
  shotIndex,
  shot,
  onSelectAsset
}: StudioAssetPickerProps) {
  const [tab, setTab] = useState<TabType>('search')

  // Search tab state
  const [searchQuery, setSearchQuery] = useState(
    shot.narration ? shot.narration.slice(0, 60) : ''
  )
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SourcedAsset[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)

  // AI generation tab state
  const [generatePrompt, setGeneratePrompt] = useState(shot.narration || '')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // Custom URL state
  const [customUrl, setCustomUrl] = useState(shot.src || '')
  const [customKind, setCustomKind] = useState<Shot['kind']>(
    shot.kind || 'photo'
  )

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setSearchError(null)
    try {
      const res = await fetch('/api/studio/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim(), limit: 12 })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to search footage')
      setSearchResults(data.candidates || [])
    } catch (err: any) {
      setSearchError(err.message || 'Search failed')
    } finally {
      setIsSearching(false)
    }
  }

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!generatePrompt.trim()) return

    setIsGenerating(true)
    setGenerateError(null)
    try {
      const res = await fetch('/api/studio/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: generatePrompt.trim() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate image')
      setGeneratedUrl(data.imageUrl)
    } catch (err: any) {
      setGenerateError(err.message || 'Image generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  const pickCandidate = (cand: SourcedAsset) => {
    onSelectAsset({ src: cand.src, kind: cand.kind })
    onOpenChange(false)
  }

  const pickGenerated = () => {
    if (!generatedUrl) return
    onSelectAsset({ src: generatedUrl, kind: 'photo' })
    onOpenChange(false)
  }

  const pickCustomUrl = () => {
    if (!customUrl.trim()) return
    onSelectAsset({ src: customUrl.trim(), kind: customKind })
    onOpenChange(false)
  }

  const pickBrandCard = () => {
    onSelectAsset({ src: undefined, kind: 'photo' })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-5 sm:rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <span>Replace Asset for Shot #{shotIndex + 1}</span>
            <Badge variant="outline" className="text-xs font-normal capitalize">
              {shot.kind}
            </Badge>
          </DialogTitle>
          <DialogDescription className="line-clamp-2 text-xs text-muted-foreground">
            {shot.narration || 'No narration for this shot.'}
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex rounded-lg bg-muted/60 p-1 text-xs">
          <button
            type="button"
            onClick={() => setTab('search')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-all',
              tab === 'search'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <IconSearch className="h-3.5 w-3.5" />
            Search B-Roll
          </button>
          <button
            type="button"
            onClick={() => setTab('generate')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-all',
              tab === 'generate'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <IconSparkles className="h-3.5 w-3.5 text-pink-500" />
            AI Generate
          </button>
          <button
            type="button"
            onClick={() => setTab('url')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-all',
              tab === 'url'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <IconLink className="h-3.5 w-3.5" />
            Custom URL
          </button>
          <button
            type="button"
            onClick={() => setTab('brand')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-all',
              tab === 'brand'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <IconColorSwatch className="h-3.5 w-3.5" />
            Solid Card
          </button>
        </div>

        {/* Tab 1: Search B-Roll */}
        {tab === 'search' && (
          <div className="space-y-4 pt-1">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="Search footage query..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-9 text-xs"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isSearching || !searchQuery.trim()}
                className="h-9 gap-1.5 text-xs font-semibold"
              >
                {isSearching ? (
                  <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <IconSearch className="h-3.5 w-3.5" />
                )}
                Search
              </Button>
            </form>

            {searchError && (
              <p className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
                {searchError}
              </p>
            )}

            {searchResults.length > 0 ? (
              <div className="grid max-h-[50vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
                {searchResults.map((cand, idx) => (
                  <div
                    key={idx}
                    onClick={() => pickCandidate(cand)}
                    className="group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/60 hover:shadow-md"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-black/40">
                      {cand.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cand.thumb}
                          alt={cand.title}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                          {cand.kind === 'video' ? (
                            <IconMovie className="h-6 w-6" />
                          ) : (
                            <IconPhoto className="h-6 w-6" />
                          )}
                        </div>
                      )}
                      <Badge
                        variant="secondary"
                        className="absolute right-1.5 top-1.5 bg-black/70 text-[10px] text-white capitalize backdrop-blur-xs"
                      >
                        {cand.kind}
                      </Badge>
                    </div>
                    <div className="p-2">
                      <p className="line-clamp-1 text-xs font-medium text-foreground">
                        {cand.title || 'Untitled asset'}
                      </p>
                      <p className="line-clamp-1 text-[10px] text-muted-foreground">
                        {cand.source}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : isSearching ? (
              <div className="flex h-40 items-center justify-center">
                <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-border p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Search across Wikimedia, Internet Archive, and open web
                  archives to find matching b-roll footage.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: AI Generate */}
        {tab === 'generate' && (
          <div className="space-y-4 pt-1">
            <form onSubmit={handleGenerate} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Image Prompt
                </label>
                <textarea
                  rows={3}
                  value={generatePrompt}
                  onChange={e => setGeneratePrompt(e.target.value)}
                  placeholder="Describe what you want to see (e.g. Cinematic wide shot of astronaut on Mars, dramatic lighting, 8k)..."
                  className="w-full rounded-md border border-border bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden"
                />
              </div>
              <Button
                type="submit"
                disabled={isGenerating || !generatePrompt.trim()}
                className="w-full gap-2 text-xs font-semibold"
              >
                {isGenerating ? (
                  <>
                    <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                    Generating image...
                  </>
                ) : (
                  <>
                    <IconSparkles className="h-3.5 w-3.5 text-pink-400" />
                    Generate with ModelArk
                  </>
                )}
              </Button>
            </form>

            {generateError && (
              <p className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
                {generateError}
              </p>
            )}

            {generatedUrl && (
              <div className="space-y-3 rounded-lg border border-border bg-card p-3">
                <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={generatedUrl}
                    alt="Generated output"
                    className="h-full w-full object-cover"
                  />
                </div>
                <Button
                  onClick={pickGenerated}
                  size="sm"
                  className="w-full gap-1.5 text-xs"
                >
                  <IconCheck className="h-3.5 w-3.5" />
                  Use This Image for Shot #{shotIndex + 1}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Custom URL */}
        {tab === 'url' && (
          <div className="space-y-4 pt-1">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Media Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomKind('photo')}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-md border p-2 text-xs font-medium',
                      customKind === 'photo'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground'
                    )}
                  >
                    <IconPhoto className="h-4 w-4" />
                    Photo / Still
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomKind('video')}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-md border p-2 text-xs font-medium',
                      customKind === 'video'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground'
                    )}
                  >
                    <IconMovie className="h-4 w-4" />
                    Video Clip (.mp4)
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Public Media URL
                </label>
                <Input
                  placeholder="https://example.com/asset.jpg or .mp4"
                  value={customUrl}
                  onChange={e => setCustomUrl(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <Button
                onClick={pickCustomUrl}
                disabled={!customUrl.trim()}
                className="w-full text-xs font-semibold"
              >
                Apply Custom URL
              </Button>
            </div>
          </div>
        )}

        {/* Tab 4: Brand Solid Card */}
        {tab === 'brand' && (
          <div className="space-y-4 pt-1">
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <IconColorSwatch className="mx-auto mb-2 h-8 w-8 text-primary" />
              <h4 className="text-sm font-semibold">Clean Brand Accent Card</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Remove any photo or video asset for this shot and display a
                clean, distraction-free solid brand accent card behind the
                captions.
              </p>
              <Button
                onClick={pickBrandCard}
                variant="outline"
                className="mt-4 gap-1.5 text-xs font-semibold"
              >
                <IconCheck className="h-3.5 w-3.5" />
                Set to Solid Brand Card
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
