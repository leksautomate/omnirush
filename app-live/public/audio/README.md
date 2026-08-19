# Curated audio catalogue

Kakkao selects background music, sound effects, and ambience from `catalog.json`.
Audio is bundled with the Remotion site so Studio previews and Lambda renders use
the same file. `generateMusic` chooses a music bed; `sourceAudio` returns a
timeline-ready SFX or ambience cue with its provenance attached.

The starter catalogue includes:

- Music beds for documentary, explainer, automotive/breakdown, and listicle pacing.
- A short transition whoosh and a cinematic impact.
- Forest and industrial ambience loops.

For each manually downloaded Pixabay asset:

1. Put music in `public/audio/music/`, sound effects in `public/audio/sfx/`, or
   ambience in `public/audio/ambient/`.
2. Add one entry to `catalog.json` using the original Pixabay asset page as
   `sourceUrl`.
3. Record whether the asset page says **Content ID Registered**. Kakkao excludes
   those tracks by default.
4. Keep `licenseUrl` set to
   `https://pixabay.com/service/license-summary/` and retain the downloaded file
   or certificate as your publishing record.

Example:

```json
{
  "id": "dark-documentary",
  "kind": "music",
  "title": "Dark Documentary",
  "creator": "Creator name",
  "file": "music/dark-documentary.mp3",
  "source": "pixabay",
  "sourceUrl": "https://pixabay.com/music/main-title-dark-documentary-12345/",
  "license": "Pixabay Content License",
  "licenseUrl": "https://pixabay.com/service/license-summary/",
  "downloadedAt": "2026-08-14",
  "durationSec": 158,
  "instrumental": true,
  "contentIdRegistered": false,
  "genres": ["cinematic"],
  "moods": ["dark", "suspense"],
  "tags": ["documentary", "true crime", "investigation"]
}
```
