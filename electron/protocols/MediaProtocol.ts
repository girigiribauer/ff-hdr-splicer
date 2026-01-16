import path from 'node:path'
import fs from 'node:fs'
import { Readable } from 'node:stream'
import { BrowserWindow } from 'electron'
import { normalizeMediaUrlToPath } from '../utils/PathUtils'

function log(...args: any[]) {
    console.log(...args)
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
    // Send to all renderers (simple approach for single window app)
    BrowserWindow.getAllWindows().forEach(w => {
        w.webContents.send('debug-log', `[MediaProtocol] ${msg}`)
    })
}

export async function handleMediaRequest(request: Request): Promise<Response> {
    log('Request URL:', request.url)

    try {
        const filePath = normalizeMediaUrlToPath(request.url)
        log('Resolved Path:', filePath)

        // Simple MIME type logic
        const ext = path.extname(filePath).toLowerCase()
        let mimeType = 'video/mp4'
        if (ext === '.mov') mimeType = 'video/quicktime'
        if (ext === '.mkv') mimeType = 'video/x-matroska'
        log('Determined MIME:', mimeType)

        const stats = await fs.promises.stat(filePath)
        log('File Found:', filePath, 'Size:', stats.size)

        const fileSize = stats.size // fs.Stats.size returns number
        const range = request.headers.get('Range')
        log('Range Header:', range)

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-")
            const start = parseInt(parts[0], 10)
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
            const chunksize = (end - start) + 1
            log(`Serving Range: ${start}-${end} (Chunk: ${chunksize})`)

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
    } catch (error: any) {
        log('Error:', error)
        if (error.code === 'ENOENT' || error.message.includes('ENOENT')) {
            return new Response('File not found', { status: 404 })
        }
        return new Response('Internal Server Error', { status: 500 })
    }
}
