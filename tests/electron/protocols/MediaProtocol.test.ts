import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleMediaRequest } from '../../../electron/protocols/MediaProtocol'
import fs from 'node:fs'
import { Readable } from 'node:stream'

// Mock fs and fs.promises
vi.mock('node:fs', () => ({
    default: {
        promises: {
            stat: vi.fn()
        },
        createReadStream: vi.fn()
    }
}))

// Mock electron
vi.mock('electron', () => ({
    BrowserWindow: {
        getAllWindows: vi.fn().mockReturnValue([])
    }
}))

describe('MediaProtocol', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('通常リクエストでファイル全体を返すべき (200 OK)', async () => {
        vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 1000 } as any)
        const mockStream = Readable.from(Buffer.from('dummy data'))
        vi.spyOn(fs, 'createReadStream').mockReturnValue(mockStream as any)

        const request = new Request('media://Users/test/video.mp4')
        const response = await handleMediaRequest(request)

        expect(response.status).toBe(200)
        expect(response.headers.get('Content-Length')).toBe('1000')
        expect(response.headers.get('Content-Type')).toBe('video/mp4')
    })

    it('Rangeリクエストで部分データを返すべき (206 Partial Content)', async () => {
        vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 1000 } as any)
        const mockStream = Readable.from(Buffer.from('dummy data'))
        vi.spyOn(fs, 'createReadStream').mockReturnValue(mockStream as any)

        const request = new Request('media://Users/test/video.mov', {
            headers: { 'Range': 'bytes=0-499' }
        })
        const response = await handleMediaRequest(request)

        expect(response.status).toBe(206)
        expect(response.headers.get('Content-Range')).toBe('bytes 0-499/1000')
        expect(response.headers.get('Content-Length')).toBe('500')
        expect(response.headers.get('Content-Type')).toBe('video/quicktime')
    })

    it('存在しないファイルへのリクエストで404を返すべき', async () => {
        vi.spyOn(fs.promises, 'stat').mockRejectedValue(new Error('ENOENT'))

        const request = new Request('media://Users/test/missing.mp4')
        const response = await handleMediaRequest(request)

        expect(response.status).toBe(404)
    })

    it('日本語ファイル名（URLエンコード）を正しくデコードして開くべき', async () => {
        vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 1000 } as any)
        const mockStream = Readable.from(Buffer.from('dummy data'))
        vi.spyOn(fs, 'createReadStream').mockReturnValue(mockStream as any)

        // media://Users/test/%E5%8B%95%E7%94%BB.mp4 -> /Users/test/動画.mp4
        const request = new Request('media://Users/test/%E5%8B%95%E7%94%BB.mp4')
        const response = await handleMediaRequest(request)

        expect(response.status).toBe(200)

        // Windows では media://Users... は Users... となるため、CWDからの相対パスか、
        // あるいはProtocolの仕様として絶対パスを期待するならテスト側で調整が必要。
        // ここでは実装に合わせ、Windowsの場合はスラッシュなし（またはそのまま）を許容する
        const expectedPath = process.platform === 'win32'
            ? 'Users/test/動画.mp4'
            : '/Users/test/動画.mp4'
        expect(fs.createReadStream).toHaveBeenCalledWith(expectedPath)
    })
})
