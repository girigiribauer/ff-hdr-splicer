import path from 'node:path'
import fs from 'node:fs'
import { Readable } from 'node:stream'

export async function handleMediaRequest(request: Request): Promise<Response> {
    let url = request.url.replace('media://', '')

    // Ensure absolute path logic (for Mac/Linux)
    if (process.platform !== 'win32' && !url.startsWith('/')) {
        url = '/' + url
    }

    const filePath = decodeURIComponent(url)

    // Simple MIME type logic
    const ext = path.extname(filePath).toLowerCase()
    let mimeType = 'video/mp4'
    if (ext === '.mov') mimeType = 'video/quicktime'
    if (ext === '.mkv') mimeType = 'video/x-matroska'

    try {
        const stats = await fs.promises.stat(filePath)
        const fileSize = stats.size // fs.Stats.size returns number
        const range = request.headers.get('Range')

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-")
            const start = parseInt(parts[0], 10)
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
            const chunksize = (end - start) + 1

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
        console.error('[Media Protocol] File Read Error:', error)
        return new Response('File not found', { status: 404 })
    }
}
