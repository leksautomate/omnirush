# Studio Media, Pacing, and Dola Chat Implementation Plan

> Execute in order. Use test-driven development for every behavior change. Do not commit; the user explicitly deferred commits.

**Goal:** Implement the approved Studio timeline, captions, researched-media fit and intelligent muted trimming, minimum documentary pacing, overlay coverage, film grain, and Dola Seed ModelArk chat configuration.

**Architecture:** Extend the canonical storyboard schema first, then make both Studio and Remotion consume those same fields. Put deterministic business rules—timeline scale, beat merging, timestamp validation, graphic coverage, and model routing—in pure helpers with focused tests. Keep MP4 trimming non-destructive by storing source in/out points and applying them at render time.

**Stack:** Next.js 16, React, TypeScript, Vercel AI SDK, Zod, Remotion, Vitest, ModelArk.

---

## Task 1: Record the baseline and extend the storyboard schema

**Files:**
- Modify: `app-live/remotion/schema.ts`
- Modify: `app-live/remotion/types.ts` if it duplicates schema types
- Test: `app-live/remotion/__tests__/schema.test.ts`

1. Run the existing focused schema/renderer tests and record current failures without changing unrelated files.
2. Add failing parsing tests for the five caption styles, legacy `normal`, `mediaFit`, valid/invalid media windows, `mediaMuted`, and bounded `filmGrainIntensity`.
3. Add backward-compatible optional schema fields. Refine `mediaEnd > mediaStart` when both exist and clamp grain to the declared `0..1` contract through validation, not rendering.
4. Run the focused tests. Review the diff; do not commit.

## Task 2: Make the full timeline visible

**Files:**
- Create: `app-live/components/studio/timeline-scale.ts`
- Modify: `app-live/components/studio/vidrush-multi-track-timeline.tsx`
- Modify: `app-live/components/studio-canvas.tsx`
- Test: `app-live/components/studio/__tests__/timeline-scale.test.ts`
- Test: `app-live/components/studio/__tests__/vidrush-multi-track-timeline.test.tsx`

1. Write failing pure tests for fitted pixels-per-second at 30 seconds, 3 minutes, and 60 minutes, including narrow viewports and zero duration.
2. Implement `fitPixelsPerSecond(totalDuration, viewportWidth, fixedHeaderWidth, padding)` with safe clamping and no old 40 px/s lower bound in Fit mode.
3. Write interaction tests for Fit, manual zoom leaving Fit, selected-shot centering, and overview viewport position.
4. Add a measured scroll viewport, Fit button, compact overview, and selected-shot auto-scroll. Keep the track-label column sticky.
5. Make the timeline pane height adjustable within safe limits so tracks remain visible.
6. Run the focused tests and manually inspect a 190-second fixture. Review the diff; do not commit.

## Task 3: Add five caption treatments

**Files:**
- Modify: `app-live/remotion/Captions.tsx`
- Modify: `app-live/components/studio/vidrush-inspector-panel.tsx`
- Test: `app-live/remotion/__tests__/captions.test.tsx`
- Test: `app-live/components/studio/__tests__/vidrush-inspector-panel.test.tsx`

1. Write failing component tests showing that each style produces a distinct wrapper/data marker and that `normal` resolves to full-sentence behavior.
2. Extract shared timed-word grouping and safe-area helpers.
3. Implement Documentary, Karaoke, Minimal, TikTok, and Full Sentence renderers. Use frame-based Remotion timing only; avoid wall-clock state.
4. Replace the two-option inspector control with five visual choices while retaining the stored legacy value.
5. Run focused tests and capture representative preview frames. Review the diff; do not commit.

## Task 4: Preserve source aspect ratio in preview and render

**Files:**
- Create: `app-live/remotion/MediaFrame.tsx`
- Modify: `app-live/remotion/Storyboard.tsx`
- Modify: `app-live/remotion/documentary/ArchivalPhotoTreatment.tsx`
- Modify: `app-live/components/studio/vidrush-inspector-panel.tsx`
- Modify: `app-live/lib/tools/video/compose-render.ts`
- Test: `app-live/remotion/__tests__/media-frame.test.tsx`
- Test: `app-live/lib/tools/video/__tests__/compose-render.test.ts`

1. Write failing tests proving researched image/video defaults to `contain`, generated/manual full-frame media may remain `cover`, and explicit `mediaFit` wins.
2. Implement a shared MediaFrame with a blurred/dark background copy and an uncropped foreground for `contain`.
3. Route stills, videos, and archival-photo treatment through MediaFrame.
4. Preserve `mediaFit` and source-origin metadata in composition and add a per-shot Fit/Fill inspector control.
5. Render one 9:16 still and one 9:16 MP4 in a 16:9 fixture and visually verify there is no stretching or cropping. Review the diff; do not commit.

## Task 5: Select and render the important muted MP4 section

**Files:**
- Create: `app-live/lib/engine/video-segments.ts`
- Modify: `app-live/lib/tools/video/source-footage.ts`
- Modify: `app-live/lib/engine/sourcing.ts`
- Modify: `app-live/lib/tools/video/compose-render.ts`
- Modify: `app-live/remotion/Storyboard.tsx`
- Modify: `app-live/components/studio/vidrush-inspector-panel.tsx`
- Test: `app-live/lib/engine/__tests__/video-segments.test.ts`
- Test: `app-live/lib/tools/video/__tests__/source-footage.test.ts`
- Test: `app-live/remotion/__tests__/storyboard-video-window.test.tsx`

1. Write failing tests for structured timestamp parsing, clamping, minimum-window enforcement, source-duration bounds, malformed model output, and too-short candidate rejection.
2. Implement `selectRelevantVideoSegment` using the existing ModelArk video-input pattern. Give it narration, visual intent, minimum duration, source duration, and the resolved MP4 URL. Require JSON `{start,end,reason}`.
3. Persist the chosen range with the selected footage result and carry it through compose without dropping it.
4. Convert seconds to Remotion frames for the video component's source range. Set `muted` from `mediaMuted`, defaulting researched video to `true`.
5. Add in/out controls in Studio with validation; keep source audio off by default.
6. Test with a deterministic local MP4 fixture and verify the played source range and muted prop. Review the diff; do not commit.

## Task 6: Enforce 10-second, 15-word documentary beats

**Files:**
- Create: `app-live/lib/engine/beat-pacing.ts`
- Modify: `app-live/lib/engine/beats.ts`
- Modify: `app-live/lib/engine/documentary/planner.ts`
- Test: `app-live/lib/engine/__tests__/beat-pacing.test.ts`
- Test: `app-live/lib/engine/__tests__/beats.test.ts`

1. Write table-driven failing tests for short adjacent beats, adequate-duration/low-word beats, final remainders, a whole project shorter than 10 seconds, metadata union, and total-duration preservation.
2. Implement deterministic adjacent merging after timed words are available. Reindex shots, concatenate narration/words, union claim/entity/location IDs, and keep timestamps continuous.
3. Update the model prompt to request at least 15 words and 10 seconds per normal documentary beat.
4. Apply the same normalizer to generic script cuts in documentary mode and semantic documentary planning.
5. Add assertions that no narration or timed word is dropped and the project end time is unchanged. Review the diff; do not commit.

## Task 7: Guarantee supported documentary maps and overlays

**Files:**
- Create: `app-live/lib/engine/documentary/graphic-coverage.ts`
- Modify: `app-live/lib/engine/documentary/planner.ts`
- Modify: `app-live/lib/tools/video/cut-beats.ts`
- Modify: `app-live/lib/agents/researcher.ts`
- Test: `app-live/lib/engine/documentary/__tests__/graphic-coverage.test.ts`
- Test: `app-live/lib/tools/video/__tests__/cut-beats.test.ts`

1. Write failing tests for opening date/location, battle map, equipment specification, timeline, statistics/force comparison, evidence/quote eligibility, and the no-evidence fallback warning.
2. Implement a coverage pass that spreads eligible graphics rather than overwriting one beat repeatedly. Use only dossier-backed values.
3. Add an optional narration override to the documentary cut path. It must replace spoken text/timing input while retaining chapters, claims, locations, equipment, citations, and graphic instructions.
4. Update the researcher workflow so a documentary never switches to generic `scriptId` cutting merely to align voiceover.
5. Run a deterministic three-minute Battle of Stalingrad fixture and assert the required supported graphic types survive compose. Review the diff; do not commit.

## Task 8: Add deterministic adjustable film grain

**Files:**
- Create: `app-live/remotion/documentary/FilmGrain.tsx`
- Modify: `app-live/remotion/Storyboard.tsx`
- Modify: `app-live/lib/engine/documentary/preset.ts`
- Modify: `app-live/components/studio/vidrush-inspector-panel.tsx`
- Test: `app-live/remotion/documentary/__tests__/FilmGrain.test.tsx`
- Test: `app-live/lib/engine/documentary/__tests__/preset.test.ts`

1. Write failing tests for default WWII intensity `0.18`, generic intensity `0`, deterministic frame output, zero-intensity omission, and reduced opacity over information-heavy graphics.
2. Implement a frame-seeded monochrome grain/scratch layer with `pointer-events: none`. Keep it above media and below captions/critical overlays.
3. Apply the documentary preset default and preserve explicit storyboard overrides.
4. Add an on/off control and intensity slider in Studio. Keep `bg3` as a separate stronger archival treatment.
5. Capture identical frames twice to prove deterministic output and verify map/evidence text remains readable. Review the diff; do not commit.

## Task 9: Register Dola Seed models and route them to ModelArk

**Files:**
- Modify: `app-live/lib/config/default-model.ts`
- Modify: `app-live/lib/models/fetch-models.ts`
- Modify: `app-live/lib/utils/registry.ts`
- Modify: `app-live/config/models/cloud.json`
- Test: `app-live/lib/models/__tests__/fetch-models.test.ts`
- Test: `app-live/lib/utils/__tests__/registry.test.ts`
- Test: `app-live/lib/config/__tests__/default-model.test.ts`

1. Write failing tests for all three exact IDs/display names, `seed-*` ModelArk routing, and Pro default selection.
2. Add Pro/Mini/Lite to the ModelArk catalogue. Do not remove unrelated provider models unless the current configuration explicitly replaces them.
3. Route unprefixed `seed-*` through ModelArk and set `seed-2-0-pro-260328` as the ModelArk default chat model.
4. Update cloud quick/adaptive choices so the UI resolves valid registered models; Pro remains the main default and Mini/Lite remain selectable.
5. Exercise one non-streaming and one streaming mocked chat request per Seed model. Review the diff; do not commit.

## Task 10: Cross-feature verification

**Files:**
- Create: `app-live/remotion/fixtures/stalingrad-documentary-smoke.json`
- Modify tests only where a genuine cross-feature contract needs coverage.

1. Run all focused tests from Tasks 1–9.
2. Run `bun typecheck`, `bun lint`, and the full test suite. Separate unchanged baseline failures from regressions.
3. Render a deterministic three-minute 16:9 Battle of Stalingrad fixture containing a 9:16 still, a trimmed muted MP4, date/location, animated battle map, equipment specification, timeline/statistic card, documentary captions, and film grain.
4. Inspect frames at the opening, map, specification, and video section. Verify uncropped media, readable graphics, grain, correct caption style, and no source-video audio.
5. Confirm every normal beat satisfies the 10-second/15-word rule and all source windows remain within media duration.
6. Confirm the chat selector displays Dola Seed Pro/Mini/Lite and resolves Pro as default.
7. Review the complete working-tree diff. Do not repair the previous storyboard and do not commit.

## Completion Evidence

Provide the user with:

- focused and full test results;
- typecheck/lint results with any pre-existing failures identified;
- the rendered smoke MP4 path and inspected frame paths;
- confirmation that researched media is uncropped and MP4 source audio is muted;
- beat duration/word-count summary;
- documentary graphic coverage summary;
- film-grain default and adjustability confirmation;
- Dola model IDs, routing, and default confirmation;
- confirmation that no commit and no latest-storyboard repair occurred.
