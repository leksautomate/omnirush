# 📜 VidRush Live — Comprehensive Change Log

All notable changes, new architectures, Remotion components, APIs, and workstation features implemented in **VidRush Live**.

---

## 🚀 [Unreleased] — 2026-08-14

### 🛰️ Real Satellite Maps & Geolocation Video Engine
- **MapTiler wired up for real satellite imagery (`lib/engine/maptiler.ts`, 2026-08-14):**
  - Typing an Origin/Destination Pin in the Studio Inspector's Animated Map settings now calls MapTiler's Geocoding API to resolve real coordinates for both places, then builds a real MapTiler satellite **Static Maps** image (`/maps/satellite/static/auto/...png?path=...`) framing both points with a flight-path line drawn between them — persisted on the shot's `overlay.mapImageUrl`/`fromCoords`/`toCoords` (new `remotion/schema.ts` fields), so Studio preview and the final Lambda render both show the same real image with no extra render-time fetch.
  - `RealSatelliteMap.tsx`'s altitude/GPS HUD readout now reflects the real resolved coordinates instead of the hardcoded London/Normandy defaults.
  - Falls back to the previous generic stock plate if `MAPTILER_API_KEY`/`NEXT_PUBLIC_MAPTILER_API_KEY` isn't configured, or if a typed place name can't be geocoded — surfaced to the editor via a status line, not a silent failure.
  - Scope note: this overlay is still only added by hand via the Studio Inspector's overlay dropdown — no automatic pipeline step (writeScript/cutBeats/niche detection) attaches an "animated-map" overlay on its own yet.
- **Single-location zoom-in mode, added 2026-08-14** — not every use is a journey between two places (biography, true-crime, disaster-report beats usually mention just one location):
  - Destination Pin is now optional. Filling only the Location Pin resolves that one place via MapTiler geocoding and requests a centered/zoomed satellite static image (`lib/engine/maptiler.ts`'s `buildSingleLocationMapUrl`, zoom 13 — town/neighborhood level) instead of the two-point flight-path image.
  - `RealSatelliteMap.tsx` switches its whole presentation on whether a destination was given: single-location mode drops the flight-path arc and second pin, turns the camera move into a straight dramatic push-in (zoom 1.0x → 1.75x) centered on the one pin, and swaps the HUD copy ("SATELLITE RECONNAISSANCE — LOCATION LOCK" / "TARGET STATUS: LOCKED") instead of the flight-path wording.
- **Reconnaissance Overlay chrome (`RealSatelliteMap.tsx`):**
  - Continuous 4K cinematic camera flight with smooth pan and deep zoom into destination (`Zoom 1.0x ➔ 1.45x`).
  - Military Tactical Telemetry HUD: descending altitude ticker (`ALT: 28,500 FT ➔ 4,200 FT`) and compass grid over the real satellite plate.
  - Glowing curved cyan-to-orange flight trajectory arc, glassmorphism sonar radar pins with animated expanding radar ping waves.
- **Stylized Continent Silhouettes (`world-geojson.ts`):**
  - Hand-drawn approximate region/continent shapes (UK, Western Europe, Eastern Europe, Americas, Asia, Africa, Japan, Australia) for the HUD map — a stylized backdrop layer, separate from the real MapTiler satellite plate above. Not Natural Earth data and not real coastline boundaries — each region is a 4-9 point polygon on an arbitrary 1000x600 canvas, not lon/lat.
  - Tactical country shading & highlighting with glowing drop shadows for focus nations.

---

### 📰 Advanced Motion Graphics Pack
- **3D Floating Newspaper Headline (`NewspaperHeadline.tsx`):**
  - Perspective 3D floating newspaper front page (`perspective: 1800`) with authentic print typography (`THE DAILY CHRONICLE`).
  - Animated glowing yellow highlighter marker pen stroke that highlights key words in real-time as spoken in the script.
  - Publication name, category badge, date, headline, lead summary, and byline.
- **Spring Vertical Bar Chart (`VerticalBarChart.tsx`):**
  - Spring-animated vertical comparison columns (`spring({ damping: 14 })`) with momentum bounce.
  - Highlighted focus pillar in accent color with glowing shadow.
  - Tabular numerals floating on top of each bar that tick up to their final value.

---

### 🎨 Niche-Aware Auto-Overlays & Presets (`niche-presets.ts`)
- **Automated Niche Detection:**
  - **WW1 / WW2 & History:** Auto-assigns Film Burn light leaks, Typewriter subtitles on dates/locations (*"June 6, 1944 — Normandy"*), Camera Shake on battle cuts, and historical brass palette (`#c29b38`).
  - **Finance & Business:** Auto-assigns Number Counter tickers (`$100,000`, `+45%`) and Emerald palette (`#10b981`).
  - **Science & Space:** Auto-assigns Circular Progress rings (`85%`), Glitch text, and Electric Space Blue (`#3b82f6`).
  - **True Crime & Mystery:** Auto-assigns Typewriter investigation files and Crimson Red (`#dc2626`).
- **Studio Shot Overlay Selector:**
  - Interactive dropdown in the Studio Inspector to toggle and customize any overlay per clip (`Film Burn`, `Camera Shake`, `Typewriter`, `Number Counter`, `Circular Progress`, `Glitch`, `Newspaper`, `Animated Map`, `Bar Chart`).

---

### 🔊 Sound Effects (SFX) & In-Browser Local Render Fallback
- **Remotion SFX Library (`sfx.tsx`):**
  - Built-in transition sound effects (`whoosh`, `whip`, `pop`, `bell`) synchronized to scene cuts and number counters.
- **Local In-Browser Video Export (Zero AWS Required):**
  - Eliminated `"Remotion Lambda is not configured"` blocking errors — falls back automatically when Lambda isn't configured.
  - **Fixed 2026-08-14** (`studio-canvas.tsx`): the original fallback captured a `MediaStream` via `canvas.captureStream()` but never attached a `MediaRecorder`, so no video was ever encoded — the "Download MP4" button actually downloaded a `.json` dump of the storyboard. Now it records real WebM via `MediaRecorder` when the preview renders to a `<canvas>`, plays the timeline in real time while recording, and downloads an actual `.webm` file labeled correctly. Remotion's `<Player>` renders via DOM by default (not canvas), so most compositions won't hit the capture path — in that case the button now surfaces a clear error asking to configure Remotion Lambda, instead of silently faking a 100% progress bar and handing back a mislabeled JSON file.

### 🎞️ Timeline Fix
- **Broken video thumbnails in the multi-track timeline (`vidrush-multi-track-timeline.tsx`), fixed 2026-08-14:**
  - Clips rendered `<img src={shot.thumb || shot.src}>` — `thumb` isn't a field on `Shot` (nothing in the pipeline ever sets it, and it was a TypeScript error), so it was always `undefined` and fell through to `shot.src`. For `video`/`avatar`/`a-roll` shots that's a video file URL, and `<img>` can't display one — every non-photo clip showed a broken-image icon in the timeline. Now those kinds render via a muted `<video preload="metadata">`, which shows the real first frame natively; `photo` shots still use `<img>`.

---

## ⚡ [Previous Updates] — 2026-08-13

### ⚔️ Data Comparison & Ranked Infographic Format
- **3-Column Coded Comparison Grid (`ComparisonCard.tsx` & `ComparisonGrid.tsx`):**
  - Integrated 255 SVG country flags (`public/flags/*.svg`).
  - Subject portraits with country flag badges and lifespan dates pills (`1483–1546`).
  - High-contrast gold name banners and red subtitle ribbons.
  - Cause of death section with live rolling age number counters (`0 ➔ 62 AGE`).
  - Sequential spring entrances from left to right (`spring({ damping: 14 })`).

### 🎬 VidRush Multi-Track Timeline & Studio Workstation
- **Multi-Track NLE Timeline:**
  - Seconds time ruler with draggable playhead laser needle spanning all tracks.
  - Clip trim drag handles, transition markers (⚡), and ghost-clip alerts.
  - Dedicated tracks for Visuals, Narration (orange blocks), Captions, and Music Bed (cyan strip).
- **Transitions Modal (`VidrushTransitionModal`):**
  - Crossfade, Whip Pan, Zoom Blur, Slide, Film Burn, and Hard Cut.
- **Inspector Panel (`VidrushInspectorPanel`):**
  - **Shot Tab:** Replace media, duration slider, Ken Burns motion toggle, narration editor, hide/unhide eye button, clip audio volume, and Motion Overlays selector.
  - **Audio Tab:** Voiceover, Background Music, and Template SFX volume sliders.
  - **Style Tab:** Global Subtitles toggle, Subscribe CTA toggle, Normal vs. TikTok layout, Accent color palette, and Transcript Export (.txt).
  - **Agent Tab:** Timestamp-aware Rush Agent (parses timecodes, sources footage, hides clips).
  - **History Tab:** Auto-saved snapshots with 1-click restore.
- **Spring-Animated Subscribe CTA (`SubscribeCta.tsx`):**
  - YouTube Subscribe card with glowing avatar and ringing bell animation.
- **Bug Fixes:**
  - Fixed ModelArk JSON format error in YouTube reference video analysis (`learnFromVideo`).
  - Updated Gemini model defaults to `gemini-2.0-flash`.
