# Omnirush 🎬

> **Agentic AI Video Studio**: Research topics, write scripts, source b-roll, generate AI frames, synthesize synchronized voiceovers, cut beat-timed storyboards, and render full MP4 videos — end-to-end from a single prompt.

![Omnirush Banner](./vidrush-home.png)

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./app-live/LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black)](https://nextjs.org/)
[![Remotion](https://img.shields.io/badge/Remotion-4.0-blueviolet)](https://www.remotion.dev/)
[![Bun](https://img.shields.io/badge/Bun-1.2-fbf0df)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6)](https://www.typescriptlang.org/)

---

## ✨ Features

- 🤖 **End-to-End Autonomous Pipeline**: Give Omnirush a prompt, topic, or YouTube link — it researches, outlines, narrates, and composes a complete documentary or short video.
- 🗣️ **Synchronized Voiceovers**: Word-level timestamp alignment powered by Speechify TTS so every visual beat locks perfectly with spoken audio.
- 📚 **Smart B-Roll & Archive Sourcing**: Automated retrieval and rights classification across Wikimedia Commons, Internet Archive, US National Archives, Tavily, Pexels, and Coverr.
- 🎨 **AI Visuals & Avatars**: Generates Seedream AI artwork and thumbnails (BytePlus ModelArk) and audio-driven lip-synced talking avatars (MuseTalk on Modal GPUs).
- 🎛️ **Interactive Studio Timeline**: Inspect beat pacing, swap video clips, tune caption styles, and preview changes live in-browser using `@remotion/player`.
- ⚡ **Cloud MP4 Rendering**: Ultra-fast serverless rendering pipeline powered by **Remotion Lambda** on AWS.

---

## 📐 Monorepo Architecture

Omnirush is built as a monorepo of specialized, loosely-coupled services:

| Directory | Description | Technology | Deployment |
|---|---|---|---|
| [`app-live/`](./app-live) | **Core Web App & Studio**: Next.js chat interface, AI tools, Studio timeline editor, and Remotion composition engine | Next.js 16, TypeScript, Remotion | Vercel |
| [`avatar-service/`](./avatar-service) | **Talking Avatar Service**: Audio-driven lip-synced portrait generator (MuseTalk) | Python, FastAPI, Modal GPUs | Modal.com |
| [`watch-service/`](./watch-service) | **Video Understanding Fallback**: Extracts sampled JPEG frames + transcripts for YouTube links | Python, Docker, Whisper | Fly.io / Docker |
| [`hook/`](./hook) | **HyperFrames Composition**: Framework for short-form HTML video hook compositions | HTML/CSS, Remotion | Web |
| [`spike/`](./spike) | **CLI Prototypes**: Standalone ffmpeg rendering and asset-generation scripts | Node.js, FFmpeg | Local CLI |

---

## ⚡ How the Pipeline Works

```mermaid
graph TD
    A[User Prompt / Topic] --> B[Researcher Agent / Tavily]
    B --> C[writeScript]
    C --> D[generateVoiceover / Speechify TTS]
    D --> E[cutBeats / Script Segmenter]
    E --> F[sourceFootage / generateImage / generateAvatar]
    F --> G[composeRender / Storyboard KV]
    G --> H[In-Chat Remotion Player Preview]
    H --> I[Remotion Lambda Cloud MP4 Export]
```

1. **`writeScript`**: Formulates a detailed narrative script tailored to your target niche and tone.
2. **`generateVoiceover`**: Synthesizes studio-quality audio narration with precise word-level timing data.
3. **`cutBeats`**: Segments script lines into visual shots matching audio timing.
4. **`sourceFootage` / `generateImage`**: Scouts historical archives, web b-roll, or generates AI imagery for each shot.
5. **`composeRender`**: Publishes the complete storyboard to Redis KV for instant `@remotion/player` previewing in the Studio.
6. **`Remotion Lambda`**: Renders final high-resolution MP4 video files on serverless AWS Lambda infrastructure.

---

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js**: `v22.x` or higher
- **Bun**: `v1.2+` (package manager & script runner)
- **PostgreSQL**: Chat history & feedback storage
- **Upstash Redis**: Storyboard KV persistence (required for `/studio/[id]`)

### 2. Installation & Setup

```bash
# Clone repository
git clone https://github.com/leksautomate/omnirush.git
cd omnirush/app-live

# Install dependencies
bun install

# Set up environment variables
cp .env.local.example .env.local
```

### 3. Configure Environment Keys

Edit `app-live/.env.local` with your service API keys (see [`ENV.md`](./ENV.md) for full configuration reference):

```bash
DATABASE_URL=postgresql://user:pass@host:5432/omnirush
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
MODELARK_API_KEY=ark-your-modelark-key
TAVILY_API_KEY=tvly-dev-your-tavily-key
SPEECHIFY_API_KEY=your-speechify-key
```

### 4. Start Development Server

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠️ Common Commands

Inside `app-live/`:

```bash
# Start development server
bun dev

# Run TypeScript static type checking
bun run typecheck

# Run unit & integration test suites
bun run test

# Run ESLint check
bun lint

# Build production bundle
bun run build
```

---

## 🤝 Contributing

We welcome contributions to Omnirush! Please read our [**Contributing Guide**](./CONTRIBUTING.md) for step-by-step instructions on setting up your environment, running quality checks, and submitting pull requests.

---

## 📜 License

Distributed under the **Apache License 2.0**. See [`app-live/LICENSE`](./app-live/LICENSE) for more details.
