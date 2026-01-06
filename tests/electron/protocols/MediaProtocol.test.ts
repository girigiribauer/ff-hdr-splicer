import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleMediaRequest } from '../../../electron/protocols/MediaProtocol'
import fs from 'node:fs'

// Mock fs and fs.promises
vi.mock('node:fs', () => ({
    default: {
        promises: {
            stat: vi.fn()
        },
        createReadStream: vi.fn()
    }
}))

describe('MediaProtocol', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('通常リクエストでファイル全体を返すべき (200 OK)', async () => {
        // Mock file stats
        vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 1000 } as any)
        // Mock stream (dummy)
        const mockStream = { pipe: vi.fn() }
        vi.spyOn(fs, 'createReadStream').mockReturnValue(mockStream as any)

        const request = new Request('media://Users/test/video.mp4')
        const response = await handleMediaRequest(request)

        expect(response.status).toBe(200)
        expect(response.headers.get('Content-Length')).toBe('1000')
        expect(response.headers.get('Content-Type')).toBe('video/mp4')
    })

    it('Rangeリクエストで部分データを返すべき (206 Partial Content)', async () => {
        vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 1000 } as any)
        vi.spyOn(fs, 'createReadStream').mockReturnValue({ pipe: vi.fn() } as any)

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
})
