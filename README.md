# Kakkao Live (vidrush-live)

Agentic video studio: a chat interface that researches a topic, writes a script, sources or
generates footage, synthesizes voiceover, cuts it into a timed storyboard, and renders a
finished MP4 — end to end from a single prompt.

This repo is a **monorepo of loosely-coupled services**. They deploy independently and don't
share a build system; most day-to-day work happens inside `app-live/`.

## Repository shape

| Dir | What it is | Deploys to |
|---|---|---|
| [`app-live/`](./app-live) | The product: a Next.js 16 chat app (forked from [miurla/morphic](https://github.com/miurla/morphic)) extended with an agentic video-generation pipeline. Has its own [`README.md`](./app-live/README.md), `CLAUDE.md`, and `AGENTS.md` — read those before working inside this directory. | Vercel |
| [`avatar-service/`](./avatar-service) | Python/Modal.com service running MuseTalk for audio-driven talking-avatar (A-roll) synthesis. | Modal.com (GPU) |
| [`watch-service/`](./watch-service) | Python/Fly.io fallback service: downloads a video, extracts JPEG frames + transcript, for links Gemini can't watch natively. Optional — most video-watching goes straight from `app-live` to Gemini. | Fly.io / Docker |
| [`hook/`](./hook) | An unrelated **HyperFrames** composition project (short-form video "hook" HTML compositions). Has its own `CLAUDE.md`/`AGENTS.md` — a different framework from `app-live`'s Remotion pipeline. | — |
| [`spike/`](./spike) | Standalone Node scripts for prototyping ffmpeg-based rendering outside the main pipeline. | — |

## How it works

`app-live` is the hub; the pipeline runs as a sequence of chat-agent tools
(`lib/tools/video/`): `writeScript` → `generateVoiceover` (Speechify, with word-level timing) →
`cutBeats` (segments the script into timed shots) → `sourceFootage` / `generateImage` /
`generateAvatar` (resolves each shot's visual) → `composeRender` (assembles everything into a
`StoryboardInput`, previewed live in-chat via `@remotion/player`, then rendered to MP4 on
**Remotion Lambda**).

See [`how.md`](./how.md) for the detailed step-by-step architecture and flowchart, and
[`app-live/docs/REMOTION_LAMBDA.md`](./app-live/docs/REMOTION_LAMBDA.md) for the render pipeline
specifically.

## Requirements

- **Node.js 22.x** and **[Bun](https://bun.sh)** (the package manager and script runner for
  `app-live`)
- **PostgreSQL** — chat history (`DATABASE_URL`)
- **Upstash Redis (or compatible)** — required for the Studio flow (`composeRender` persists
  storyboards to KV; without it, `/studio/[id]` links don't survive a serverless cold start)
- At least one **chat-model API key** (ModelArk, OpenAI, Anthropic, Google, Ollama, or an
  OpenAI-compatible endpoint)
- **Tavily** (or another search provider) for research + footage discovery
- **Speechify** for voiceover TTS
- **AWS account** for Remotion Lambda rendering (final MP4 export — optional, the in-chat
  preview works without it)

Everything else (footage archives, image generation, avatar synthesis, analytics, auth) is
optional and degrades gracefully when unset. The full, grouped list of every variable — with
`[req]`/`[opt]` markers per feature — lives in [`ENV.md`](./ENV.md); start there before adding a
new one.

> **Security note:** never commit real API keys into `ENV.md`, `.env.local`, or any tracked
> file — use placeholders in anything checked into git, and keep actual secrets in your local
> `app-live/.env.local` (gitignored) or your deploy target's secret store (Vercel project env,
> GitHub Actions repo secrets, Fly.io secrets).

## Quick start

```bash
git clone https://github.com/macthedonald/vidrush-live.git
cd vidrush-live/app-live
bun install
cp .env.local.example .env.local   # then fill in the keys described in ENV.md
bun dev
```

Visit `http://localhost:3000`. See [`app-live/README.md`](./app-live/README.md) for Docker
Compose (the fastest path — bundles Postgres, Redis, and SearXNG) and
[`local.md`](./local.md) for a from-scratch VPS self-hosting guide.

## Root-level scripts

```bash
npm run dev            # cd app-live && npm run dev
npm run build           # cd app-live && npm run build
npm run spike:assets    # node spike/gen-assets.mjs
npm run spike:body      # node spike/render-ffmpeg.mjs
```

There's no root-level lint/test — those live in `app-live` (`bun lint`, `bun typecheck`,
`bun run test`).

## Deploying

| Service | How |
|---|---|
| `app-live` | Push to Vercel; set env vars per [`ENV.md`](./ENV.md) §1 |
| Remotion Lambda (MP4 render) | One-time `bunx remotion lambda functions deploy` + `sites create` (see [`app-live/docs/REMOTION_LAMBDA.md`](./app-live/docs/REMOTION_LAMBDA.md)), or trigger the **Deploy Remotion Lambda** GitHub Action from the Actions tab |
| `avatar-service` | `modal deploy modal_app.py` — see [`avatar-service/README.md`](./avatar-service/README.md) |
| `watch-service` | `fly deploy` / Docker — see [`watch-service/README.md`](./watch-service/README.md) |

## Contributing

Contributions are welcome! Please read [`CONTRIBUTING.md`](./CONTRIBUTING.md) for details on setting up your local development environment, running tests, and submitting pull requests.

## License

See [`app-live/LICENSE`](./app-live/LICENSE) (Apache License 2.0).
