import { fileURLToPath } from 'node:url'
import { platform } from 'node:process'

export function normalizeMediaUrlToPath(url: string, _platform: string = platform): string {
    // 1. Switch scheme media:// -> file://
    // Force 3 slashes to ensure empty host (local file path)
    let fileUrl = url.replace(/^media:\/*/, 'file:///')

    // 2. Harden Windows path: Inject colon if missing (e.g., file:///c/Users -> file:///c:/Users)
    // This happens if browser/electron normalized the URL and stripped the colon
    if (_platform === 'win32') {
        // Match file:///x/ where x is a single letter
        fileUrl = fileUrl.replace(/^file:\/\/\/([a-zA-Z])\//, 'file:///$1:/')
    }

    return fileURLToPath(fileUrl)
}
