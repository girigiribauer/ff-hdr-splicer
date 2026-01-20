import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as FfmpegService from '../../../electron/services/FfmpegService'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'events'

vi.mock('node:child_process', () => {
    const spawn = vi.fn()
    const exec = vi.fn()
    return {
        __esModule: true,
        spawn,
        exec,
        default: { spawn, exec }
    }
})

describe('FfmpegService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    function mockSpawn(stdout: string, code: number = 0, stderrEvents: string[] = []) {
        const spawnMock = vi.mocked(spawn)

        spawnMock.mockImplementation((command: string, args: readonly string[]) => {
            const child = new EventEmitter() as any
            child.stdout = new EventEmitter()
            child.stderr = new EventEmitter()
            child.kill = vi.fn()

            setTimeout(() => {
                // Check if this is the probe command or the main command
                const isProbe = command.includes('ffprobe') || (args && args[1] === 'ffprobe')

                if (isProbe) {
                    if (code !== 0) {
                        child.emit('close', code)
                    } else if (args && args.some(a => a.includes('streams'))) {
                        // This is getVideoMetadata probe
                        if (stdout) {
                            child.stdout.emit('data', stdout)
                        } else {
                            const probeData = JSON.stringify({
                                streams: [{
                                    color_transfer: 'smpte2084',
                                    color_primaries: 'bt2020'
                                }]
                            })
                            child.stdout.emit('data', probeData)
                        }
                        child.emit('close', 0)
                    } else {
                        // This is likely getDuration or other probe using the supplied stdout
                        child.stdout.emit('data', stdout)
                        child.emit('close', 0)
                    }
                } else {
                    child.stdout.emit('data', stdout)
                    // Emit stderr events if provided (simulating progress)
                    if (stderrEvents && stderrEvents.length > 0) {
                        stderrEvents.forEach(e => child.stderr.emit('data', e))
                    }
                    child.emit('close', code)
                }
            }, 10)
            return child as any
        })

        return spawnMock
    }

    describe('checkFFmpeg', () => {
        it('正常時、パスとバージョン情報を返す', async () => {
            mockSpawn('ffmpeg version 6.0-static ...\nbuilt with ...')
            const result = await FfmpegService.checkFFmpeg()
            expect(result.path).toBeDefined()
            expect(result.code).toBe(0)
            expect(result.version).toContain('ffmpeg version 6.0')
        })

        it('起動エラー時、エラーオブジェクトを返す', async () => {
            const child = new EventEmitter() as any
            child.stdout = new EventEmitter()
            child.stderr = new EventEmitter()
            vi.mocked(spawn).mockReturnValue(child)

            setTimeout(() => {
                child.emit('error', new Error('Spawn failed'))
            }, 10)

            const result = await FfmpegService.checkFFmpeg()
            expect(result.error).toBeDefined()
            expect(result.error.message).toBe('Spawn failed')
        })
    })

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

            vi.mocked(spawn).mockReturnValue(child)

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

    describe('generateProxy', () => {
        it('プロキシ生成コマンドが正しく発行される', async () => {
            mockSpawn('')

            const result = await FfmpegService.generateProxy('in.mov')

            expect(result.success).toBe(true)

            const spawnCalls = vi.mocked(spawn).mock.calls
            const lastCall = spawnCalls[spawnCalls.length - 1]
            const args = lastCall[1] as string[]

            expect(args).toContain('scale=-1:480')
            expect(args).toContain('libx264')
            expect(args).toContain('ultrafast')
            // 8bit強制出力の確認
            expect(args).toContain('-pix_fmt')
            expect(args).toContain('yuv420p')
        })

        it('進捗コールバックが呼ばれる', async () => {
            const formatJson = JSON.stringify({
                format: { duration: "100.000000" },
                streams: []
            })

            const stderrLogs = [
                'frame= 100 fps= 0.0 q=0.0 size= 0kB time=00:00:50.00 bitrate=N/A speed= N/A'
            ]

            mockSpawn(formatJson, 0, stderrLogs)

            const onProgress = vi.fn()
            await FfmpegService.generateProxy('in.mov', onProgress)

            expect(onProgress).toHaveBeenCalledWith(50)
        })
    })
})
