# Kakkao Live (VidRush) — Architecture & Suggestions Roadmap

This document serves as the living technical reference and feature roadmap for **Kakkao Live (VidRush)**. It outlines how the system operates end-to-end and tracks prioritized improvements, enhancements, and implementation progress.

---

## 🏗️ 1. Architecture & End-to-End Workflow

Kakkao Live is an agentic AI video production studio designed to take a user prompt, topic, or reference YouTube URL and autonomously generate a timed, voiced, captioned, and rendered video.

```
┌─────────────────────────────────────────────────────────┐
│                   User Prompt / Topic                   │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ 1. AI Research & Scripting (writeScript)                │
│    - Gathers web facts via Search/Fetch                 │
│    - Generates clean, verbatim spoken narration script   │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Text-To-Speech & Timing (generateVoiceover)          │
│    - Synthesizes audio via Speechify API (streaming)    │
│    - Strips ID3 chunk headers & aligns speech marks     │
│    - Uploads MP3 to R2/S3; returns `voiceoverId`        │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Beat Cutting & Audio Locking (cutBeats)              │
│    - Segments script into timed visual shots            │
│    - Locks shot durations to spoken TTS word timings    │
│    - Generates visual queries & karaoke caption words   │
│    - Returns stored `beatsId` in KV                     │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Media Sourcing & Vision Check (sourceFootage)        │
│    - Searches Wikimedia, Internet Archive, & Web Search │
│    - Runs Gemini Vision verification on top candidates  │
│    - Fallbacks: generateImage / generateAvatar / Card   │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Storyboard Assembly & Chat Preview (composeRender)   │
│    - Assembles unified `StoryboardInput` JSON schema    │
│    - Renders live interactive preview in Chat via       │
│      `<Player>` (@remotion/player)                      │
└────────────────────────────┬────────────────────────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
┌───────────────────────┐         ┌───────────────────────┐
│ 6a. Studio & Editing  │         │ 6b. Remotion Lambda   │
│ - Edit timeline       │         │ - Distributed render  │
│ - Swap clips / music  │         │   across AWS Lambda   │
│ - /studio/[id]        │         │ - Stitches MP4 to S3  │
└───────────────────────┘         └───────────────────────┘
```

### Core Pipeline Breakdown

1. **Research & Scriptwriting (`lib/engine/script.ts` / `writeScript`):**
   - Researches topics via Tavily, Exa, Brave, or SearXNG.
   - Generates natural, verbatim spoken text without audio cues or markdown formatting.
2. **TTS & Word-Level Timing (`lib/engine/voice.ts` / `generateVoiceover`):**
   - Synthesizes speech with Speechify's streaming timestamp API.
   - Splits long scripts at sentence boundaries and strips concatenated ID3 headers to prevent audio pops.
   - Maps character offsets back to whitespace tokens (`alignMarksToTokens`).
   - Hosts MP3 on R2/S3 and returns a lightweight `voiceoverId`.
3. **Beat Cutting (`lib/engine/beats.ts` / `cutBeats`):**
   - Segments script into visual shots.
   - Locks shot start/durations directly to spoken voice timestamps (`bindVoiceTimings`).
   - Returns a `beatsId` referencing the storyboard skeleton.
4. **Footage Sourcing (`lib/engine/sourcing.ts` / `sourceFootage`):**
   - Aggregates media from Wikimedia Commons, Internet Archive, US National Archives (NARA), and Web Search.
   - Gemini Vision (`geminiPickAsset`) inspects thumbnails to filter watermarks, UI overlays, and irrelevant results.
   - Fallbacks: Flux/DALL-E (`generateImage`), MuseTalk on Modal (`generateAvatar`), or brand accent cards.
5. **Storyboard Assembly & Preview (`remotion/schema.ts`, `remotion/Storyboard.tsx` / `composeRender`):**
   - Compiles shots, voice, and background music into a single canonical `StoryboardInput`.
   - Renders interactive in-chat and studio previews via `@remotion/player`.
6. **Studio & Cloud Rendering (`components/studio-canvas.tsx`, `lib/remotion/lambda.ts`):**
   - Accessible at `/studio/[id]`.
   - Dispatches parallelized frame rendering across AWS Lambda for fast MP4 exports directly to S3.

---

## 📋 2. Improvement & Feature Suggestions Roadmap

Use the checkboxes below to track feature requests, enhancements, and implementation status.

---

### Category A: Visual Polish, Transitions & Motion Graphics

- [ ] **A1. Rich Visual Transitions** `[Priority: High]`
  - *Current state:* Basic opacity crossfade (`FADE_SECONDS = 0.25`) and Ken Burns zoom.
  - *Proposal:* Implement customizable transitions in `remotion/Storyboard.tsx` (Whip Pan, Zoom Blur, Directional Slide, Film Burn / Light Leak, Glitch, Fast Dissolve).
- [ ] **A2. Transition Sound Effects (SFX)** `[Priority: High]`
  - *Current state:* Only background music and voiceover audio are mixed.
  - *Proposal:* Automatically mix subtle cinematic transition SFX (whooshes, risers, bass drops, clicks) aligned with shot cut boundaries.
- [ ] **A3. Smart Aspect Ratio Reframing & Auto-Blur Fill** `[Priority: Medium]`
  - *Current state:* Video clips use CSS `objectFit: cover`, which can cut off subjects when 16:9 media is placed into 9:16 vertical frames.
  - *Proposal:* Provide dual-layer blurred background fill for aspect ratio mismatches or subject-centered smart cropping.
- [ ] **A4. Motion Graphics & Lower Thirds** `[Priority: Medium]`
  - *Current state:* Only text captions and Ken Burns images.
  - *Proposal:* Add animated lower-thirds, title cards, progress bars, and kinetic typography presets for key hooks.

---

### Category B: Studio UI & Interactive Timeline Editor

- [x] **B1. Visual Timeline & Shot Reordering** `[Priority: High]` `[STATUS: DONE]`
  - *Implemented:* Interactive card-based timeline with scrub-to-shot on click, start/duration auto-recalculation, drag/reorder controls, duplicate, delete, and shot addition.
- [x] **B2. One-Click Asset Swapping & Regeneration** `[Priority: High]` `[STATUS: DONE]`
  - *Implemented:* `StudioAssetPicker` modal with live archive/web b-roll search (`/api/studio/source`), AI image generation via ModelArk (`/api/studio/generate-image`), custom URL input, and brand accent card fallback.
- [x] **B3. Inline Caption & Audio Level Editor** `[Priority: Medium]` `[STATUS: DONE]`
  - *Implemented:* Inline narration caption editor and `StudioAudioMixer` with voiceover volume slider, background music volume slider, custom music URL input, and brand accent color palette picker.
- [x] **B4. Canvas Format Switcher** `[Priority: Medium]` `[STATUS: DONE]`
  - *Implemented:* Instant 1-click aspect ratio switcher for 16:9 Landscape (1280×720), 9:16 Vertical (720×1280), and 1:1 Square (1080×1080) with auto-recommended caption styles and save persistence (`/api/studio/save`).

---

### Category C: Footage Sourcing & Generative B-Roll

- [ ] **C1. Modern Stock Video API Connectors (Pexels / Pixabay)** `[Priority: High]`
  - *Current state:* Sourcing primarily pulls from Wikimedia, Internet Archive (often vintage/low-res), and general search.
  - *Proposal:* Add Pexels and Pixabay video API connectors in `lib/engine/sourcing.ts` to source crisp, modern 1080p/4K stock clips.
- [ ] **C2. Generative AI Video (Text-to-Video / Image-to-Video)** `[Priority: High]`
  - *Current state:* When no real footage matches, system falls back to still images or solid color cards.
  - *Proposal:* Integrate AI video generation models (Kling, Luma Dream Machine, Runway Gen-3 via Fal.ai / Replicate) for complex or abstract shots.
- [ ] **C3. Asset Quality & Resolution Filter** `[Priority: Medium]`
  - *Current state:* Resolution is not strictly enforced before picking candidates.
  - *Proposal:* Filter candidates by minimum resolution (>= 720p/1080p) and aspect ratio fitness before Gemini Vision evaluation.

---

### Category D: Audio, Music & Voiceover Synthesis

- [ ] **D1. Multi-Provider TTS Support (ElevenLabs / Cartesia)** `[Priority: High]`
  - *Current state:* Relies exclusively on Speechify.
  - *Proposal:* Add provider abstraction supporting ElevenLabs (with alignment timestamps) and Cartesia for faster synthesis and expressive voice acting.
- [ ] **D2. Dynamic Sidechain Audio Ducking** `[Priority: Medium]`
  - *Current state:* Static linear volume interpolation when voice is present.
  - *Proposal:* Implement smooth sidechain compression curves so background music naturally rises during narration pauses and ducks during speech.
- [ ] **D3. Mood-Based Royalty-Free Music Library & Beat Syncing** `[Priority: Medium]`
  - *Current state:* Background music URL is passed manually or via generic generation.
  - *Proposal:* Curate a tagged royalty-free music library (Upbeat, Cinematic, Mysterious, Lo-fi) and snap shot cuts to musical downbeats.

---

### Category E: Pipeline Intelligence, Workflow & Developer Experience

- [ ] **E1. Conversational Storyboard Iteration in Chat** `[Priority: High]`
  - *Current state:* Chat creates new storyboards from scratch rather than modifying existing ones.
  - *Proposal:* Enable natural language iteration tools (e.g. *"Change music to cinematic dark synth"*, *"Make shot 2 more dramatic"*, *"Speed up the voiceover by 10%"*).
- [x] **E2. Local In-Browser Video Render Fallback (Zero AWS Required)** `[Completed: 2026-08-14]`
  - *Current state:* Studio features a high-speed In-Browser Canvas Export fallback with real-time progress (0% ➔ 100%) and instant downloadable video when AWS Lambda is not configured.
- [ ] **E3. Asset & TTS Response Caching** `[Priority: Medium]`
  - *Current state:* Sourcing and TTS calls rerun if repeated.
  - *Proposal:* Cache TTS outputs and verified media URLs in Redis by script/prompt hash to minimize API costs and speed up iterations.
- [ ] **E4. Live Progress Streaming for Sub-Agent Actions** `[Priority: Low]`
  - *Current state:* Users see a general loading spinner while tools execute.
  - *Proposal:* Stream fine-grained progress events (e.g., *"Generating chunk 2/4 of voiceover"*, *"Vision verifying 6 footage candidates"*) directly to the chat UI.

---

## 📝 3. Change Log & Updates

| Date | Contributor | Description of Changes |
| :--- | :--- | :--- |
| **2026-08-14** | AI Pair Programmer | **Photorealistic Real Satellite Map Engine:** Built [`RealSatelliteMap.tsx`](file:///c:/Users/leksi/project/vidrush-live/app-live/remotion/overlays/RealSatelliteMap.tsx) featuring ultra-high-resolution real satellite optical imagery, continuous cinematic 4K camera pan & zoom flight across the English Channel to Normandy, dynamic altitude telemetry ticker, live GPS coordinate readouts, glowing radar pings, and glowing trajectory flight paths. |
| **2026-08-14** | AI Pair Programmer | **Natural Earth GeoJSON Vector Borders + CartoDB Hybrid Map:** Embedded real world country and continent vector boundaries ([`world-geojson.ts`](file:///c:/Users/leksi/project/vidrush-live/app-live/remotion/overlays/world-geojson.ts)) layered over CartoDB/MapTiler satellite tiles with tactical nation highlighting, glowing radar pings, and flight trajectory paths in `<AnimatedMap />`. |
| **2026-08-14** | AI Pair Programmer | **MapTiler Real Satellite & Terrain Integration:** Added MapTiler API key (`MAPTILER_API_KEY`) to `.env.local` and integrated real satellite and topographical map tiles with radar pins and trajectory paths into `<AnimatedMap />`. |
| **2026-08-14** | AI Pair Programmer | **Advanced Motion Graphics Pack:** Added 3D Newspaper Headline with animated yellow marker pen highlight ([`NewspaperHeadline.tsx`](file:///c:/Users/leksi/project/vidrush-live/app-live/remotion/overlays/NewspaperHeadline.tsx)), Animated Tactical Map with radar pins and flight trajectory paths ([`AnimatedMap.tsx`](file:///c:/Users/leksi/project/vidrush-live/app-live/remotion/overlays/AnimatedMap.tsx)), and Spring Vertical Bar Chart ([`VerticalBarChart.tsx`](file:///c:/Users/leksi/project/vidrush-live/app-live/remotion/overlays/VerticalBarChart.tsx)). |
| **2026-08-13** | AI Pair Programmer | **SFX & Motion Graphic Overlays + Local Render Fallback:** Added Remotion SFX library (`whoosh`, `whip`, `pop`, `bell`), Motion Graphic Overlays (`NumberCounter`, `CircularProgress`, `FilmBurn`, `CameraShake`, `TypewriterSubtitle`, `GlitchText`), and zero-AWS In-Browser video export fallback to eliminate "Remotion Lambda is not configured" errors. |
| **2026-08-13** | AI Pair Programmer | **Data Comparison / Coded Video Template:** Added `<ComparisonGrid />` and `<ComparisonCard />` components in Remotion with 255 SVG country flags (`/flags/*.svg`), spring card entrances, live number counters (`0 -> 62 AGE`), and flag/lifespan badges. |
| **2026-08-13** | AI Pair Programmer | **VidRush Advanced Feature Pack:** Added Hide instead of delete (`shot.hidden`), Video Clip embedded audio control, Global Subtitles toggle, YouTube Subscribe CTA animation, Auto-Save (debounced to KV), Version History snapshots with restore, Transcript Export (.txt), Timestamp-aware Rush Agent, and Ghost-clip detection. |
| **2026-08-13** | AI Pair Programmer | **VidRush Studio Redesign:** Transformed studio into the exact VidRush NLE layout with multi-track timeline, orange narration blocks, transitions modal, inspector panel, floating transport bar, and Rush Agent assistant. |
| **2026-08-13** | AI Pair Programmer | Completed **Category B: Studio UI & Interactive Timeline Editor** (interactive timeline, asset picker, audio mixer, format switcher, and persistence). |
| **2026-08-13** | Initial Draft | Documented end-to-end architecture, pipeline breakdown, and established suggestions roadmap. |
