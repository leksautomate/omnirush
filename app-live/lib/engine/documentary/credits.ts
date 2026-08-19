import type { StoryboardInput } from '@/remotion/schema'

export interface SourceCredit {
  key: string
  kind: 'asset' | 'citation'
  title: string
  creatorOrInstitution?: string
  license?: string
  attribution?: string
  url: string
}

export function buildSourceCredits(
  storyboard: StoryboardInput
): SourceCredit[] {
  const credits: SourceCredit[] = []
  const seen = new Set<string>()

  for (const shot of storyboard.shots) {
    const rights = shot.documentary?.rights
    if (!rights?.sourceUrl || rights.provider === 'ai-generated') continue
    const key = `asset:${rights.provider}:${rights.sourceUrl}`
    if (seen.has(key)) continue
    seen.add(key)
    credits.push({
      key,
      kind: 'asset',
      title: rights.attribution ?? shot.narration ?? 'Documentary media',
      creatorOrInstitution: rights.creator ?? rights.institution,
      license: rights.license,
      attribution: rights.attribution,
      url: rights.sourceUrl
    })
  }

  const citations = [...(storyboard.documentaryProject?.citations ?? [])].sort(
    (left, right) => left.title.localeCompare(right.title)
  )
  for (const citation of citations) {
    const key = `citation:${citation.id}`
    if (seen.has(key)) continue
    seen.add(key)
    credits.push({
      key,
      kind: 'citation',
      title: citation.title,
      creatorOrInstitution: citation.authorOrInstitution,
      url: citation.url
    })
  }

  return credits
}

export function exportYouTubeCredits(storyboard: StoryboardInput) {
  const credits = buildSourceCredits(storyboard)
  const assets = credits.filter(credit => credit.kind === 'asset')
  const citations = credits.filter(credit => credit.kind === 'citation')
  const render = (credit: SourceCredit) =>
    [
      credit.attribution || credit.title,
      credit.creatorOrInstitution,
      credit.license,
      credit.url
    ]
      .filter(Boolean)
      .join(' — ')

  return [
    'ARCHIVAL MEDIA & VISUAL SOURCES',
    ...(assets.length
      ? assets.map(render)
      : ['No external archival media used.']),
    '',
    'RESEARCH SOURCES',
    ...(citations.length
      ? citations.map(render)
      : ['No external citations recorded.'])
  ].join('\n')
}
