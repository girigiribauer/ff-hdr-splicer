import { describe, it, expect } from 'vitest'
import { normalizeMediaUrlToPath } from '../../../electron/utils/PathUtils'

describe('PathUtils', () => {
    describe('normalizeMediaUrlToPath', () => {
        // --- Mac/Linux Scenarios ---
        it('Mac環境では絶対パスを保証する（先頭にスラッシュを付与）', () => {
            // media://Users/test.mp4 -> /Users/test.mp4
            const result = normalizeMediaUrlToPath('media://Users/test.mp4', 'darwin')
            expect(result).toBe('/Users/test.mp4')
        })

        it('Mac環境で既にスラッシュがある場合はそのまま維持する', () => {
            // media:///Users/test.mp4 -> /Users/test.mp4
            const result = normalizeMediaUrlToPath('media:///Users/test.mp4', 'darwin')
            expect(result).toBe('/Users/test.mp4')
        })

        // --- Windows Scenarios ---
        it('Windows環境でドライブレター付きパスの先頭のスラッシュを除去する', () => {
            // media:///C:/Users/test.mp4 -> /C:/Users/test.mp4 -> C:/Users/test.mp4
            const result = normalizeMediaUrlToPath('media:///C:/Users/test.mp4', 'win32')
            expect(result).toBe('C:/Users/test.mp4')
        })

        it('Windows環境で先頭スラッシュがない標準パスはそのまま維持する', () => {
            // media://C:/Users/test.mp4 -> C:/Users/test.mp4
            const result = normalizeMediaUrlToPath('media://C:/Users/test.mp4', 'win32')
            expect(result).toBe('C:/Users/test.mp4')
        })

        // --- Common Scenarios ---
        it('URLエンコードされた文字をデコードする', () => {
            // media://Users/foo%20bar.mp4 -> /Users/foo bar.mp4
            const result = normalizeMediaUrlToPath('media://Users/foo%20bar.mp4', 'darwin')
            expect(result).toBe('/Users/foo bar.mp4')
        })

        it('日本語文字をデコードする', () => {
            // media://Users/%E5%8B%95%E7%94%BB.mp4 -> /Users/動画.mp4
            const result = normalizeMediaUrlToPath('media://Users/%E5%8B%95%E7%94%BB.mp4', 'darwin')
            expect(result).toBe('/Users/動画.mp4')
        })
    })
})
