import { config as dotenvConfig } from 'dotenv'
import { mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

dotenvConfig({ path: '.env.local' })

import { generateVoiceoverSpeechify } from '../lib/engine/voice.js'
import { cutScriptIntoBeats } from '../lib/engine/beats.js'
import { sourceFootage } from '../lib/engine/sourcing.js'
import { generateImageModelArk } from '../lib/engine/image.js'
import { recalculateShotTimings } from '../remotion/schema.js'

async function run() {
  console.log('🎙️ 1. Synthesizing real TTS narration via Speechify...')
  const narration = 'In 1943, over the blood-soaked skies of Kursk, a legendary Soviet fighter was born. The Lavochkin La-5 turned the tide of World War Two air combat against the German Luftwaffe.'
  
  const voiceRes = await generateVoiceoverSpeechify(narration, {
    apiKey: process.env.SPEECHIFY_API_KEY,
    voiceId: process.env.SPEECHIFY_VOICE_ID || '11a50be4-d8df-4676-8a5f-13c7e39d4b2e'
  })

  console.log(`✅ Voiceover generated: ${voiceRes.durationSec}s duration, ${voiceRes.words.length} spoken word markers.`)
  console.log(`   Audio URL: ${voiceRes.audioUrl}`)

  console.log('\n🎬 2. Segmenting script into documentary shots with real voice timings...')
  const modelId = process.env.MODELARK_API_KEY
    ? `modelark:${process.env.MODELARK_MODEL || 'deepseek-v4-flash-ga-260731'}`
    : 'google:gemini-3.6-flash'

  const storyboard = await cutScriptIntoBeats(modelId, {
    script: narration,
    topic: 'Soviet La-5 Fighters Kursk 1943',
    voiceWords: voiceRes.words,
    profile: {
      niche: 'ww1_ww2',
      format: 'documentary',
      presetVersion: 1
    }
  })

  console.log(`✅ Segmented into ${storyboard.shots.length} atmospheric shots:`)
  storyboard.shots.forEach((shot, i) => {
    console.log(`   Shot #${i + 1}: ${shot.duration}s | "${shot.narration.slice(0, 45)}..." | Query: ${shot.visualQuery}`)
  })

  console.log('\n🔎 3. Sourcing assets for each shot...')
  const resolvedShots = []
  for (const shot of storyboard.shots) {
    let src = ''
    try {
      const sourced = await sourceFootage([shot.visualQuery], shot.visualIntent, { limit: 3 })
      if (sourced.best?.src) {
        src = sourced.best.src
        console.log(`   [Shot #${resolvedShots.length + 1}] Found stock/archival media: ${src.slice(0, 60)}...`)
      }
    } catch (e) {
      console.warn(`   [Shot #${resolvedShots.length + 1}] Sourcing warning:`, e.message)
    }

    if (!src && process.env.MODELARK_API_KEY) {
      try {
        console.log(`   [Shot #${resolvedShots.length + 1}] Generating AI image via ModelArk Seedream...`)
        const img = await generateImageModelArk(shot.visualIntent || shot.visualQuery)
        src = img.imageUrl
        console.log(`   [Shot #${resolvedShots.length + 1}] AI Image generated: ${src.slice(0, 60)}...`)
      } catch (err) {
        console.warn(`   [Shot #${resolvedShots.length + 1}] AI Image generation warning:`, err.message)
      }
    }

    resolvedShots.push({
      ...shot,
      src: src || undefined,
      mediaFit: 'cover'
    })
  }

  const finalStoryboard = {
    width: 1280,
    height: 720,
    fps: 30,
    brand: { channel: 'Kakkao Live History', accent: '#ff2d55' },
    shots: recalculateShotTimings(resolvedShots),
    voice: voiceRes.audioUrl,
    voiceVolume: 1.0,
    music: '/audio/music/monolithaudio-night-patrol-230379.mp3',
    musicVolume: 0.12,
    showCaptions: true,
    captionStyle: 'documentary',
    filmGrainIntensity: 0.3
  }

  mkdirSync('out', { recursive: true })
  const propsPath = 'out/real-tts-props.json'
  writeFileSync(propsPath, JSON.stringify(finalStoryboard, null, 2))
  console.log(`\n💾 Saved storyboard props to ${propsPath}`)

  console.log('\n🎞️ 4. Rendering real video with TTS narration via Remotion...')
  const outputMp4 = 'out/real-tts-video.mp4'
  const renderProc = spawnSync(
    'bunx',
    [
      'remotion',
      'render',
      'Storyboard',
      outputMp4,
      `--props=${propsPath}`,
      '--codec=h264'
    ],
    { stdio: 'inherit', shell: process.platform === 'win32' }
  )

  if (renderProc.status !== 0) {
    console.error('❌ Remotion render failed with code', renderProc.status)
    process.exit(renderProc.status || 1)
  }

  console.log(`\n🎉 SUCCESS! Real video with Speechify TTS rendered to: ${outputMp4}`)
}

run().catch(err => {
  console.error('FATAL ERROR:', err)
  process.exit(1)
})
