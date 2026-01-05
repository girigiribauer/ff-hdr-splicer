import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function getFFmpegPath(): string {
    const ffmpegPath = require('ffmpeg-static')
    if (ffmpegPath) {
        return ffmpegPath.replace('app.asar', 'app.asar.unpacked')
    }
    return ''
}

function getFFprobePath(): string {
    const probePath = require('ffprobe-static').path
    if (probePath) {
        return probePath.replace('app.asar', 'app.asar.unpacked')
    }
    return ''
}

export async function checkFFmpeg(): Promise<{ path: string; version?: string; code?: number; error?: any }> {
    const binPath = getFFmpegPath()
    return new Promise((resolve) => {
        const child = spawn(binPath, ['-version'])
        let output = ''
        child.stdout.on('data', (d) => (output += d.toString()))
        child.on('close', (code) => {
            resolve({ path: binPath, code: code ?? undefined, version: output.split('\n')[0] })
        })
        child.on('error', (err) => {
            resolve({ path: binPath, error: err })
        })
    })
}

export async function getDuration(filePath: string): Promise<number> {
    const ffprobePath = getFFprobePath()
    try {
        return await new Promise<number>((resolve, reject) => {
            const child = spawn(ffprobePath, [
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                filePath
            ])
            let out = ''
            child.stdout.on('data', (d) => (out += d.toString()))
            child.on('close', (code) => {
                if (code === 0) resolve(parseFloat(out.trim()))
                else reject(new Error(`Probe failed with code ${code}`))
            })
            child.on('error', (err) => reject(err))
        })
    } catch (e: any) {
        throw new Error(`Probe failed: ${e.message}`)
    }
}

export async function getVideoMetadata(filePath: string): Promise<any> {
    const ffprobePath = getFFprobePath()
    return new Promise((resolve, reject) => {
        // Check for color_transfer and color_primaries
        // -show_entries stream=color_space,color_transfer,color_primaries
        const child = spawn(ffprobePath, [
            '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=color_space,color_transfer,color_primaries',
            '-of', 'json',
            filePath
        ])
        let out = ''
        child.stdout.on('data', (d) => (out += d.toString()))
        child.on('close', (code) => {
            if (code === 0) {
                try {
                    const json = JSON.parse(out)
                    resolve(json)
                } catch (e) {
                    reject(new Error('Failed to parse ffprobe output'))
                }
            } else {
                reject(new Error(`Probe failed with code ${code}`))
            }
        })
        child.on('error', (err) => reject(new Error(`Probe failed: ${err.message}`)))
    })
}

export async function spliceSegments(
    filePath: string,
    segments: { start: number; end: number }[],
    outPath: string
): Promise<{ success?: boolean; outPath?: string; error?: string; stderr?: string }> {
    if (segments.length === 0) return { error: 'No segments provided' }

    const ffmpegPath = getFFmpegPath()

    // Build Complex Filter
    // Example:
    // [0:v]trim=0:2,setpts=PTS-STARTPTS[v0];
    // [0:a]atrim=0:2,asetpts=PTS-STARTPTS[a0];
    // [v0][a0]...,concat=n=N:v=1:a=1[v][a]

    let filter = ''
    let concatInputs = ''

    segments.forEach((seg, i) => {
        // Video trim: trim works with PTS/metadata, so we need setpts to reset timestamp
        filter += `[0:v]trim=${seg.start}:${seg.end},setpts=PTS-STARTPTS[v${i}];`
        // Audio trim: atrim
        filter += `[0:a]atrim=${seg.start}:${seg.end},asetpts=PTS-STARTPTS[a${i}];`

        concatInputs += `[v${i}][a${i}]`
    })

    filter += `${concatInputs}concat=n=${segments.length}:v=1:a=1[v][a]`

    const cmdArgs = [
        '-y',
        '-i', filePath,
        '-filter_complex', filter,
        '-map', '[v]',
        '-map', '[a]',
        '-c:v', 'libx265',
        '-crf', '20',
        '-preset', 'fast',
        '-tag:v', 'hvc1',
        '-c:a', 'aac', // Re-encode audio to AAC is safer for concat than copy
        '-b:a', '192k',
        '-map_metadata', '0',
        outPath
    ]

    return new Promise((resolve) => {
        const child = spawn(ffmpegPath, cmdArgs)
        let stderr = ''
        child.stderr.on('data', (d) => (stderr += d.toString()))
        child.on('close', (code) => {
            if (code === 0) resolve({ success: true, outPath })
            else resolve({ error: `FFmpeg splice failed code ${code}`, stderr })
        })
    })
}
