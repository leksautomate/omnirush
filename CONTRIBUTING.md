# Contributing to Omnirush (Kakkao Live)

Thank you for your interest in contributing to **Omnirush (Kakkao Live)**! We welcome contributions from developers, creators, designers, and open-source enthusiasts.

This guide provides instructions and best practices for setting up your local environment, making changes, running tests, and opening pull requests.

---

## 📐 Repository & Architecture Overview

Omnirush is an agentic AI video studio monorepo composed of loosely coupled services:

| Directory | Service Description | Deployment Target |
|---|---|---|
| `app-live/` | Next.js 16 AI video creation platform (chat interface, Studio timeline, Remotion renderer) | Vercel |
| `avatar-service/` | Audio-driven talking portrait generator (Python / MuseTalk) | Modal.com |
| `watch-service/` | Fallback YouTube video frame and transcript extractor (Python / FastAPI) | Fly.io / Docker |
| `hook/` | HyperFrames short-form video composition framework | Web / Remotion |
| `spike/` | Standalone Node scripts for ffmpeg prototyping | Local CLI |

> **Note:** For day-to-day work on the web studio UI, AI video agents, or Remotion templates, you will work inside `app-live/`.

---

## 🚀 Quick Start & Development Setup

### 1. Prerequisites

- **Node.js**: v22.x or later
- **Package Manager**: [Bun](https://bun.sh/) (recommended) or `npm` / `pnpm`
- **Git**: Installed and configured

### 2. Clone and Install Dependencies

```bash
git clone https://github.com/leksautomate/omnirush.git
cd omnirush
cd app-live
bun install
```

### 3. Environment Variables

Create a local environment file in `app-live`:

```bash
cp .env.local.example .env.local
```

Refer to [`ENV.md`](./ENV.md) for detailed descriptions of all required and optional environment variables.

Minimum variables to run the chat and Studio preview:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/kakkao
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
MODELARK_API_KEY=ark-...
TAVILY_API_KEY=tvly-dev-...
SPEECHIFY_API_KEY=...
YOUTUBE_API_KEY=AIzaSy...
```

> 🔒 **Security Notice**: Never commit `.env` or `.env.local` files containing real API secrets. `.env.local` is listed in `.gitignore`.

### 4. Running the Local Server

```bash
# From app-live/
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing and Quality Standards

Before submitting a pull request, ensure all tests, type checks, and linting rules pass.

Run the following commands inside `app-live/`:

```bash
# Run TypeScript static type checker
bun run typecheck

# Run unit and integration tests (Vitest)
bun run test

# Run code linter
bun lint
```

---

## 🔀 Pull Request Workflow

1. **Fork & Branch**: Create a feature branch off `main`:
   ```bash
   git checkout -b feature/my-cool-feature
   ```
2. **Make Changes**: Follow the repository coding style (TypeScript, Tailwind CSS, React 19).
3. **Commit Cleanly**: Write clear, descriptive commit messages:
   ```bash
   git commit -m "feat(studio): add timeline zoom controls"
   ```
4. **Push & Open PR**: Push your branch to GitHub and create a Pull Request detailing:
   - What changed and why.
   - Screenshots/videos for visual UI changes.
   - Verification steps performed.

---

## 📜 License

By contributing to Omnirush, you agree that your contributions will be licensed under the **Apache-2.0 License**.
