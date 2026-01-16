export function normalizeMediaUrlToPath(url: string, platform: string = process.platform): string {
    const rawPath = url.replace('media://', '')
    let filePath = decodeURIComponent(rawPath)

    if (platform === 'win32') {
        if (/^\/[a-zA-Z]:/.test(filePath)) {
            filePath = filePath.slice(1)
        }
    } else {
        if (!filePath.startsWith('/')) {
            filePath = '/' + filePath
        }
    }

    return filePath
}
