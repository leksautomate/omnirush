# Studio Media, Pacing, and Dola Chat Design

**Date:** 2026-08-16  
**Status:** Approved with item 8 removed  
**Repository rule:** Keep all work uncommitted until the user explicitly asks for a commit.

## Goal

Make Kakkao's WW1/WW2 documentary workflow consistently produce an editable premium documentary: a usable full-project timeline, several caption treatments, uncropped researched media, semantically selected muted video excerpts, documentary overlays, restrained film grain, and beats that are long enough to understand. Register Dola Seed 2.0 Pro, Mini, and Lite as ModelArk chat models, with Pro as the default.

This slice does **not** repair or regenerate the user's latest saved storyboard. It fixes the pipeline and Studio for future projects.

## Decisions

### 1. Timeline visibility

The timeline gets a `Fit` mode that calculates its scale from project duration and available viewport width. At long durations the scale may go below the old 40 px/s minimum. Manual zoom exits Fit mode, and selecting a shot scrolls its midpoint into view. A compact overview shows the entire project and the currently visible region.

The timeline remains horizontally scrollable and the existing trim handles remain available. The fixed Studio timeline area may be resized within a safe minimum and maximum so stacked tracks are not hidden.

### 2. Caption families

The canonical schema supports:

- `documentary`: restrained lower-third phrases with a subtle dark plate;
- `karaoke`: word-level highlight synchronized to timed words;
- `minimal`: small clean subtitle near the lower safe area;
- `tiktok`: the existing energetic pop style;
- `full-sentence`: readable sentence blocks;
- `normal`: retained as a legacy alias for `full-sentence` so old projects still load.

All styles use the existing timed word data and respect title/action safe margins. Studio exposes visual cards for the five user-facing choices.

### 3. Preserve researched-media aspect ratio

Storyboard shots gain `mediaFit: 'contain' | 'cover'`.

- Researched or archival media defaults to `contain` so a 9:16 image/video remains 9:16 inside a 16:9 documentary frame.
- Generated backgrounds and explicitly cinematic full-frame assets may use `cover`.
- The empty area behind contained media uses a blurred, darkened copy of the same asset rather than stretching the source.
- Studio exposes a per-shot Fit/Fill switch.

This rule applies to both still images and MP4 clips, including archival photo treatment.

### 4. Intelligent MP4 excerpt selection

Kakkao does not re-encode source videos during composition. It stores a non-destructive source window on each shot:

```ts
interface ShotMediaWindow {
  mediaStart?: number // seconds in source media
  mediaEnd?: number   // seconds in source media
  mediaMuted?: boolean
}
```

When an MP4 candidate is selected, ModelArk receives the beat narration, visual intent, and video. It returns the strongest continuous section with start/end seconds and a short reason. The response is validated and clamped to the source duration. The selected window must be at least as long as the storyboard shot. If it is not, the candidate is rejected in favor of another clip or a still/graphic.

Remotion plays only `mediaStart..mediaEnd` and always mutes researched footage by default. Voiceover, curated Pixabay music, ambience, and sound effects remain separate audio layers. Studio lets the user adjust the in/out points and explicitly opt into source audio later, but the default is muted.

### 5. Minimum beat pacing

Each normal documentary beat must satisfy both constraints:

- at least 10 seconds of narration time;
- at least 15 narrated words.

Duration is authoritative: 15 quickly spoken words do not justify a short beat. After word timing is known, a deterministic merger combines adjacent short beats while preserving all narration, timestamps, claims, and source intent. A short final remainder merges into the previous beat. A whole video shorter than 10 seconds is the only exception.

The language-model prompt also asks for these limits, but deterministic validation enforces them even when model output is poor.

### 6. Documentary graphic coverage

Keyword matching alone is insufficient. After semantic beat planning, a coverage pass distributes supported graphics across the documentary:

- the opening gets date and location;
- geographic movement gets at least one battle map when researched locations exist;
- aircraft/equipment narration gets a specification card when dossier values exist;
- chronology gets a military timeline;
- numeric comparisons get statistics or force comparison;
- supported primary-source material may get an evidence or quotation card.

No graphic may invent a value. A requested graphic without dossier evidence falls back to archival media and creates a QA warning.

When exact voiceover narration differs from the stored documentary narration, `cutBeats` accepts a narration override while retaining the documentary dossier and semantic metadata. This prevents the generic script cutter from discarding maps and overlays.

### 7. Film grain

The storyboard gains a global `filmGrainIntensity` value from `0` to `1`.

- WW1/WW2 documentary projects default to a restrained value of `0.18`.
- Generic projects default to `0`.
- The effect is a deterministic monochrome grain/scratch overlay above media and below captions/critical text.
- Maps, evidence cards, citations, and statistics receive reduced grain so data remains readable.
- Studio provides an on/off control and intensity slider.

Background `bg3.mp4` remains available as a stronger archival film-gate treatment, but it is separate from the global subtle grain.

### 8. Dola Seed chat models

Register the exact ModelArk IDs already used by the project:

| Display name | Model ID | Role |
|---|---|---|
| Dola Seed 2.0 Pro | `seed-2-0-pro-260328` | default chat/research model |
| Dola Seed 2.0 Mini | `seed-2-0-mini-260428` | faster selectable model |
| Dola Seed 2.0 Lite | `seed-2-0-lite-260428` | lowest-cost selectable model |

Unprefixed `seed-*` IDs route to the ModelArk provider. The default model is Pro when ModelArk credentials are configured. The model selector presents all three choices.

## Data Contract Changes

`remotion/schema.ts` gains backward-compatible optional fields:

```ts
mediaFit?: 'contain' | 'cover'
mediaStart?: number
mediaEnd?: number
mediaMuted?: boolean
filmGrainIntensity?: number
captionStyle?:
  | 'normal'
  | 'documentary'
  | 'karaoke'
  | 'minimal'
  | 'tiktok'
  | 'full-sentence'
```

Old storyboards continue to parse. Renderer defaults are derived from asset origin when the new fields are absent.

## Failure Behaviour

- Invalid or missing model timestamps fall back to the clip start only when that segment is long enough; otherwise the candidate is rejected.
- A video URL the vision model cannot inspect remains usable only as a still/reference until a playable original is resolved.
- Unknown source duration prevents automatic trimming and is reported in sourcing output.
- A missing graphic data field never renders fabricated text.
- Film grain failure leaves the clean underlying frame visible.
- Caption word timing gaps fall back to sentence-level timing without crashing Studio.

## Acceptance Criteria

1. A three-minute project can be fitted entirely into the timeline viewport and selected shots auto-scroll into view.
2. Five caption choices render differently; old `normal` projects still render.
3. A 9:16 researched image and MP4 render uncropped inside a 16:9 project by default.
4. An MP4 shot persists validated in/out seconds and renders that range with source audio muted.
5. Every documentary beat in a project longer than 10 seconds has at least 10 seconds and 15 words after pacing normalization.
6. A researched WWII aircraft documentary receives a date/location opening plus supported map, specification, timeline, and statistic graphics.
7. Film grain is visible at the WWII default, adjustable, deterministic, and does not obscure graphic text.
8. Dola Seed 2.0 Pro is the default chat model; Mini and Lite are selectable and all three route through ModelArk.
9. Existing saved storyboards load without migration.
10. No existing storyboard is repaired or regenerated as part of this slice.

