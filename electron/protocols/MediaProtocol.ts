import path from 'node:path'
import fs from 'node:fs'
import { Readable } from 'node:stream'

export async function handleMediaRequest(request: Request): Promise<Response> {
    console.log('[MediaProtocol] Request URL:', request.url)
    let url = request.url.replace('media://', '')

    // Ensure absolute path logic (for Mac/Linux)
    if (process.platform !== 'win32' && !url.startsWith('/')) {
        url = '/' + url
    }

    try {
        const filePath = decodeURIComponent(url)
        console.log('[MediaProtocol] Resolved Path:', filePath)

        // Simple MIME type logic
        const ext = path.extname(filePath).toLowerCase()
        let mimeType = 'video/mp4'
        if (ext === '.mov') mimeType = 'video/quicktime'
        if (ext === '.mkv') mimeType = 'video/x-matroska'
        console.log('[MediaProtocol] Determined MIME:', mimeType)

        const stats = await fs.promises.stat(filePath)
        console.log('[MediaProtocol] File Found:', filePath, 'Size:', stats.size)

        const fileSize = stats.size // fs.Stats.size returns number
        const range = request.headers.get('Range')
        console.log('[MediaProtocol] Range Header:', range)

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-")
            const start = parseInt(parts[0], 10)
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
            const chunksize = (end - start) + 1
            console.log(`[MediaProtocol] Serving Range: ${start}-${end} (Chunk: ${chunksize})`)

            const nodeStream = fs.createReadStream(filePath, { start, end })
            const webStream = Readable.toWeb(nodeStream)

            return new Response(webStream as any, {
                status: 206,
                headers: {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize.toString(),
                    'Content-Type': mimeType
                }
            })
        } else {
            const headers = new Headers()
            headers.set('Content-Length', fileSize.toString())
            headers.set('Content-Type', mimeType)

            const nodeStream = fs.createReadStream(filePath)
            const webStream = Readable.toWeb(nodeStream)

            return new Response(webStream as any, {
                status: 200,
                headers
            })
        }
    } catch (error) {
        console.error('[Media Protocol] Error:', error)
        return new Response('Internal Server Error', { status: 500 })
    }
}
