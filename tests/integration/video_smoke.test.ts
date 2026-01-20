import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as FfmpegService from '../../electron/services/FfmpegService'
import path from 'node:path'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

describe('動画結合機能の統合テスト (実バイナリ動作確認)', () => {
    const TEMP_DIR = path.join(__dirname, 'temp_smoke')
    const SRC_FILE = path.join(TEMP_DIR, 'smoke_src.mp4')
    const OUT_FILE = path.join(TEMP_DIR, 'smoke_out.mp4')
    const FFMPEG_PATH = require('ffmpeg-static')

    beforeAll(async () => {
        if (!fs.existsSync(TEMP_DIR)) {
            fs.mkdirSync(TEMP_DIR)
        }

        await new Promise<void>((resolve, reject) => {
            const child = spawn(FFMPEG_PATH, [
                '-y',
                '-f', 'lavfi',
                '-i', 'testsrc=duration=1:size=1280x720:rate=24',
                '-f', 'lavfi',
                '-i', 'sine=frequency=440:duration=1',
                '-c:v', 'libx264',
                '-c:a', 'aac',
                '-color_primaries', 'bt2020',
                '-color_trc', 'smpte2084',
                '-colorspace', 'bt2020nc',
                '-map', '0:v',
                '-map', '1:a',
                '-t', '1',
                SRC_FILE
            ])
            child.on('close', (code) => {
                if (code === 0) resolve()
                else reject(new Error(`Failed to generate source video, code ${code}`))
            })
            child.on('error', reject)
        })
    }, 30000)

    afterAll(() => {
        if (fs.existsSync(TEMP_DIR)) {
            fs.rmSync(TEMP_DIR, { recursive: true, force: true })
        }
    })

    it('実際の動画ファイル（HDRメタデータ付き）を使用して、結合/トランスコードが成功すること', async () => {
        expect(fs.existsSync(SRC_FILE)).toBe(true)

        const segments = [{ start: 0, end: 1.0 }]

        const result = await FfmpegService.smartSplice(SRC_FILE, segments, OUT_FILE, {
            fadeInOut: false,
            crossfade: false,
            fadeDuration: 0.1,
            crossfadeDuration: 0
        })

        if (result.error) {
            console.error('Splice failed:', result.error, result.stderr)
        }
        expect(result.success).toBe(true)
        expect(result.outPath).toBe(OUT_FILE)
        expect(fs.existsSync(OUT_FILE)).toBe(true)

        const stats = fs.statSync(OUT_FILE)
        expect(stats.size).toBeGreaterThan(0)
    }, 60000)
})
