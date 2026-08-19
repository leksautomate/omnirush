# WW1/WW2 Premium Documentary Pipeline Design

**Date:** 2026-08-14

## Purpose

Build a first-class WW1/WW2 documentary format for Kakkao that turns either a topic or an existing VidRush-style script into a premium historical documentary. The pipeline prioritizes reusable archival media, automatically creates explanatory motion graphics and overlays, uses AI reconstruction when authentic footage is unavailable, retains claim and asset provenance, and blocks publishing when critical factual or rights problems remain unresolved.

This is the first format-specific vertical slice. It does not implement history listicles, general explainers, product breakdowns, or non-war documentary presets.

## Creative Direction

The target is a premium historical-documentary presentation inspired by high-end television history programming:

- Cinematic storytelling with grounded, escalating tension.
- Realistic WW1/WW2 atmosphere rather than game-like or sensational graphics.
- Archival footage and photographs as the preferred visual source.
- Animated battle maps, military timelines, strategic overlays, evidence cards, force comparisons, and equipment statistics.
- Dramatic cinematic grading, high-contrast skies, restrained film grain, and historically appropriate typography.
- Epic orchestral music mixed beneath narration, plus selective battlefield, aircraft, naval, radio, industrial, and room-tone ambience.
- AI reconstruction only when reusable authentic visual material is unavailable. Reconstruction status is retained internally but is not displayed as a per-scene label.

## Supported Inputs

### Topic Mode

The user provides a WW1/WW2 topic, target duration, language, and optional angle. Kakkao builds the research dossier, documentary brief, narration, chapters, semantic storyboard, visual plan, sound plan, credits, and QA report.

### Script Mode

The user provides an existing script. Kakkao parses it, preserves the narration by default, verifies its factual claims, structures it into chapters, and builds the same storyboard, visual, sound, rights, and QA outputs as Topic Mode.

The official import contract is the VidRush Four Pillars format:

1. `🎥 What the Video Is About`
2. `🗣️ Style of Talking`
3. `🎯 Who This Video Is For`
4. `📌 Key Facts Covered`
5. Clean TTS narration
6. Optional `🔄 Rotation Log`

The Four Pillars and Rotation Log are metadata. They must never enter TTS narration or captions.

Scripts without the Four Pillars may still import as narration-only documents, but the parser reports which brief fields were inferred.

### Opening-Date Requirement

Every documentary must begin with a concrete historical date or date range. A valid opening includes at least a year and may include a month and day, such as `By June 1942` or `On September 1, 1939`.

The first scene automatically receives a date/location overlay. Imported scripts that do not begin with a valid date produce a blocking `opening-date-missing` validation issue. Kakkao may suggest an opening sentence but must not silently rewrite user narration.

## Canonical Documentary Model

Niche and format are independent first-class fields so later combinations remain possible:

```ts
type VideoNiche = 'ww1_ww2'
type VideoFormat = 'documentary'

interface ContentProfile {
  niche: VideoNiche
  format: VideoFormat
  presetVersion: 1
}
```

The persisted documentary project contains:

```ts
interface DocumentaryProject {
  id: string
  profile: ContentProfile
  inputMode: 'topic' | 'script'
  topic: string
  targetMinutes: number
  language: string
  brief: DocumentaryBrief
  narration: string
  rotationLog?: RotationLog
  dossier: ResearchDossier
  chapters: DocumentaryChapter[]
  beats: DocumentaryBeat[]
  assets: DocumentaryAsset[]
  qa: DocumentaryQaReport
}
```

Projects support documentaries from 30 seconds through 60 minutes. Documents longer than 20 minutes are planned and generated chapter by chapter to avoid prompt truncation, factual drift, and inconsistent narration voice.

## Research Dossier

The dossier is structured data rather than an unverified notes string.

```ts
interface ResearchDossier {
  thesis: string
  chronology: ChronologyEvent[]
  claims: ClaimRecord[]
  citations: CitationRecord[]
  people: HistoricalEntity[]
  militaryUnits: HistoricalEntity[]
  equipment: EquipmentEntity[]
  locations: HistoricalLocation[]
  quotations: QuotationRecord[]
}
```

Every factual claim has a stable ID, importance, verification state, and one or more citation IDs. Citations retain title, author or institution, URL, publication date when known, access date, source class, excerpt or supporting note, and reliability level.

Source classes are:

- `primary`: war diaries, orders, official reports, declassified records, contemporary photographs, original speeches, and archival documents.
- `institutional`: national archives, museums, universities, military-history institutions, and official historical databases.
- `secondary`: reputable books, peer-reviewed work, and established historical publications.
- `discovery-only`: search snippets, unsourced summaries, forums, and general web pages. These may lead to sources but cannot independently verify a critical claim.

User-provided narration remains unchanged unless the user explicitly authorizes rewriting. Unsupported, disputed, or contradicted claims are surfaced in QA with a suggested correction and the evidence behind it.

## Documentary Structure

The default act structure is:

1. **Cold open:** the decisive moment, concrete opening date, location, and central question.
2. **Strategic context:** nations, commanders, objectives, geography, and the situation before the conflict.
3. **Build-up:** chronology, forces, equipment, intelligence, preparation, and constraints.
4. **Conflict:** decisions, movements, engagements, mistakes, and consequences.
5. **Turning point:** the central reversal, discovery, failure, or breakthrough.
6. **Aftermath:** losses, territorial or strategic change, and longer-term consequences.
7. **Epilogue:** resolution of the opening question and connection to the wider war.

Chapters are data objects with title, act, start/end narration offsets, date range, locations, claim IDs, entity IDs, emotional objective, and retention hook. The structure may omit an act when the source material does not justify it, but the opening date and evidence-backed resolution are mandatory.

## Semantic Storyboard

Each beat carries meaning beyond a generic photo/video hint:

```ts
type DocumentaryBeatType =
  | 'archival-video'
  | 'archival-photo'
  | 'battle-map'
  | 'military-timeline'
  | 'force-comparison'
  | 'equipment-spec'
  | 'strategic-overlay'
  | 'evidence-card'
  | 'quote-card'
  | 'statistics'
  | 'reconstruction'

interface DocumentaryBeat {
  id: string
  chapterId: string
  type: DocumentaryBeatType
  narration: string
  start: number
  duration: number
  words: TimedWord[]
  claimIds: string[]
  dateLabel?: string
  locationIds: string[]
  entityIds: string[]
  visualQuery: string
  visualIntent: string
  graphic?: GraphicInstruction
  assetId?: string
  transitionOut?: Transition
}
```

The beat planner selects the most informative treatment, not merely the first available image. It avoids repeated footage, alternates archival and explanatory visuals, and creates a graphic beat when the narration describes movement, comparison, chronology, specifications, documentary evidence, or quantitative change.

## Automatic Overlay System

The Remotion schema gains typed instructions for:

### Date and Location

- Date or date range.
- Location, theatre, operation, and optional coordinates.
- Used for the opening, chapter changes, and material geographic changes.

### Animated Battle Map

- Theatre and map bounds.
- Historical date/time label.
- Unit markers, allegiance, type, strength label, and position.
- Movement routes, attack arrows, retreats, front lines, objectives, defensive zones, and annotations.
- Camera framing and animation phases.

### Military Timeline

- Ordered dated events with title, description, importance, and claim IDs.
- Persistent progress line and active-event emphasis.

### Force Comparison

- Generic opposing-side objects rather than person-specific cards.
- Side name, allegiance, personnel, aircraft, ships, vehicles, artillery, highlighted advantage, and source claim IDs.

### Equipment Specification

- Name, model or variant, service year, role, manufacturer, image, and typed specifications.
- Specifications retain value, unit, label, and source claim ID.

### Strategic Overlay

- Objectives, supply routes, detection ranges, defensive perimeters, formations, and threat zones.

### Evidence and Quote Cards

- Document title, institution, date, excerpt, author or speaker, role, citation ID, and source URL.
- Quotes require an exact source; paraphrases cannot render as quotation cards.

### Statistics

- Casualties, aircraft, ships, production, distances, force strength, or losses.
- Supports counters, bars, before/after values, and opposing-side comparison.

### Animated Archival Photography

- Depth-safe Ken Burns movement, restrained parallax, subject-aware crop, film treatment, and optional evidence caption.
- No artificial lip movement or invented action is applied to historical people.

All automatically planned overlays remain editable or removable in Studio.

## Background Asset Package

The user-provided files in `app-live/background/` become registered documentary assets and are copied into the public Remotion asset tree. Original files remain untouched.

| Source file | Registered role | Rendering rule |
|---|---|---|
| `bg1.mp4` | Dark sepia atmosphere | Opening cards, chapter cards, quotations, and dark evidence scenes. Use softened or cropped because the source is 736x414. |
| `bg2.mp4` | Light archival parchment | Battle maps, timelines, documents, and evidence cards. Full-HD background. |
| `bg3.mp4` | Film gate and moving scratches | Blend overlay for archival photos and reconstruction scenes. Use at controlled opacity because the source is 736x414. |
| `bg4.mp4` | Black tactical grid | Battle maps, force comparisons, equipment specifications, coordinates, and strategic overlays. Full-HD background. |

Every background video is muted. Music, voice, and ambience remain independent audio layers. Backgrounds loop only inside the duration of their owning graphic sequence.

## Colour, Typography, and Motion

- Base palette: charcoal, black, parchment, historical brass/gold, and off-white.
- Map allegiance: Allied blue and Axis red by default, with neutral grey and objective gold.
- Typography: condensed military-style display face for dates and operation titles, highly readable sans serif for body facts, and serif treatment for documents and quotations.
- Grain and scratches are restrained and never reduce map or citation readability.
- Camera movement is deliberate and slow except during a documented turning point.
- Maps animate in phases: establish geography, reveal forces, animate movement, show consequence, then hold for comprehension.
- Statistics animate only after their narration begins and remain visible long enough to read.

## Audio Direction

The existing curated Pixabay audio catalogue and multi-layer mixer are used.

- Music: orchestral, cinematic, escalating, and instrumental.
- Ambience: battlefield distance, aircraft, ship, radio room, industrial repair, wind, crowd, or quiet room tone as context requires.
- SFX: restrained map movements, radio transitions, impacts, document reveals, and chapter transitions.
- Voiceover remains dominant. Music ducks beneath speech; ambience remains quieter than music; impacts cannot mask critical words.

Additional Pixabay tracks may be installed only with creator, source URL, licence URL, download date, duration, and Content ID status.

## Asset Sourcing and Rights

Asset records retain:

```ts
interface AssetRights {
  provider:
    | 'wikimedia'
    | 'internet-archive'
    | 'nara'
    | 'youtube'
    | 'user-provided'
    | 'ai-generated'
    | 'web'
  sourceUrl?: string
  creator?: string
  institution?: string
  license:
    | 'public-domain'
    | 'cc0'
    | 'cc-by'
    | 'cc-by-sa'
    | 'permission'
    | 'standard-youtube'
    | 'unknown'
  attribution?: string
  reusable: boolean
  reviewRequired: boolean
  accessedAt: string
}
```

Sourcing priority is:

1. Public-domain or clearly licensed institutional archives.
2. Wikimedia, NARA, Internet Archive, museums, and official collections with validated rights.
3. YouTube videos explicitly marked CC BY, confirmed public domain, or accompanied by recorded permission.
4. User-provided media with user-confirmed usage rights.
5. Generated maps and internally tracked AI reconstruction.

A standard YouTube upload is a research/reference candidate, not a reusable clip. Crediting a creator does not convert an unlicensed upload into reusable media. Fair use or fair dealing is never automatically asserted by the system. General web assets with unknown rights cannot be selected for final rendering.

Source and attribution records survive through the canonical storyboard and are available for end credits, video descriptions, and claim disputes.

## AI Reconstruction Fallback

AI reconstruction is selected only when:

- The beat requires a visual that materially supports the narration.
- No safe archival video, photograph, map, document, or explanatory graphic adequately covers it.
- The prompt is grounded in verified date, location, uniforms, equipment, weather, and operational context.

The asset is internally recorded as `ai-generated` and linked to the claims used to construct it. No per-scene AI label is rendered, per the approved creative direction.

## Compose and Render Contract

`composeRender` must preserve every semantic field from stored beats and explicit overrides. It must not drop overlays, comparison/force data, claim IDs, asset rights, chapters, citations, graphic instructions, transitions, or audio cues.

The canonical storyboard is the only input used by:

- Inline chat preview.
- Studio preview and editing.
- Remotion Lambda render.
- Credits and source export.
- Editorial QA.

Preview and final render must remain deterministic for identical storyboard input.

## Studio Experience

Studio adds:

- Chapter navigation and act labels.
- Scene type and claim/citation inspection.
- Source and rights status for each asset.
- Overlay-specific controls for maps, timelines, statistics, evidence, quotes, equipment, and force comparisons.
- Background selection among the four registered user assets.
- Reconstruction-origin metadata in the inspector without a rendered per-scene label.
- QA panel with blocking errors and warnings.
- Source-credit export suitable for a YouTube description.

## Editorial QA

The QA engine emits stable issue codes, severity, affected claim/beat/asset IDs, evidence, and a suggested action.

Blocking errors include:

- Missing opening date.
- Critical unsupported claim.
- Contradicted date, identity, unit, equipment model, or location.
- Quotation without an exact citation.
- Final-render asset without reusable rights.
- Missing source record for an evidence card.

Warnings include:

- Disputed non-critical claim.
- Repeated footage or photograph.
- Visual subject/year/model mismatch.
- Visual-narration mismatch.
- More than 90 seconds without a meaningful visual or narrative progression.
- Excessive consecutive reconstruction beats.
- Missing optional attribution detail.

The report includes `publishReady: boolean`. Blocking issues set it to `false`; warnings remain reviewable but do not prevent preview rendering.

## Failure and Fallback Behaviour

- A script parse failure returns section-level diagnostics and retains the original text.
- Missing Four Pillars are inferred when possible and reported, not silently discarded.
- Missing citations leave claims unverified and block only when the claim is critical or used in evidence/quotation graphics.
- A rights failure removes the asset from final selection and triggers a search for archival, graphic, or reconstruction alternatives.
- A map without reliable coordinates falls back to a labelled regional map rather than fabricated precision.
- A long project saves progress after every chapter so a failed chapter can resume without restarting the documentary.
- Renderer failure on one optional overlay falls back to the underlying archival or background layer and reports the affected beat.

## Testing Strategy

### Unit Tests

- Four Pillars parser separates brief, key facts, narration, CTA, and Rotation Log.
- Opening-date validator accepts historical date forms and rejects undated openings.
- Niche/format preset resolution returns `ww1_ww2 + documentary` without free-text inference downstream.
- Claim/citation schemas reject unsupported evidence cards and unsourced quotations.
- Overlay planner maps chronology, movement, comparisons, equipment, quotations, and statistics to the correct graphic type.
- Rights policy accepts public domain, CC BY, permission, and user-confirmed assets; rejects standard YouTube and unknown web assets.
- QA detects all blocking issue classes and representative warnings.

### Integration Tests

- Topic Mode produces a persisted documentary project and storyboard.
- Script Mode imports the Battle of Midway example without sending Four Pillars or Rotation Log to TTS.
- `cutBeats` retains chapter, claim, entity, date, location, and graphic metadata.
- `composeRender` preserves overlays, force-comparison data, citations, rights, transitions, and audio cues when merging a stored beats record.
- Source credits export contains every final-render asset exactly once.

### Render Tests

- A short composition renders a date/location opening over `bg1`.
- A battle-map scene renders over `bg4` with moving units and objectives.
- An evidence card renders over `bg2` with readable citation data.
- An archival photograph renders with `bg3` film treatment.
- The rendered MP4 contains H.264 video and AAC mixed audio with the background plates muted.

## Acceptance Scenario

Using the supplied Battle of Midway VidRush script:

1. Kakkao recognizes Script Mode and the Four Pillars structure.
2. Narration begins with `By the summer of 1942`, satisfying the opening-date requirement.
3. The Four Pillars and Rotation Log are excluded from voiceover and captions.
4. Claims about Pearl Harbor, Coral Sea, Station HYPO, Yorktown repairs, the June 4 attacks, losses, and strategic consequences receive citations and verification states.
5. The project is divided into the approved seven-act documentary structure.
6. The planner creates date cards, a Pacific theatre map, carrier force comparison, codebreaking evidence card, Yorktown repair timeline, aircraft/ship statistics, attack-route battle map, and aftermath comparison.
7. Reusable archival assets are preferred; unsafe YouTube or unknown-rights assets cannot enter the final storyboard.
8. Missing historical footage may use an internally tracked AI reconstruction without a rendered per-scene label.
9. The four user-provided background clips are assigned according to their registered roles and remain muted.
10. Studio preview and Lambda render match, and the QA report explains whether the project is publish-ready.

## Delivery Sequence

Implementation proceeds in independently testable slices:

1. Documentary schemas, preset connection, Four Pillars parser, and opening-date validation.
2. Research dossier, claim/citation model, long-form chapter planning, and script-mode persistence.
3. Semantic documentary beats and automatic overlay planning.
4. Rights-aware asset model and safe sourcing policy, including YouTube licence enforcement.
5. Typed Remotion overlays, registered background package, and deterministic rendering.
6. Compose preservation, Studio editing, credit export, and editorial QA.

