import { fileURLToPath } from 'node:url'
import { platform } from 'node:process'

export function normalizeMediaUrlToPath(url: string, _platform: string = platform): string {
    // 1. Switch scheme media:// -> file://
    // Force 3 slashes to ensure empty host (local file path)
    // Browser might send media://host/path -> file://host/path (UNC), but we want file:///path
    const fileUrl = url.replace(/^media:\/*/, 'file:///')

    return fileURLToPath(fileUrl)
}
