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

    it('FFmpegのバイナリが正しく認識され、バージョン情報が取得できること', async () => {
        const result = await service.checkFFmpeg()
        expect(result.error).toBeUndefined()
        expect(result.version).toBeDefined()
        console.log('Detected FFmpeg Version:', result.version)
    })

    it('存在しないファイルを指定した場合、適切なエラーが返されること', async () => {
        const result = await service.runTestCut('/path/to/non/existent/file.mov')
        expect(result.success).toBeUndefined()
        expect(result.error).toBeDefined()
    })

    it('動画の切り出しが成功し、ユニークなファイル名で出力されること', async () => {
        if (!fs.existsSync(sampleFile)) {
            console.log('サンプルファイルがないためスキップします')
            return
        }

        // 1回目の実行
        const result1 = await service.runTestCut(sampleFile)

        expect(result1.success).toBe(true)
        expect(result1.outPath).toBeDefined()
        expect(fs.existsSync(result1.outPath!)).toBe(true)
        console.log('Output 1:', result1.outPath)

        // 生成された動画の長さをチェック (元の20%程度になっているはず)
        // something.mov は約12秒なので、2.4秒程度
        const ffprobePath = (service as any).getFFprobePath() // private method access for test
        const duration = await getDuration(result1.outPath!, ffprobePath)
        expect(duration).toBeGreaterThan(0)
        console.log(`Output Duration: ${duration}s`)

        // 2回目の実行 (ファイル名重複回避のテスト)
        const result2 = await service.runTestCut(sampleFile)
        expect(result2.success).toBe(true)
        expect(result2.outPath).not.toBe(result1.outPath) // パスが異なること
        expect(result2.outPath).toContain('_cut_') // プレフィックス/サフィックスの確認
        expect(fs.existsSync(result2.outPath!)).toBe(true)

        console.log('Output 2 (Unique):', result2.outPath)
    }, 60000) // エンコード時間を考慮して長めに
})
