# VidRush / Kakkao — Video Generation Workflow Architecture

This document provides a detailed end-to-end overview of how video generation works in VidRush / Kakkao (`app-live`), from initial prompt to final distributed render on Remotion Lambda.

---

## 🔄 High-Level Architecture Flowchart

```
┌─────────────────────────────────────────────────────────┐
│                   User Prompt / Topic                   │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ 1. AI Research & Scripting (writeScript tool)           │
│    - Gathers web facts via Search/Fetch                 │
│    - Generates clean, verbatim spoken narration script   │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Text-To-Speech & Timing (generateVoiceover tool)     │
│    - Synthesizes audio via Speechify API                │
│    - Obtains millisecond-accurate word-level timestamps │
│    - Stores audio URL & word timings in KV storage      │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Beat Cutting & Segmentation (cutBeats tool)          │
│    - Segments script into timed visual shots            │
│    - Locks shot durations to spoken TTS word timings    │
│    - Generates visual queries & karaoke caption words   │
│    - Returns stored `beatsId`                           │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Media Sourcing & Vision Check (sourceFootage tool)   │
│    - Searches Wikimedia, Internet Archive, & Web        │
│    - Runs Gemini Vision verification on top candidates  │
│    - Falls back to generateImage / generateAvatar / Card│
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Storyboard Assembly & Chat Preview (composeRender)   │
│    - Assembles unified `StoryboardInput` JSON schema    │
│    - Renders live interactive preview in Chat via       │
│      `<Player>` (`@remotion/player`)                    │
└────────────────────────────┬────────────────────────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
┌───────────────────────┐         ┌───────────────────────┐
│ 6a. Studio & Editing  │         │ 6b. Remotion Lambda   │
│ - Edit timeline       │         │ - Distributed render  │
│ - Swap clips / music  │         │   across AWS Lambda   │
│ - Reset / re-prompt   │         │ - Stitches MP4 to S3  │
└───────────────────────┘         └───────────────────────┘
```

---

## 📖 Detailed Step-by-Step Breakdown

### Step 1: Topic Research & Script Generation (`writeScript`)
* **Tool:** `lib/tools/video/write-script.ts`
* **Process:**
  1. If a topic, niche, or tone is provided, the agent performs preliminary research using `search` and `fetch` tools.
  2. The distilled findings are passed into `writeScript`.
  3. `writeScript` invokes the script engine (`lib/engine/script.ts`) to produce a word-for-word spoken narration script.
  4. The output is **clean spoken text** without markdown headers, bracketed directions, or audio cues, making it immediately ready for Text-To-Speech (TTS).

---

### Step 2: Text-To-Speech & Word-Level Timing (`generateVoiceover`)
* **Tool:** `lib/tools/video/generate-voiceover.ts`
* **Process:**
  1. The full narration script is passed to `generateVoiceover`.
  2. **Speechify API** synthesizes the voiceover. Long scripts are automatically split at sentence boundaries and merged into a single high-quality audio file (WAV/MP3) hosted on cloud storage (R2/S3).
  3. Speechify returns exact **millisecond word-level timestamps** (`words: [{ word, start, end }]`).
  4. The audio URL, total duration, and word array are stored in KV storage under a `voiceoverId` (`vo_...`) to avoid cluttering the LLM context.

---

### Step 3: Script Segmentation & Beat Cutting (`cutBeats`)
* **Tool:** `lib/tools/video/cut-beats.ts`
* **Process:**
  1. The narration script and `voiceoverId` are passed to `cutBeats`.
  2. The script segmentation engine (`lib/engine/beats.ts`) divides the text into logical visual scenes (shots).
  3. **Word Lock:** Shot start times and durations are strictly locked to the actual spoken word timings retrieved from the voiceover.
  4. Each shot is assigned:
     * `narration`: The exact sentence/phrase spoken during that shot.
     * `visualQuery`: Specific search term (e.g., `"Saturn V rocket launch"`).
     * `visualIntent`: Clear description of what the scene must show.
     * `words`: Millisecond word boundaries for karaoke captions.
  5. The complete timed shot list is persisted in KV storage under a `beatsId` (`bt_...`).

---

### Step 4: Source Clip Sourcing & Vision Verification (`sourceFootage`)
* **Tool:** `lib/tools/video/source-footage.ts` (alongside `generate-image.ts`, `generate-avatar.ts`)
* **Process:**
  1. For every shot in the storyboard, the AI calls `sourceFootage` with `queries` and `intent`.
  2. The sourcing engine (`lib/engine/sourcing.ts`) searches open archives (Wikimedia Commons, Internet Archive, U.S. National Archives) and general web search.
  3. **Vision Verification:** If a Gemini API key is configured, Gemini Vision inspects candidate assets to confirm that:
     * The media directly matches the `visualIntent`.
     * The image/video is high quality and free of burned-in watermarks or text overlays.
  4. **Fallback:** If no candidate passes verification, the system can generate synthetic media (`generateImage`, `generateAvatar`) or fall back to a clean brand accent card.

---

### Step 5: Storyboard Assembly & Interactive Chat Preview (`composeRender`)
* **Tool:** `lib/tools/video/compose-render.ts`
* **Process:**
  1. The AI calls `composeRender` with `beatsId`, the array of resolved media asset URLs (`src`), and optional background `music`.
  2. `composeRender` merges these inputs into the canonical `StoryboardInput` JSON schema (`remotion/schema.ts`):
     ```json
     {
       "width": 1280,
       "height": 720,
       "fps": 30,
       "brand": { "accent": "#ff2d55" },
       "shots": [
         {
           "kind": "video",
           "src": "https://...",
           "start": 0,
           "duration": 4.2,
           "words": [...]
         }
       ],
       "voice": "https://.../voiceover.mp3",
       "music": "https://.../music.mp3"
     }
     ```
  3. **Live Chat Preview (WYSIWYG):** The storyboard is rendered live in the Next.js chat UI using `@remotion/player` (`components/remotion-preview.tsx`). The preview in the chat matches the final MP4 render 1:1.
  4. The composition is also saved under a `studioId` (`sb_...`) for deep editing at `/studio/[id]`.

---

### Step 6: Studio Fine-Tuning, Reset & Remotion Lambda Render
* **Studio (`/studio/[studioId]`):** Users can adjust individual shot durations, swap footage, modify voice/music levels, or edit text captions.
* **Reset / Regeneration:** Users can prompt the AI to regenerate specific shots or restart the pipeline with new parameters.
* **Final Render (Remotion Lambda):**
  1. Clicking **Render** triggers `renderStoryboardOnLambda` (`lib/remotion/lambda.ts`).
  2. The render request fans out across multiple serverless **AWS Lambda** containers in parallel.
  3. Frame rendering and audio mixing complete on AWS infrastructure in seconds without putting CPU/RAM load on the primary VPS.
  4. The final `.mp4` video is saved to AWS S3 and returned as a public download URL.

---

## 🔑 Key Technical Design Decisions

1. **Zero VPS CPU/RAM Strain:** All heavy video processing happens off-server on AWS Lambda.
2. **KV Handle Pattern:** Heavy datasets (word-level timestamps, full storyboards) are passed between steps via small KV identifiers (`voiceoverId`, `beatsId`, `studioId`) to keep LLM context light and prevent token truncation.
3. **Single Source of Truth:** `remotion/schema.ts` defines the single `StoryboardInput` schema shared by the preview player, studio canvas, and Lambda renderer.
