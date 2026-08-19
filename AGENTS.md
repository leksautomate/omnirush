# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Repository shape

This is a monorepo of loosely-coupled services that together make up **Kakkao Live** ("agentic
video studio" — chat interface + AI video pipeline). They deploy independently and are developed
independently; there is no shared build system.

| Dir | What it is | Deploys to |
|---|---|---|
| `app-live/` | The product: a Next.js 16 chat app (forked from [miurla/morphic](https://github.com/miurla/morphic)) extended with an agentic video-generation pipeline. Has its own `AGENTS.md` and `AGENTS.md` — read those before working inside this directory. | Vercel |
| `avatar-service/` | Python/Modal.com service running MuseTalk for audio-driven talking-avatar (A-roll) synthesis. | Modal.com (GPU) |
| `watch-service/` | Python/Fly.io fallback service: downloads a video, extracts JPEG frames + transcript, for links Gemini can't watch natively. Optional — most video-watching goes straight from `app-live` to Gemini. | Fly.io / Docker |
| `hook/` | An unrelated **HyperFrames** composition project (short-form video "hook" HTML compositions). Has its own `AGENTS.md`/`AGENTS.md` describing the HyperFrames authoring workflow — a different framework from `app-live`'s Remotion pipeline. Do not conflate the two. |
| `spike/` | Standalone Node scripts (`gen-assets.mjs`, `render-ffmpeg.mjs`) for prototyping ffmpeg-based rendering outside the main pipeline. |

The root `package.json` is a thin wrapper: `npm run dev|build|start` just `cd`s into `app-live`
and runs the same script there. There's no root-level lint/test — those live in `app-live`.

```bash
npm run dev            # cd app-live && npm run dev
npm run build           # cd app-live && npm run build
npm run spike:assets    # node spike/gen-assets.mjs
npm run spike:body      # node spike/render-ffmpeg.mjs
```

For nearly all day-to-day work you'll be inside `app-live/` — see `app-live/AGENTS.md` for its
commands (bun-based: `bun dev`, `bun run test`, `bun lint`, `bun typecheck`, etc.) and its
Next.js/Drizzle/Vercel-AI-SDK architecture.

## Environment variables

`ENV.md` at the repo root is the canonical reference — it groups every variable by which of the
three deploy targets it belongs to (Vercel `app-live` project, `watch-service`, or GitHub Actions
secrets for the Remotion Lambda deploy workflow) and marks each `[req]`/`[opt]`. Consult it before
guessing at a variable name or adding a new one.

## Cross-service architecture

`app-live` is the hub; the other services are optional satellites it calls over HTTP:

- **Chat → video pipeline**: the chat agent (Vercel AI SDK, default model DeepSeek V4 Flash —
  see `app-live/lib/config/default-model.ts`) exposes video-authoring tools from
  `app-live/lib/tools/video/` (`writeScript`, `cutBeats`, `sourceFootage`, `generateVoiceover`,
  `generateImage`, `generateMusic`, `generateAvatar`, `generateThumbnail`, `learnFromVideo`,
  `composeRender`; wired up in `app-live/lib/types/ai.ts`). `composeRender` is the
  terminal step: it assembles resolved shots/voiceover/music into a storyboard matching
  `app-live/remotion/schema.ts`, persists it to Redis/Upstash KV (`app-live/lib/engine/kv.ts`),
  and `app-live/app/studio/[id]/page.tsx` reads it back into a Remotion `<Player>` preview. Actual
  MP4 rendering happens on Remotion Lambda (`app-live/lib/remotion/lambda.ts`), configured via the
  `REMOTION_*` env vars and the "Deploy Remotion Lambda" GitHub Action.
- **Talking avatars**: `generateAvatar` (in `app-live`) calls `avatar-service` (`AVATAR_SERVICE_URL`),
  a MuseTalk model on Modal GPUs — `POST /generate_avatar` with a narration audio URL + portrait
  image, returns a lip-synced video.
- **Learn-from-video sub-agent**: the `learnFromVideo` tool (`app-live/lib/tools/video/learn-from-video.ts`)
  hands a YouTube URL to `app-live/lib/engine/video-understanding.ts`, which has Gemini watch it
  natively (no download) and reverse-engineer its structure into a style template for
  `writeScript`/`cutBeats`. `watch-service` is only invoked
  (`WATCH_SERVICE_URL`) as a fallback for links Gemini can't open directly — it returns sampled
  JPEG frames + a transcript (native captions, or Groq Whisper) for Gemini to read as images
  instead. If neither is configured, the sub-agent falls back to reasoning from the URL alone.

None of `avatar-service`/`watch-service` are required for the chat app to run — without them the
corresponding tool calls degrade gracefully (documented per-tool and in `ENV.md`).

## Python services (`avatar-service`, `watch-service`)

Both are small, single-file FastAPI-style services with no shared code between them or with
`app-live`. Each has its own README with the deploy/run commands (`modal deploy modal_app.py` for
`avatar-service`; `docker build`/`fly deploy` for `watch-service`). Check the relevant README
before changing deploy config (`fly.toml`, `Dockerfile`).
