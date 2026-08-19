# Kakkao — environment variables

Everything you need to set, grouped by **where** it goes. Three targets:

1. **Vercel → app-live project** (the chat app + Studio + Niche Finder + sub-agents)
2. **watch-service** (Fly/Docker — only if you want Claude to watch videos)
3. **GitHub repo secrets** (only for the one-click Remotion Lambda deploy Action)

Legend: **[req]** required for that feature to work · **[opt]** optional / tuning.

---

## 1) Vercel — `app-live` project env

### Core (the app won't run without these)

```bash
DATABASE_URL=postgresql://user:pass@host:5432/kakkao   # [req] Postgres (chat history, feedback)
TAVILY_API_KEY=tvly-dev-…                             # [req] research + footage discovery (default search provider)
```

One chat-model key is also required — DEFAULT_MODEL (`lib/config/default-model.ts`) picks
whichever of these is set, in this order: `MODELARK_API_KEY` → `OPENAI_COMPATIBLE_API_KEY` (+ its
base URL) → falls back to any other enabled provider (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`GOOGLE_GENERATIVE_AI_API_KEY`, …). Scripts, beats, and niche AI reuse whatever chat model is
active unless overridden per-feature (see `NICHE_AI_MODEL`, `CUT_BEATS_MODEL` below).

> **Redis is effectively required for the Studio flow.** `composeRender` stores the
> storyboard in KV and `/studio/[id]` reads it back; on Vercel's serverless the in-memory
> fallback does NOT persist between requests, so set Upstash:
>
> ```bash
> UPSTASH_REDIS_REST_URL=https://….upstash.io   # [req for Studio] storyboard + voiceover KV
> UPSTASH_REDIS_REST_TOKEN=…                     # [req for Studio]
> ```

### Media generation — voice, images, thumbnails

AI33 is not used for anything — its TTS and image task-polling endpoints were unreliable
(a task-creation/status-check race returned false "temporarily busy" failures that got
silently retried, and separately, image generation timed out repeatedly across multiple
models). Voice runs on Speechify; images and thumbnails run on ModelArk (Seedream).
Background music is selected from the manually curated Pixabay catalogue in
`app-live/public/audio/catalog.json`; it does not require a music API. Every installed
track retains its creator, original Pixabay page, licence, download date, and Content ID
status.

```bash
SPEECHIFY_API_KEY=…                # [req for voiceover] default and only TTS provider
SPEECHIFY_VOICE_ID=…               # [opt] house voice (a UUID)
SPEECHIFY_MODEL=simba-3.0          # [opt]
SPEECHIFY_BASE_URL=https://api.speechify.ai  # [opt]
```

ModelArk (`MODELARK_API_KEY`, above) drives both general frame generation
(`MODELARK_IMAGE_MODEL`, default `seedream-5-0-260128`) and thumbnails
(`MODELARK_THUMBNAIL_MODEL`, defaults to the same model). Ark caps each model at 99
generations/day; that's tracked internally so a spent quota errors clearly instead of a
raw 429.

Generated voiceover audio hosting: R2/S3-compatible storage if configured (see File
uploads below — Tencent COS works too, just set `S3_FORCE_PATH_STYLE=false` and `S3_REGION` to
its actual region), else a local `public/generated/audio/` file in dev, else a data: URI as a
last resort.

### Video render — Remotion Lambda

```bash
REMOTION_SERVE_URL=https://remotionlambda-….s3….amazonaws.com/sites/kakkao/index.html  # [req to render]
REMOTION_AWS_ACCESS_KEY_ID=…      # [req to render] (or reuse AWS_ACCESS_KEY_ID)
REMOTION_AWS_SECRET_ACCESS_KEY=…  # [req to render] (or reuse AWS_SECRET_ACCESS_KEY)
REMOTION_LAMBDA_REGION=us-east-1  # [opt] default us-east-1
REMOTION_FUNCTION_NAME=…          # [opt] else derived from memory/disk/timeout
REMOTION_LAMBDA_MEMORY=2048       # [opt]
REMOTION_LAMBDA_DISK=2048         # [opt]
REMOTION_LAMBDA_TIMEOUT=240       # [opt]
REMOTION_RENDER_PRIVACY=public    # [opt] public | private
REMOTION_OUTPUT_BUCKET=…          # [opt] explicit S3 output bucket
```

> Without these, `composeRender` still works — it publishes the storyboard and the Studio
> preview loads — you just can't click **Render on Lambda** yet.

### Niche Finder (`/niche`)

```bash
YOUTUBE_API_KEY=AIzaSy…                              # [req for Niche Finder] YouTube Data API v3 (also CC footage search)
NICHE_AI_MODEL=modelark:deepseek-v4-flash-ga-260731   # [opt] model for sub-niche ideas + verdicts
```

### Learn-from-video sub-agent

Whichever provider ingests the YouTube URL natively watches the footage and hears the
narration with no download step. **ModelArk's seed-2-0 models go first** when
`MODELARK_API_KEY` (above) is set — Gemini is the fallback native-video path.

```bash
LEARN_VIDEO_MODELARK_MODEL=seed-2-0-pro-260328   # [opt] default; also: -lite-260428, -mini-260428, -code-preview-260328
GEMINI_API_KEY=…                  # [opt] or reuse GOOGLE_GENERATIVE_AI_API_KEY — fallback native-video path
LEARN_VIDEO_GEMINI_MODEL=gemini-2.5-flash   # [opt]
LEARN_VIDEO_TIMEOUT_MS=180000     # [opt] ceiling on the native video pass
# Optional frame fallback, for links neither can open directly. The service returns
# sampled JPEG frames + a transcript, read as images by whichever of the above is configured.
WATCH_SERVICE_URL=https://kakkao-watch.fly.dev   # [opt]
WATCH_SERVICE_TOKEN=…             # [opt] must match the service's token
```

> At least one of `MODELARK_API_KEY` / `GEMINI_API_KEY` is required for learn-from-video —
> without either, it falls straight to reasoning from the URL alone (marked as not-watched).

### Storyboard segmentation (`cutBeats`)

Segmentation is mechanical structure extraction on the critical path, so it defaults to
Gemini Flash rather than the chat model — seconds instead of minutes on a long script.

```bash
CUT_BEATS_MODEL=google:gemini-2.5-flash   # [opt] default when a Gemini key is set;
                                          #       use 'chat' to reuse the chat model
CUT_BEATS_TIMEOUT_MS=120000               # [opt] deadline; partial shots are kept
```

### Researcher agent step budget

```bash
RESEARCHER_MAX_STEPS=40   # [opt] default 40. The video pipeline (script, voiceover,
                          #       beats, then sourceFootage/generateImage per shot,
                          #       thumbnail, composeRender) needs real headroom — too
                          #       low and generation silently stops before rendering.
```

### Footage sources (optional — Wikimedia + Internet Archive need no key)

```bash
PEXELS_API_KEY=…      # [opt]
PIXABAY_API_KEY=…     # [opt]
COVERR_API_KEY=…      # [opt]
NARA_API_KEY=…        # [opt] U.S. National Archives
```

### Other AI providers (optional — any one can be the chat default)

```bash
GOOGLE_GENERATIVE_AI_API_KEY=…    # [opt] Gemini via the SDK (doubles as learn-video key)
AI_GATEWAY_API_KEY=…              # [opt] Vercel AI Gateway
OLLAMA_BASE_URL=http://localhost:11434              # [opt]
OPENAI_COMPATIBLE_API_KEY=…       # [opt] DeepSeek/Moonshot/etc. — host must accept {base}/v1/chat/completions
OPENAI_COMPATIBLE_API_BASE_URL=…  # [opt]
OPENAI_COMPATIBLE_MODELS=…        # [opt] comma-separated whitelist
OPENAI_COMPATIBLE_PROVIDER_NAME=… # [opt] UI label
MODELARK_API_KEY=ark-…                               # [opt] BytePlus ModelArk (Ark) — separate slot, since its
                                  #       {base}/chat/completions path has no /v1 segment.
                                  #       Takes priority as DEFAULT_MODEL when set.
MODELARK_BASE_URL=…               # [opt] default https://ark.ap-southeast.bytepluses.com/api/v3
MODELARK_MODEL=…                  # [opt] default deepseek-v4-flash-ga-260731
MODELARK_MODELS=…                 # [opt] comma-separated model-selector list
```

### Auth — Supabase (optional; default is anonymous single-user)

```bash
ENABLE_AUTH=false                 # [opt] true to require sign-in
ANONYMOUS_USER_ID=anonymous-user  # [opt]
NEXT_PUBLIC_SUPABASE_URL=…        # [req if ENABLE_AUTH=true]
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=…   # [req if ENABLE_AUTH=true]
SUPABASE_SECRET_KEY=…             # [req for account deletion] never expose to the browser
```

### File uploads — Cloudflare R2 / S3-compatible (optional)

```bash
R2_ACCOUNT_ID=…      R2_ACCESS_KEY_ID=…      R2_SECRET_ACCESS_KEY=…     # [opt]
R2_BUCKET_NAME=user-uploads      R2_PUBLIC_URL=…       S3_ENDPOINT=…    # [opt]
S3_FORCE_PATH_STYLE=…  # [opt] default: true when S3_ENDPOINT is set, else false. Cloudflare
                        #       R2 and most generic S3-compatible hosts want path-style
                        #       (endpoint/bucket/key) — the default. Some (e.g. Tencent COS)
                        #       only support virtual-hosted-style (bucket.endpoint/key) at a
                        #       region-level endpoint — set this to "false" for those.
S3_REGION=…             # [opt] default "auto" (R2 ignores it). Set to the real region string
                        #       for hosts that check it for SigV4 signing, e.g. Tencent COS's
                        #       "na-siliconvalley".
```

### Alt search & extraction (optional)

```bash
SEARCH_API=tavily                 # [opt] tavily | searxng | exa | firecrawl
EXA_API_KEY=…   FIRECRAWL_API_KEY=…   BRAVE_SEARCH_API_KEY=…   JINA_API_KEY=…  # [opt]
SEARXNG_API_URL=…                 # [opt] + other SEARXNG_* if self-hosting
```

### Analytics / observability (optional)

```bash
NEXT_PUBLIC_POSTHOG_KEY=…   NEXT_PUBLIC_POSTHOG_HOST=…    # [opt]
ENABLE_LANGFUSE_TRACING=…   LANGFUSE_SECRET_KEY=…   LANGFUSE_PUBLIC_KEY=…   # [opt]
```

---

## 2) watch-service (Fly.io / Docker) — optional frame fallback for video watching

```bash
WATCH_SERVICE_TOKEN=<openssl rand -hex 24>   # [opt] shared secret; must equal WATCH_SERVICE_URL's token in app-live
GROQ_API_KEY=gsk_…                                    # [opt] Whisper transcript when captions are missing
PORT=8080                                     # [opt] default 8080
```

Set with `fly secrets set …`. See `watch-service/README.md`.

---

## 3) GitHub repo secrets — only for the "Deploy Remotion Lambda" Action

```bash
REMOTION_AWS_ACCESS_KEY_ID=…      # [req for the Action]
REMOTION_AWS_SECRET_ACCESS_KEY=…  # [req for the Action]
```

The Action prints the `REMOTION_SERVE_URL` to paste into the Vercel env above.

---

## Minimum to light up the whole video pipeline

`DATABASE_URL` · `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` · `MODELARK_API_KEY` ·
`TAVILY_API_KEY` · `SPEECHIFY_API_KEY` · `YOUTUBE_API_KEY` ·
`REMOTION_SERVE_URL` + `REMOTION_AWS_ACCESS_KEY_ID` + `REMOTION_AWS_SECRET_ACCESS_KEY`.
(`MODELARK_API_KEY` covers the default chat model, images/thumbnails, and learn-from-video —
no Anthropic/OpenAI/Gemini key is needed unless you want one of those as an alternative.)
