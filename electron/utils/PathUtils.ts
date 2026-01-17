import { fileURLToPath } from 'node:url'
import { platform } from 'node:process'

export function normalizeMediaUrlToPath(url: string, _platform: string = platform): string {
    const fileUrl = url.replace(/^media:/, 'file:')

    return fileURLToPath(fileUrl)
}
