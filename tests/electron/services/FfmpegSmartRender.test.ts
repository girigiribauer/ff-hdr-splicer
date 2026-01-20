import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as FfmpegSmartRender from '../../../electron/services/FfmpegSmartRender'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'events'

// Mock Mags
vi.mock('node:child_process', () => {
    const spawn = vi.fn()
    return {
        spawn,
        default: { spawn }
    }
})

// Mock dynamic imports by mocking global modules?
// FfmpegSmartRender uses `await import('node:fs')`. Vitest usually mocks these if `vi.mock('node:fs')` is used.
vi.mock('node:fs', () => {
    const mocks = {
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        rmSync: vi.fn(),
    }
    return {
        ...mocks,
        default: mocks
    }
})

vi.mock('../../../electron/services/FfmpegPath', () => {
    return {
        getFFmpegPath: () => '/bin/ffmpeg',
        getFFprobePath: () => '/bin/ffprobe'
    }
})

describe('FfmpegSmartRender', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    function mockSpawn(
        onCommand: (cmd: string, args: string[]) => { stdout?: string, code?: number }
    ) {
        const spawnMock = vi.mocked(spawn)
        spawnMock.mockImplementation((command: string, args: readonly string[]) => {
            const child = new EventEmitter() as any
            child.stdout = new EventEmitter()
            child.stderr = new EventEmitter()
            child.kill = vi.fn()

            setTimeout(() => {
                const res = onCommand(command, args as string[])
                if (res.stdout) {
                    child.stdout.emit('data', res.stdout)
                }
                child.emit('close', res.code ?? 0)
            }, 5)

            return child
        })
    }

    it('getKeyframes: ffprobeのCSV出力を解析して配列を返す', async () => {
        mockSpawn((cmd, args) => {
            if (args.includes('-skip_frame')) {
                return { stdout: '0.0\n10.5\n20.0\n' }
            }
            return {}
        })

        const kf = await FfmpegSmartRender.getKeyframes('in.mp4')
        expect(kf).toEqual([0, 10.5, 20])
    })

    describe('smartSplice', () => {
        it('スマートスプライスフローが正常に実行される（Head/Tailエンコード + Bodyコピー）', async () => {
            const commands: string[] = []

            mockSpawn((cmd, args) => {
                commands.push(args[0]) // Capture main arg or flag to identify command

                // Keyframes
                if (args.includes('-skip_frame')) {
                    // KFs at 0, 10, 20, 30, 40
                    return { stdout: '0\n10\n20\n30\n40\n' }
                }

                // If Encode/Copy/Concat...
                return { code: 0 }
            })

            const segments = [
                { start: 5, end: 35 } // Includes KFs 10, 20, 30. Body: 10-30. Head: 5-10. Tail: 30-35.
            ]
            const fadeOpts = { fadeInOut: false, crossfade: false, fadeDuration: 1, crossfadeDuration: 1 }
            const mockProgress = vi.fn()

            const res = await FfmpegSmartRender.smartSplice('in.mp4', segments, 'out.mp4', fadeOpts, mockProgress)

            expect(res.success).toBe(true)

            // Check flow
            // 1. Keyframes Probe
            // 2. Head Encode (5-10)
            // 3. Body Copy (10-30)
            // 4. Tail Encode (30-35)
            // 5. Concat Video
            // 6. Audio Process
            // 7. Final Mux

            const spawnCalls = vi.mocked(spawn).mock.calls
            const flattenedArgs = spawnCalls.map(c => c[1].join(' '))

            const isMac = process.platform === 'darwin'
            const expectedCodec = 'libx265'

            // 1. Keyframes
            expect(flattenedArgs[0]).toContain('-skip_frame nokey')

            // 2. Head Encode (args contain trim=5:10)
            const headCall = flattenedArgs.find(a => a.includes('trim=5:10') && !a.includes('copy'))
            expect(headCall).toBeDefined()
            expect(headCall).toContain(expectedCodec) // Re-encode

            // 3. Body Copy (args contain -ss 10 -t 20 -c copy)
            // Duration = 30-10 = 20
            const bodyCall = flattenedArgs.find(a => a.includes('-c copy') && a.includes('-ss 10') && a.includes('-t 20'))
            expect(bodyCall).toBeDefined()

            // 4. Tail Encode (args contain trim=30:35)
            const tailCall = flattenedArgs.find(a => a.includes('trim=30:35') && !a.includes('copy'))
            expect(tailCall).toBeDefined()
            expect(tailCall).toContain(expectedCodec)

            // 5. Concat
            const concatCall = flattenedArgs.find(a => a.includes('concat') && a.includes('video_list.txt'))
            expect(concatCall).toBeDefined()

            // 6. Audio
            const audioCall = flattenedArgs.find(a => a.includes('atrim=5:35'))
            expect(audioCall).toBeDefined()

            // 7. Mux
            const muxCall = flattenedArgs.find(a => a.includes('concat_video.mp4') && a.includes('full_audio.m4a'))
            expect(muxCall).toBeDefined()

            // Progress check
            expect(mockProgress).toHaveBeenCalled()
        })

        it('有効なボディ（コピー可能領域）がない場合、全体を再エンコードする', async () => {
            mockSpawn((cmd, args) => {
                if (args.includes('-skip_frame')) {
                    // Sparse KFs: 0, 100
                    return { stdout: '0\n100\n' }
                }
                return { code: 0 }
            })

            const segments = [{ start: 10, end: 20 }] // 10-20. No KF inside.
            const fadeOpts = { fadeInOut: false, crossfade: false, fadeDuration: 1, crossfadeDuration: 1 }

            await FfmpegSmartRender.smartSplice('in.mp4', segments, 'out.mp4', fadeOpts)

            const spawnCalls = vi.mocked(spawn).mock.calls
            const flattenedArgs = spawnCalls.map(c => c[1].join(' '))

            const isMac = process.platform === 'darwin'
            const expectedCodec = 'libx265'

            // Should encode full segment 10-20
            const fullEncode = flattenedArgs.find(a => a.includes('trim=10:20') && a.includes(expectedCodec))
            expect(fullEncode).toBeDefined()

            // Should NOT have copy
            const copyCall = flattenedArgs.find(a => a.includes('-c copy') && !a.includes('concat'))
            // Note: concat also uses copy, so filter carefully
            // Copy Body uses -ss / -t usually
            expect(copyCall).toBeUndefined()
        })
    })
})
