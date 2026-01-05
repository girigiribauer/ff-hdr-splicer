import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as FfmpegService from '../../../electron/services/FfmpegService'
import * as child_process from 'node:child_process'
import { EventEmitter } from 'events'

vi.mock('node:child_process')

describe('FfmpegService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    function mockSpawn(stdout: string, code: number = 0) {
        const child = new EventEmitter() as any
        child.stdout = new EventEmitter()
        child.stderr = new EventEmitter()

        vi.spyOn(child_process, 'spawn').mockReturnValue(child)

        setTimeout(() => {
            child.stdout.emit('data', stdout)
            child.emit('close', code)
        }, 10)

        return child
    }

    describe('getVideoMetadata', () => {
        it('正常終了時、パースされたJSONを返す', async () => {
            const mockOutput = JSON.stringify({
                streams: [{
                    color_transfer: 'smpte2084',
                    color_primaries: 'bt2020'
                }]
            })
            mockSpawn(mockOutput)

            const result = await FfmpegService.getVideoMetadata('/path/to/video.mov')
            expect(result).toEqual({
                streams: [{
                    color_transfer: 'smpte2084',
                    color_primaries: 'bt2020'
                }]
            })
        })

        it('終了コードが0以外の場合、エラーをスローする', async () => {
            mockSpawn('', 1)
            await expect(FfmpegService.getVideoMetadata('bad.mov')).rejects.toThrow('Probe failed with code 1')
        })

        it('無効なJSONの場合、エラーをスローする', async () => {
            mockSpawn('invalid json', 0)
            await expect(FfmpegService.getVideoMetadata('bad.mov')).rejects.toThrow('Failed to parse ffprobe output')
        })

        it('プロセス起動エラーの場合、エラーをスローする', async () => {
            const child = new EventEmitter() as any
            child.stdout = new EventEmitter()
            child.stderr = new EventEmitter()
            vi.spyOn(child_process, 'spawn').mockReturnValue(child)

            // Trigger error immediately
            setTimeout(() => {
                child.emit('error', new Error('Spawn failed'))
            }, 10)

            await expect(FfmpegService.getVideoMetadata('bad.mov')).rejects.toThrow('Probe failed: Spawn failed')
        })
    })

    describe('getDuration', () => {
        it('正常終了時、時間を数値で返す', async () => {
            mockSpawn('123.456\n')
            const result = await FfmpegService.getDuration('video.mp4')
            expect(result).toBe(123.456)
        })

        it('エラー時、例外をスローする', async () => {
            mockSpawn('', 1)
            await expect(FfmpegService.getDuration('video.mp4')).rejects.toThrow('Probe failed with code 1')
        })
    })

    describe('spliceSegments', () => {
        it('セグメント配列が空の場合、エラーを返す', async () => {
            const result = await FfmpegService.spliceSegments('in.mp4', [], 'out.mp4')
            expect(result.error).toBe('No segments provided')
        })

        it('正常時、ffmpegコマンドを発行して成功を返す', async () => {
            const mockChild = mockSpawn('')

            const segments = [
                { start: 0, end: 10 },
                { start: 20, end: 30 }
            ]

            const result = await FfmpegService.spliceSegments('in.mp4', segments, 'out.mp4')

            expect(result.success).toBe(true)
            expect(result.outPath).toBe('out.mp4')

            // 引数の検証
            const spawnCalls = vi.mocked(child_process.spawn).mock.calls
            const lastCall = spawnCalls[spawnCalls.length - 1]
            const args = lastCall[1] as string[]

            // フィルタ文字列が含まれているか簡易チェック
            expect(args).toContain('-filter_complex')
            const filter = args[args.indexOf('-filter_complex') + 1]
            expect(filter).toContain('concat=n=2')
        })
    })
})
