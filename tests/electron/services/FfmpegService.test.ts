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

    describe('spliceSegments', () => {
        it('セグメント配列が空の場合、エラーを返す', async () => {
            const result = await FfmpegService.spliceSegments('in.mp4', [], 'out.mp4')
            expect(result.error).toBe('No segments provided')
        })

        it('正常時、ffmpegコマンドを発行して成功を返す', async () => {
            mockSpawn('')

            const segments = [
                { start: 0, end: 10 },
                { start: 20, end: 30 }
            ]

            const result = await FfmpegService.spliceSegments('in.mp4', segments, 'out.mp4')

            expect(result.success).toBe(true)
            expect(result.outPath).toBe('out.mp4')

            // 引数の検証
            const spawnCalls = vi.mocked(spawn).mock.calls
            const lastCall = spawnCalls[spawnCalls.length - 1]
            const args = lastCall[1] as string[]

            // フィルタ文字列が含まれているか簡易チェック
            expect(args).toContain('-filter_complex')
            const filter = args[args.indexOf('-filter_complex') + 1]
            expect(filter).toContain('concat=n=2')

            // 10bit出力の確認
            expect(args).toContain('-pix_fmt')
            expect(args).toContain('yuv420p10le')
        })

        it('Crossfade有効（複数セグメント）時、xfade/acrossfadeフィルタチェーンが構築される', async () => {
            mockSpawn('')

            const segments = [
                { start: 0, end: 10 },    // Duration 10
                { start: 20, end: 32 },   // Duration 12
                { start: 40, end: 55 }    // Duration 15
            ]
            // Enable Crossfade -> Should trigger Start/End fades and Crossfades
            const fadeOptions = { crossfade: true, fadeDuration: 2.0, crossfadeDuration: 1.0 }

            await FfmpegService.spliceSegments('in.mp4', segments, 'out.mp4', fadeOptions)

            const spawnCalls = vi.mocked(spawn).mock.calls

            const ffmpegCall = spawnCalls.find(call => {
                const args = call[1] as string[]
                return args && args.includes('-filter_complex')
            })
            if (!ffmpegCall) throw new Error('ffmpeg call not found')

            const args = ffmpegCall[1] as string[]
            const filterIndex = args.indexOf('-filter_complex') + 1
            const filter = args[filterIndex]

            expect(filter).toContain('fade=t=in:st=0:d=2')

            expect(filter).toContain('xfade=transition=fade')

            expect(filter).toContain('fade=t=out')
        })

        it('Crossfade無効時でも、Tactile Fadeが適用される', async () => {
            mockSpawn('')
            const segments = [
                { start: 0, end: 10 },
                { start: 20, end: 32 }
            ]
            const fadeOptions = { crossfade: false, fadeDuration: 1.0, crossfadeDuration: 1.0 }

            await FfmpegService.spliceSegments('in.mp4', segments, 'out.mp4', fadeOptions)

            const spawnCalls = vi.mocked(spawn).mock.calls
            const ffmpegCall = spawnCalls.find(call => {
                const args = call[1] as string[]
                return args && args.includes('-filter_complex')
            })
            if (!ffmpegCall) throw new Error('ffmpeg call not found')

            const args = ffmpegCall[1] as string[]
            const filter = args[args.indexOf('-filter_complex') + 1]

            expect(filter).toContain('concat=n=2')

            expect(filter).toContain('fade=t=in')
        })

        it('クリップ長がフェード時間より短い場合、フェード時間が調整される（あるいはエラーにならない）', async () => {
            mockSpawn('')
            // 2s clip
            const segments = [{ start: 0, end: 2 }]
            // 5s fade
            const fadeOptions = { crossfade: true, fadeDuration: 5.0, crossfadeDuration: 1.0 }

            await FfmpegService.spliceSegments('in.mp4', segments, 'out.mp4', fadeOptions)

            const spawnCalls = vi.mocked(spawn).mock.calls
            const ffmpegCall = spawnCalls.find(call => {
                const args = call[1] as string[]
                return args && args.includes('-filter_complex')
            })
            if (!ffmpegCall) throw new Error('ffmpeg call not found')

            const args = ffmpegCall[1] as string[]
            const filter = args[args.indexOf('-filter_complex') + 1]

            expect(filter).toContain('fade=t=in:st=0:d=5')
        })

        it('単純連結（Crossfade無効）時、concatフィルタが使用される', async () => {
            mockSpawn('')

            const segments = [
                { start: 0, end: 10 },
                { start: 20, end: 30 }
            ]
            // Disable Crossfade
            const fadeOptions = { crossfade: false, fadeDuration: 2.0, crossfadeDuration: 1.0 }

            await FfmpegService.spliceSegments('in.mp4', segments, 'out.mp4', fadeOptions)

            const spawnCalls = vi.mocked(spawn).mock.calls
            const ffmpegCall = spawnCalls.find(call => {
                const args = call[1] as string[]
                return args && args.includes('-filter_complex')
            })
            const args = ffmpegCall![1] as string[]
            const filter = args[args.indexOf('-filter_complex') + 1]

            expect(filter).toContain('concat=n=2:v=1:a=1')
            expect(filter).not.toContain('xfade')
            expect(filter).toContain('fade=t=in')
        })

        it('単一セグメント＋Transitions有効時、Fade In/Outのみ適用される', async () => {
            mockSpawn('')

            const segments = [
                { start: 0, end: 10 }
            ]
            const fadeOptions = { crossfade: true, fadeDuration: 1.5, crossfadeDuration: 1.0 }

            await FfmpegService.spliceSegments('in.mp4', segments, 'out.mp4', fadeOptions)

            const spawnCalls = vi.mocked(spawn).mock.calls
            const ffmpegCall = spawnCalls.find(call => {
                const args = call[1] as string[]
                return args && args.includes('-filter_complex')
            })
            const args = ffmpegCall![1] as string[]
            const filter = args[args.indexOf('-filter_complex') + 1]

            expect(filter).toContain('fade=t=in:st=0:d=1.5')
            expect(filter).toContain('fade=t=out')
            expect(filter).toContain('concat=n=1')
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

    describe('spliceSegments Progress', () => {
        it('進捗コールバックが正しく呼ばれる', async () => {
            const segments = [
                { start: 0, end: 10 },
                { start: 20, end: 30 }
            ]

            const stderrLogs = [
                'frame=... time=00:00:10.00 ...'
            ]

            mockSpawn('', 0, stderrLogs)

            const onProgress = vi.fn()
            await FfmpegService.spliceSegments('in.mp4', segments, 'out.mp4', undefined, onProgress)

            expect(onProgress).toHaveBeenCalledWith(50)
        })
    })
})
