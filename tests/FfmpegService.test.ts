import { describe, it, expect, beforeAll } from 'vitest'
import { FfmpegService } from '../electron/services/FfmpegService'
import path from 'path'
import fs from 'fs'
import { spawn } from 'child_process'

// Helper to get duration of a file
const getDuration = async (filePath: string, ffprobePath: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        const child = spawn(ffprobePath, [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            filePath
        ])
        let out = ''
        child.stdout.on('data', d => out += d.toString())
        child.on('close', code => {
            if (code === 0) resolve(parseFloat(out.trim()))
            else reject(new Error('Probe failed'))
        })
    })
}

describe('FfmpegService 単体テスト', () => {
    const service = new FfmpegService()

    // Use one of the samples provided by the user
    const sampleDir = path.resolve(__dirname, '../test-samples')
    const sampleFile = path.join(sampleDir, 'something.mov')

    beforeAll(() => {
        if (!fs.existsSync(sampleFile)) {
            console.warn(`テスト用ファイルが見つかりません: ${sampleFile}。テストがスキップまたは失敗する可能性があります。`)
        }
    })

    describe('checkFFmpeg', () => {
        it('FFmpegのバイナリが正しく認識され、バージョン情報が取得できること', async () => {
            const result = await service.checkFFmpeg()
            expect(result.error).toBeUndefined()
            expect(result.version).toBeDefined()
            console.log('Detected FFmpeg Version:', result.version)
        })
    })

    describe('spliceSegments', () => {
        it('単一区間を指定して切り出しができること (Single Segment)', async () => {
            if (!fs.existsSync(sampleFile)) return

            // 0-3秒のみ
            const segments = [{ start: 0, end: 3 }]
            const outputDir = path.join(path.dirname(sampleFile), '..', 'output')
            if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
            const outPath = path.join(outputDir, `test_single_${Date.now()}.mov`)

            const result = await service.spliceSegments(sampleFile, segments, outPath)

            expect(result.success).toBe(true)
            expect(fs.existsSync(outPath)).toBe(true)

            // Duration Check (~3s)
            const ffprobePath = (service as any).getFFprobePath()
            const duration = await getDuration(outPath, ffprobePath)
            expect(duration).toBeGreaterThan(2.5)
            expect(duration).toBeLessThan(3.5)
        }, 60000)

        it('複数区間を結合できること (Multi Segments)', async () => {
            if (!fs.existsSync(sampleFile)) return

            // 0-2秒 と 4-6秒 を結合 (合計4秒)
            const segments = [
                { start: 0, end: 2 },
                { start: 4, end: 6 }
            ]

            const outputDir = path.join(path.dirname(sampleFile), '..', 'output')
            const outPath = path.join(outputDir, `test_multi_${Date.now()}.mov`)

            const result = await service.spliceSegments(sampleFile, segments, outPath)

            expect(result.success).toBe(true)
            expect(fs.existsSync(outPath)).toBe(true)

            // Duration Check (~4s)
            const ffprobePath = (service as any).getFFprobePath()
            const duration = await getDuration(outPath, ffprobePath)
            expect(duration).toBeGreaterThan(3.5)
            expect(duration).toBeLessThan(4.5)
        }, 60000)
    })
})
