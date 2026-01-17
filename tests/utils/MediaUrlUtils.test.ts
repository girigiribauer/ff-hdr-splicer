import { describe, it, expect } from 'vitest'
import { toMediaUrl } from '../../src/utils/MediaUrlUtils'

describe('MediaUrlUtils', () => {
    describe('toMediaUrl', () => {
        it('Mac/Linuxパス: /Users/test/video.mp4 -> media:///Users/test/video.mp4', () => {
            const input = '/Users/test/video.mp4'
            const result = toMediaUrl(input)
            expect(result).toBe('media:///Users/test/video.mp4')
        })

        it('Windowsパス: C:\\Users\\test\\video.mp4 -> media:///C:/Users/test/video.mp4', () => {
            const input = 'C:\\Users\\test\\video.mp4'
            const result = toMediaUrl(input)
            // Expect:
            // 1. Backslashes -> Slashes
            // 2. Prepend / -> /C:/...
            // 3. media:// + ...
            expect(result).toBe('media:///C:/Users/test/video.mp4')
        })

        it('プロキシパスが指定された場合はそちらを優先する', () => {
            const path = '/Users/original.mp4'
            const proxy = '/tmp/proxy.mp4'
            const result = toMediaUrl(path, proxy)
            expect(result).toBe('media:///tmp/proxy.mp4')
        })

        it('スペースや特殊文字を含むパスを正しくエンコードする', () => {
            const input = '/Users/test/my video.mp4'
            const result = toMediaUrl(input)
            expect(result).toBe('media:///Users/test/my%20video.mp4')
        })

        it('日本語ファイル名を正しくエンコードする', () => {
            const input = '/Users/test/動画.mp4'
            const result = toMediaUrl(input)
            expect(result).toBe('media:///Users/test/%E5%8B%95%E7%94%BB.mp4')
        })
    })
})
