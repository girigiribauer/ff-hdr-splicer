import { describe, it, expect } from 'vitest'
import { normalizeMediaUrlToPath } from '../../../electron/utils/PathUtils'
import { fileURLToPath } from 'node:url'

describe('PathUtils', () => {
    describe('normalizeMediaUrlToPath', () => {
        it('スキームを file:// に置換して fileURLToPath に委譲する（Mac環境想定）', () => {
            // Test that "media://" is treated exactly like "file://"
            const input = 'media:///Users/test/video.mp4'
            // Expected: behavior of fileURLToPath('file:///Users/test/video.mp4')
            const expected = fileURLToPath('file:///Users/test/video.mp4')

            const result = normalizeMediaUrlToPath(input, 'darwin')
            expect(result).toBe(expected)
        })

        it('Windows形式のURLも file:// として渡される', () => {
            const input = 'media:///C:/Users/test/video.mp4'
            // Even on Mac, this returns a path (usually /C:/Users/...)
            const expected = fileURLToPath('file:///C:/Users/test/video.mp4')

            const result = normalizeMediaUrlToPath(input, 'win32')
            expect(result).toBe(expected)
        })

        it('エンコードされたパスも正しく処理される', () => {
            // media://...%E5%8B%95%E7%94%BB... -> file://... -> decoded path
            const input = 'media:///Users/test/%E5%8B%95%E7%94%BB.mp4'
            const expected = fileURLToPath('file:///Users/test/%E5%8B%95%E7%94%BB.mp4')

            const result = normalizeMediaUrlToPath(input, 'darwin')
            expect(result).toBe(expected)
        })
    })
})
