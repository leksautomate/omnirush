import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'

const output = 'out/documentary-smoke.mp4'
mkdirSync('out', { recursive: true })
rmSync(output, { force: true })

const render = spawnSync(
  'bunx',
  [
    'remotion',
    'render',
    'Storyboard',
    output,
    '--props=remotion/fixtures/documentary-smoke.json',
    '--codec=h264'
  ],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  }
)
if (render.status !== 0) process.exit(render.status ?? 1)

const probe = spawnSync(
  'ffprobe',
  [
    '-v',
    'error',
    '-show_entries',
    'stream=codec_type,codec_name',
    '-of',
    'json',
    output
  ],
  {
    encoding: 'utf8',
    shell: process.platform === 'win32'
  }
)
if (probe.status !== 0) {
  process.stderr.write(probe.stderr || 'ffprobe failed\n')
  process.exit(probe.status ?? 1)
}

const streams = JSON.parse(probe.stdout).streams
const hasH264 = streams.some(
  stream => stream.codec_type === 'video' && stream.codec_name === 'h264'
)
const hasAac = streams.some(
  stream => stream.codec_type === 'audio' && stream.codec_name === 'aac'
)
if (!hasH264) {
  process.stderr.write('Expected an H.264 video stream.\n')
  process.exit(2)
}
if (!hasAac) {
  process.stderr.write('Expected an AAC audio stream.\n')
  process.exit(3)
}

process.stdout.write(
  `Verified ${output}: H.264 video and AAC audio (${streams.length} streams).\n`
)
