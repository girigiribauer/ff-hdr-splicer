import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export function getFFmpegPath(): string {
    const ffmpegPath = require('ffmpeg-static')
    if (ffmpegPath) {
        // Prevent double replacement if already unpacked
        if (ffmpegPath.includes('app.asar.unpacked')) return ffmpegPath
        return ffmpegPath.replace('app.asar', 'app.asar.unpacked')
    }
    return ''
}

export function getFFprobePath(): string {
    const probe = require('ffprobe-static')
    const probePath = probe.path
    if (probePath) {
        if (probePath.includes('app.asar.unpacked')) return probePath
        return probePath.replace('app.asar', 'app.asar.unpacked')
    }
    return ''
}
