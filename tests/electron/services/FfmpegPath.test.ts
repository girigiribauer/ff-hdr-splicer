import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as FfmpegPath from '../../../electron/services/FfmpegPath'

// Mock createRequire
vi.mock('node:module', () => {
    return {
        default: {
            createRequire: () => (moduleName: string) => {
                if (moduleName === 'ffmpeg-static') {
                    return globalThis.mockFfmpegPath || '/mock/ffmpeg'
                }
                if (moduleName === 'ffprobe-static') {
                    return { path: globalThis.mockFfprobePath || '/mock/ffprobe' }
                }
                return {}
            }
        },
        createRequire: () => (moduleName: string) => {
            if (moduleName === 'ffmpeg-static') {
                return globalThis.mockFfmpegPath || '/mock/ffmpeg'
            }
            if (moduleName === 'ffprobe-static') {
                return { path: globalThis.mockFfprobePath || '/mock/ffprobe' }
            }
            return {}
        }
    }
})

describe('FfmpegPath', () => {
    beforeEach(() => {
        globalThis.mockFfmpegPath = undefined
        globalThis.mockFfprobePath = undefined
        vi.clearAllMocks()
    })

    describe('getFFmpegPath', () => {
        it('asar環境でない場合、基本パスを返す（置換なし）', () => {
            globalThis.mockFfmpegPath = '/usr/bin/ffmpeg'
            const result = FfmpegPath.getFFmpegPath()
            expect(result).toBe('/usr/bin/ffmpeg')
        })

        it('app.asarが含まれる場合、app.asar.unpackedに置換する', () => {
            globalThis.mockFfmpegPath = '/Applications/App.app/Contents/Resources/app.asar/node_modules/ffmpeg-static/ffmpeg'
            const result = FfmpegPath.getFFmpegPath()
            expect(result).toBe('/Applications/App.app/Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg')
        })

        it('既にunpackedなパスの場合、二重に置換しない', () => {
            globalThis.mockFfmpegPath = '/Applications/App.app/Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg'
            const result = FfmpegPath.getFFmpegPath()
            expect(result).toBe('/Applications/App.app/Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg')
        })
    })

    describe('getFFprobePath', () => {
        it('asar環境でない場合、基本パスを返す（置換なし）', () => {
            globalThis.mockFfprobePath = '/usr/bin/ffprobe'
            const result = FfmpegPath.getFFprobePath()
            expect(result).toBe('/usr/bin/ffprobe')
        })

        it('app.asarが含まれる場合、app.asar.unpackedに置換する', () => {
            globalThis.mockFfprobePath = '/Applications/App.app/Contents/Resources/app.asar/node_modules/ffprobe-static/ffprobe'
            const result = FfmpegPath.getFFprobePath()
            expect(result).toBe('/Applications/App.app/Contents/Resources/app.asar.unpacked/node_modules/ffprobe-static/ffprobe')
        })
    })
})

// Types for global mock
declare global {
    var mockFfmpegPath: string | undefined
    var mockFfprobePath: string | undefined
}
