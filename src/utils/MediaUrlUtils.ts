/**
 * Converts a file path to a media:// protocol URL.
 * Handles Windows backslashes and ensures proper URL formatting.
 *
 * @param path The absolute file path
 * @param proxyPath Optional proxy path to use instead (or null)
 * @returns A properly formatted media:// URL
 */
export const toMediaUrl = (path: string, proxyPath?: string | null): string => {
    const targetPath = proxyPath || path
    if (!targetPath) return ''

    let normalized = targetPath.replace(/\\/g, '/')
    if (!normalized.startsWith('/')) {
        normalized = '/' + normalized
    }

    const url = `media://${encodeURI(normalized)}`
    console.log('[MediaUrlUtils] Generated:', { path, proxyPath, normalized, url })
    return url
}
