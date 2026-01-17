import { describe, it, expect } from 'vitest'
import { normalizeMediaUrlToPath } from '../../../electron/utils/PathUtils'
import { fileURLToPath } from 'node:url'

describe('PathUtils', () => {
    describe('normalizeMediaUrlToPath', () => {
        const isWin = process.platform === 'win32'

        it.skipIf(isWin)('スキームを file:// に置換して fileURLToPath に委譲する（Mac環境想定）', () => {
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
            // Use platform specific path to avoid "File URL path must be absolute" error on Windows
            // when feeding a POSIX path to fileURLToPath.
            const isWin = process.platform === 'win32'
            const basePath = isWin ? 'C:/Users/test/' : '/Users/test/'

            // media://...%E5%8B%95%E7%94%BB... -> file://... -> decoded path
            const input = `media://${basePath}%E5%8B%95%E7%94%BB.mp4`
            const expected = fileURLToPath(`file://${basePath}%E5%8B%95%E7%94%BB.mp4`)

            const result = normalizeMediaUrlToPath(input, process.platform)
            expect(result).toBe(expected)
        })
    })
})
