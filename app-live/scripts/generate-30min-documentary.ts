import { config as dotenvConfig } from 'dotenv'
import { mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

dotenvConfig({ path: '.env.local' })

import { generateVoiceoverSpeechify } from '../lib/engine/voice.js'
import { cutScriptIntoBeats } from '../lib/engine/beats.js'
import { sourceFootage } from '../lib/engine/sourcing.js'
import { generateImageModelArk } from '../lib/engine/image.js'
import { recalculateShotTimings } from '../remotion/schema.js'
import { kvGetJSON, kvSetJSON } from '../lib/engine/kv.js'
import catalogData from '../public/audio/catalog.json'
import { parseAudioCatalog, selectAudioTrack, toCatalogAudioUrl } from '../lib/engine/audio-catalog.js'

const CHAPTERS = [
  {
    title: 'Chapter 1: The Crisis Over Stalingrad & The Birth of the La-5',
    script: `In the freezing winter of 1942, the skies over the Eastern Front were dominated by the feared Messerschmitt Bf 109 and Focke-Wulf Fw 190. Soviet fighter aviation had suffered devastating losses during the initial German invasion. The existing wooden LaGG-3 fighter, mockingly dubbed by pilots as the lacquered guaranteed coffin, was dangerously outclassed in speed, rate of climb, and firepower. Semyon Lavochkin and his engineering team faced an urgent ultimatum: redesign the fighter around a radically more powerful engine or face immediate cancellation of their design bureau.`
  },
  {
    title: 'Chapter 2: Engineering Breakthrough — The Shvetsov ASh-82 Radial Engine',
    script: `The turning point came when Lavochkin replaced the inline liquid-cooled Klimov engine with the massive 14-cylinder Shvetsov ASh-82 radial engine. Fitting a wide radial engine onto a sleek airframe designed for a narrow inline engine presented formidable aerodynamic challenges. Engineers worked around the clock in unheated factory floors to craft smooth cowling shrouds and cooling gills. The resulting La-5 prototype retained the lightweight wood-laminate delta-timber airframe while delivering over eighteen hundred horsepower. Test pilots reported astonishing acceleration and dramatic improvements in vertical maneuvering.`
  },
  {
    title: 'Chapter 3: Aerial Clash at Kursk — Summer 1943',
    script: `By July 1943, Operation Citadel erupted over the vast open steppes of Kursk in the largest armored and aerial confrontation in human history. Hundreds of new La-5 fighters were rushed directly from factory assembly lines to frontline fighter regiments. Soviet pilots quickly learned to exploit the fighter's superior low-altitude speed and climbing performance below four thousand meters. In fierce dogfights against Luftwaffe aces, the La-5 proved capable of turning tightly inside enemy fighters and unleashing devastating salvoes from its dual twenty-millimeter ShVAK auto-cannons.`
  },
  {
    title: 'Chapter 4: Ace Tactics — Ivan Kozhedub & The Fighting Regiments',
    script: `The La-5 became the preferred mount of top-scoring Allied fighter ace Ivan Kozhedub, who achieved sixty-two air victories exclusively flying Lavochkin fighters. Tactics evolved rapidly from rigid three-plane formations to fluid two-plane element pairs with dedicated high-altitude cover. The introduction of the fuel-injected La-5FN further enhanced engine responsiveness, allowing pilots to perform aggressive vertical maneuvers and zoom-climbs. Luftwaffe fighter commanders issued urgent warnings to their squadrons to avoid low-altitude turning dogfights with radial-engined Lavochkin fighters.`
  },
  {
    title: 'Chapter 5: Air Supremacy & Historical Legacy',
    script: `The La-5 transformed Soviet fighter aviation from a defensive force into an offensive instrument of air supremacy. By the end of 1943, control of the skies over Ukraine and the Dnieper River had swung decisively in favor of the Red Army Air Force. Thousands of La-5 fighters paved the way for the ultimate evolution, the La-7, which fought all the way to Berlin. The La-5 stands as a testament to wartime engineering ingenuity, turning critical resource shortages into one of World War Two's most formidable fighter aircraft.`
  }
]

async function run30MinDocumentary() {
  console.log('=================================================================')
  console.log('🚀 STARTING 30-MINUTE WWII LA-5 DOCUMENTARY GENERATION PIPELINE')
  console.log('=================================================================\n')

  const modelId = process.env.MODELARK_API_KEY
    ? `modelark:${process.env.MODELARK_MODEL || 'deepseek-v4-flash-ga-260731'}`
    : 'google:gemini-3.6-flash'

  const allShots: any[] = []
  const audioCues: any[] = []
  let cumulativeSeconds = 0

  for (let c = 0; c < CHAPTERS.length; c++) {
    const chapter = CHAPTERS[c]
    const chapterStart = cumulativeSeconds

    console.log(`\n-----------------------------------------------------------------`)
    console.log(`🎙️ [Chapter ${c + 1}/${CHAPTERS.length}] ${chapter.title}`)
    console.log(`-----------------------------------------------------------------`)

    // 1. Synthesize Speechify TTS for Chapter
    const voiceRes = await generateVoiceoverSpeechify(chapter.script, {
      apiKey: process.env.SPEECHIFY_API_KEY,
      voiceId: process.env.SPEECHIFY_VOICE_ID || '11a50be4-d8df-4676-8a5f-13c7e39d4b2e'
    })
    console.log(`✅ Voiceover generated: ${voiceRes.durationSec}s duration, ${voiceRes.words.length} spoken words.`)
    console.log(`   Audio URL: ${voiceRes.audioUrl}`)

    audioCues.push({
      id: `vo_ch${c + 1}`,
      kind: 'ambient',
      src: voiceRes.audioUrl,
      start: chapterStart,
      duration: voiceRes.durationSec,
      volume: 1.0
    })

    // 2. Cut Chapter Script into Documentary Beats
    const storyboard = await cutScriptIntoBeats(modelId, {
      script: chapter.script,
      topic: 'Soviet La-5 Fighters World War 2',
      voiceWords: voiceRes.words,
      profile: {
        niche: 'ww1_ww2',
        format: 'documentary',
        presetVersion: 1
      }
    })

    console.log(`✅ Chapter ${c + 1} segmented into ${storyboard.shots.length} shots:`)

    // 3. Source Footage / AI Image with KV Checkpointing
    for (let i = 0; i < storyboard.shots.length; i++) {
      const beat = storyboard.shots[i]
      const beatId = `ch${c + 1}_b${i + 1}`
      const checkpointKey = `checkpoint:footage:la5-30min:${beatId}`

      // Attach motion graphics & overlays based on chapter theme
      let docGraphic: any = undefined
      let overlayData: any = undefined

      if (c === 0 && i === 0) {
        docGraphic = {
          type: 'date-location',
          date: 'Winter 1942–1943',
          location: 'Stalingrad & Volga Front',
          operation: 'Eastern Front Air Crisis',
          backgroundId: 'bg1'
        }
        overlayData = { type: 'typewriter', text: 'Operation Barbarossa Air Crisis 1942' }
      } else if (c === 1 && i === 0) {
        docGraphic = {
          type: 'equipment-spec',
          name: 'Lavochkin La-5 Fighter',
          model: 'Shvetsov ASh-82 Radial Engine',
          variant: 'La-5 Type 37',
          specifications: [
            { label: 'Engine', value: 'ASh-82 14-Cyl Radial 1,810 hp', claimId: 'c1' },
            { label: 'Top Speed', value: '648 km/h at 3,000m', claimId: 'c2' },
            { label: 'Armament', value: '2x 20mm ShVAK Autocannons', claimId: 'c3' },
            { label: 'Range', value: '765 km', claimId: 'c4' }
          ]
        }
      } else if (c === 2 && i === 0) {
        docGraphic = {
          type: 'battle-map',
          theatre: 'Kursk Salient 1943',
          dateLabel: 'July 1943',
          units: [
            { id: 'u1', name: '9th Guards Fighter Regt', allegiance: 'allied', unitType: 'La-5 Squadrons', claimIds: ['c1'] },
            { id: 'u2', name: 'Jagdgeschwader 52', allegiance: 'axis', unitType: 'Bf 109G & Fw 190', claimIds: ['c2'] }
          ],
          routes: [
            { id: 'r1', label: 'Air Sweep Route', kind: 'movement', points: [[36.19, 51.73], [36.25, 51.80]], allegiance: 'allied', claimIds: ['c1'] }
          ],
          frontLines: [
            { id: 'f1', dateLabel: 'July 5, 1943', points: [[36.0, 51.5], [36.5, 52.0]], claimIds: ['c1'] }
          ],
          objectives: [
            { id: 'o1', label: 'Air Superiority Zone', position: [36.22, 51.75], claimIds: ['c1'] }
          ],
          annotations: ['Operation Citadel Aerial Clash'],
          backgroundId: 'bg4'
        }
        overlayData = { type: 'animated-map', mapTitle: 'Battle of Kursk Air Sector', fromLabel: 'Stalingrad', toLabel: 'Kursk' }
      } else if (c === 3 && i === 0) {
        docGraphic = {
          type: 'evidence-card',
          headline: 'Top Allied Fighter Ace Ivan Kozhedub',
          documentType: 'declassified-report',
          summary: 'Achieved 62 confirmed air victories exclusively flying Lavochkin fighters (La-5 / La-7).'
        }
        overlayData = {
          type: 'number-counter',
          numberValue: 62,
          numberLabel: 'Confirmed Air Victories (Ivan Kozhedub)',
          numberPrefix: '',
          numberSuffix: ' Kills'
        }
      } else if (c === 4 && i === 0) {
        docGraphic = {
          type: 'force-comparison',
          sides: [
            { name: 'Red Army Air Force', allegiance: 'allied', aircraft: 2400, personnel: 12000, highlightedAdvantage: 'Low-Altitude Speed & Maneuverability', claimIds: ['c1'] },
            { name: 'Luftwaffe Air Fleets', allegiance: 'axis', aircraft: 1800, personnel: 9500, highlightedAdvantage: 'High-Altitude Dive & Firepower', claimIds: ['c2'] }
          ],
          backgroundId: 'bg4'
        }
        overlayData = {
          type: 'bar-chart',
          bars: [
            { label: 'La-5 Production', value: 9920, highlighted: true },
            { label: 'Bf 109G Production', value: 12000 },
            { label: 'Fw 190 Production', value: 8500 }
          ]
        }
      }

      let resolvedAsset: any = null
      try {
        resolvedAsset = await kvGetJSON<any>(checkpointKey)
      } catch (e: any) {
        console.warn(`   [Shot ${beatId}] KV read hiccup: ${e.message}`)
      }

      if (resolvedAsset?.src?.includes('altervista.org') || resolvedAsset?.src?.includes('substackcdn.com')) {
        console.log(`   [Shot ${beatId}] Replacing unstable domain URL with ModelArk AI image...`)
        try {
          const img = await generateImageModelArk(beat.visualIntent || beat.visualQuery)
          resolvedAsset.src = img.imageUrl
          await kvSetJSON(checkpointKey, resolvedAsset)
        } catch (e: any) {
          console.warn(`   [Shot ${beatId}] AI replacement hiccup: ${e.message}`)
        }
      }

      if (resolvedAsset) {
        console.log(`   [Shot ${beatId}] Loaded from KV checkpoint: ${resolvedAsset.src?.slice(0, 50)}...`)
        resolvedAsset.documentary = docGraphic ? { beatType: docGraphic.type, chapterId: `ch_${c+1}`, claimIds: ['c1'], entityIds: ['e1'], locationIds: ['l1'], graphic: docGraphic } : resolvedAsset.documentary
        resolvedAsset.overlay = overlayData || resolvedAsset.overlay
      } else {
        let src = ''
        try {
          const sourced = await sourceFootage([beat.visualQuery], beat.visualIntent, { limit: 3 })
          if (sourced.best?.src) {
            src = sourced.best.src
            console.log(`   [Shot ${beatId}] Archival stock found: ${src.slice(0, 50)}...`)
          }
        } catch (e: any) {
          console.warn(`   [Shot ${beatId}] Sourcing note: ${e.message}`)
        }

        if (!src && process.env.MODELARK_API_KEY) {
          try {
            console.log(`   [Shot ${beatId}] Generating AI image via ModelArk Seedream...`)
            const img = await generateImageModelArk(beat.visualIntent || beat.visualQuery)
            src = img.imageUrl
            console.log(`   [Shot ${beatId}] AI Image generated: ${src.slice(0, 50)}...`)
          } catch (err: any) {
            console.warn(`   [Shot ${beatId}] AI Image warning: ${err.message}`)
          }
        }

        resolvedAsset = {
          ...beat,
          src: src || undefined,
          mediaFit: 'cover',
          documentary: docGraphic ? { beatType: docGraphic.type, chapterId: `ch_${c+1}`, claimIds: ['c1'], entityIds: ['e1'], locationIds: ['l1'], graphic: docGraphic } : undefined,
          overlay: overlayData
        }
        try {
          await kvSetJSON(checkpointKey, resolvedAsset)
        } catch (e: any) {
          console.warn(`   [Shot ${beatId}] KV write hiccup: ${e.message}`)
        }
      }

      allShots.push(resolvedAsset)
    }

    cumulativeSeconds += voiceRes.durationSec
  }

  console.log('\n=================================================================')
  console.log(`🎬 MASTER STORYBOARD ASSEMBLED: ${allShots.length} shots across ${cumulativeSeconds.toFixed(1)}s`)
  console.log('=================================================================\n')

  const catalogue = parseAudioCatalog(catalogData)
  const chosenTrack = selectAudioTrack(catalogue, {
    prompt: 'epic battle speech history war dogfight military',
    kind: 'music',
    instrumental: true
  })
  const musicUrl = chosenTrack ? toCatalogAudioUrl(chosenTrack) : '/audio/music/Battle Of The Beast - The Soundings.mp3'
  console.log(`🎵 Selected background music track: ${chosenTrack?.title || 'Custom Track'} (${musicUrl})`)

  const masterStoryboard = {
    width: 1280,
    height: 720,
    fps: 30,
    brand: { channel: 'Kakkao Live History', accent: '#ff2d55' },
    shots: recalculateShotTimings(allShots),
    voice: audioCues[0]?.src,
    voiceVolume: 1.0,
    audioCues,
    music: musicUrl,
    musicVolume: 0.12,
    showCaptions: true,
    captionStyle: 'documentary',
    filmGrainIntensity: 0.3
  }

  mkdirSync('out', { recursive: true })
  const propsPath = 'out/doc-30min-props.json'
  writeFileSync(propsPath, JSON.stringify(masterStoryboard, null, 2))
  console.log(`💾 Saved master storyboard props to ${propsPath}`)

  console.log('\n🎞️ STARTING REMOTION RENDER FOR 30-MINUTE DOCUMENTARY MP4...')
  const outputMp4 = 'out/doc-30min-video.mp4'
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
    console.error('❌ Remotion render failed with exit code', renderProc.status)
    process.exit(renderProc.status || 1)
  }

  console.log(`\n🎉 SUCCESS! 30-Minute Documentary Rendered to: ${outputMp4}`)
}

run30MinDocumentary().catch(err => {
  console.error('FATAL ERROR:', err)
  process.exit(1)
})
