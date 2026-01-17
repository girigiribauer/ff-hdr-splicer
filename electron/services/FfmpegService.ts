import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function getFFmpegPath(): string {
    const ffmpegPath = require('ffmpeg-static')
    if (ffmpegPath) {
        // Prevent double replacement if already unpacked
        if (ffmpegPath.includes('app.asar.unpacked')) return ffmpegPath
        return ffmpegPath.replace('app.asar', 'app.asar.unpacked')
    }
    return ''
}

function getFFprobePath(): string {
    const probe = require('ffprobe-static')
    const probePath = probe.path
    if (probePath) {
        if (probePath.includes('app.asar.unpacked')) return probePath
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
                if (code === 0) {
                    const cleanOut = out.trim()
                    // Handle potential comma decimals (European locales)
                    const duration = parseFloat(cleanOut.replace(',', '.'))
                    if (isNaN(duration)) {
                        reject(new Error(`Parsed duration is NaN. Output: ${cleanOut}`))
                    } else {
                        resolve(duration)
                    }
                }
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
            '-show_entries', 'format=size,duration,bit_rate:stream=codec_name,codec_long_name,width,height,pix_fmt,color_space,color_transfer,color_primaries,codec_type',
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
    outPath: string,
    fadeOptions?: { crossfade: boolean; fadeDuration: number; crossfadeDuration: number },
    onProgress?: (percent: number) => void
): Promise<{ success?: boolean; outPath?: string; error?: string; stderr?: string }> {
    if (segments.length === 0) return { error: 'No segments provided' }

    const ffmpegPath = getFFmpegPath()

    // 1. Probe header info
    // (Future: Use metadata to set color properties if needed)
    try {
        await getVideoMetadata(filePath)
    } catch (e) {
        console.warn('Failed to probe video metadata', e)
    }

    let filter = ''
    const videoDur = fadeOptions?.fadeDuration || 1.0
    const xDur = fadeOptions?.crossfadeDuration || 1.0
    const enableCrossfade = fadeOptions?.crossfade ?? false

    let progressTotalDuration = 0
    if (enableCrossfade && segments.length > 1) {
        progressTotalDuration = segments.reduce((acc, s) => acc + (s.end - s.start), 0) - ((segments.length - 1) * xDur)
    } else {
        progressTotalDuration = segments.reduce((acc, s) => acc + (s.end - s.start), 0)
    }
    if (progressTotalDuration <= 0) progressTotalDuration = 1

    if (enableCrossfade && segments.length > 1) {
        let currentOffset = 0
        let lastVLabel = '[v0]'
        let lastALabel = '[a0]'

        let s0 = segments[0]
        let v0 = `[0:v]trim=${s0.start}:${s0.end},setpts=PTS-STARTPTS`
        let a0 = `[0:a]atrim=${s0.start}:${s0.end},asetpts=PTS-STARTPTS`

        if (videoDur > 0) {
            v0 += `,fade=t=in:st=0:d=${videoDur}`
            a0 += `,afade=t=in:st=0:d=${videoDur}:curve=desi`
        }
        filter += `${v0}[v0];${a0}[a0];`

        for (let i = 1; i < segments.length; i++) {
            let s = segments[i]
            filter += `[0:v]trim=${s.start}:${s.end},setpts=PTS-STARTPTS[v${i}];`
            filter += `[0:a]atrim=${s.start}:${s.end},asetpts=PTS-STARTPTS[a${i}];`
        }

        for (let i = 0; i < segments.length - 1; i++) {
            const nextIndex = i + 1
            const segDuration = segments[i].end - segments[i].start

            currentOffset += segDuration - xDur

            const nextVLabel = nextIndex === segments.length - 1 ? '[v_final_pre]' : `[v_merge_${i}]`
            const nextALabel = nextIndex === segments.length - 1 ? '[a_final_pre]' : `[a_merge_${i}]`

            filter += `${lastVLabel}[v${nextIndex}]xfade=transition=fade:duration=${xDur}:offset=${currentOffset}${nextVLabel};`
            filter += `${lastALabel}[a${nextIndex}]acrossfade=d=${xDur}:c1=desi:c2=desi${nextALabel};`

            lastVLabel = nextVLabel
            lastALabel = nextALabel
        }

        const totalDuration = segments.reduce((acc, s) => acc + (s.end - s.start), 0) - ((segments.length - 1) * xDur)
        const fadeOutStart = Math.max(0, totalDuration - videoDur)

        if (videoDur > 0) {
            filter += `${lastVLabel}fade=t=out:st=${fadeOutStart}:d=${videoDur}[v];`
            filter += `${lastALabel}afade=t=out:st=${fadeOutStart}:d=${videoDur}:curve=desi[a]`
        } else {
            filter += `${lastVLabel}copy[v];${lastALabel}copy[a]` // Or just alias? copy filter is fine.
        }

    } else {
        let concatInputs = ''

        segments.forEach((seg, i) => {
            let vFilters = `[0:v]trim=${seg.start}:${seg.end},setpts=PTS-STARTPTS`
            let aFilters = `[0:a]atrim=${seg.start}:${seg.end},asetpts=PTS-STARTPTS`

            const isFirst = i === 0
            const isLast = i === segments.length - 1
            const segDur = seg.end - seg.start

            if (isFirst && videoDur > 0) {
                vFilters += `,fade=t=in:st=0:d=${videoDur}`
                aFilters += `,afade=t=in:st=0:d=${videoDur}:curve=desi`
            }

            if (isLast && videoDur > 0) {
                const startOut = Math.max(0, segDur - videoDur)
                vFilters += `,fade=t=out:st=${startOut}:d=${videoDur}`
                aFilters += `,afade=t=out:st=${startOut}:d=${videoDur}:curve=desi`
            }

            filter += `${vFilters}[v${i}];${aFilters}[a${i}];`
            concatInputs += `[v${i}][a${i}]`
        })

        filter += `${concatInputs}concat=n=${segments.length}:v=1:a=1[v][a]`
    }

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
        child.stderr.on('data', (d) => {
            stderr += d.toString()
            if (onProgress) {
                const s = d.toString()
                const match = s.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/)
                if (match) {
                    const sec = parseTimeStr(match[1])
                    const p = Math.min(100, Math.round((sec / progressTotalDuration) * 100))
                    onProgress(p)
                }
            }
        })
        child.on('close', (code) => {
            if (code === 0) resolve({ success: true, outPath })
            else resolve({ error: `FFmpeg splice failed code ${code}`, stderr })
        })
    })
}

function parseTimeStr(timeStr: string): number {
    const parts = timeStr.split(':')
    if (parts.length < 3) return 0
    const h = parseFloat(parts[0])
    const m = parseFloat(parts[1])
    const s = parseFloat(parts[2])
    return (h * 3600) + (m * 60) + s
}

export async function generateProxy(
    filePath: string,
    onProgress?: (percent: number) => void
): Promise<{ success: boolean; proxyPath?: string; error?: string; stderr?: string }> {
    const ffmpegPath = getFFmpegPath()
    const path = await import('node:path')
    const os = await import('node:os')
    const fs = await import('node:fs')

    // Create temp directory for proxies if not exists
    const tempDir = path.join(os.tmpdir(), 'ff-hdr-splicer-proxies')
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
    }

    const filename = path.basename(filePath)
    const proxyPath = path.join(tempDir, `proxy_${filename}_${Date.now()}.mp4`)

    // Get duration for progress
    let duration = 0
    try {
        const meta = await getVideoMetadata(filePath)
        if (meta && meta.format && meta.format.duration) {
            duration = parseFloat(meta.format.duration)
        }
    } catch (e) {
        // ignore
    }

    // Fast H.264 proxy (480p height)
    const args = [
        '-y',
        '-i', filePath,
        '-vf', 'scale=-1:480',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p', // Ensure 8-bit output for compatibility (fixes 10-bit to 8-bit issues)
        '-preset', 'ultrafast',
        '-crf', '30',
        '-c:a', 'aac',
        '-ac', '2',
        proxyPath
    ]

    return new Promise((resolve) => {
        const child = spawn(ffmpegPath, args)

        let stderr = ''
        if (onProgress && duration > 0) {
            child.stderr.on('data', (d) => {
                const s = d.toString()
                stderr += s
                const match = s.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/)
                if (match) {
                    const sec = parseTimeStr(match[1])
                    const p = Math.min(100, Math.round((sec / duration) * 100))
                    onProgress(p)
                }
            })
        } else {
            child.stderr.on('data', d => stderr += d.toString())
        }

        child.on('close', (code) => {
            if (code === 0) resolve({ success: true, proxyPath })
            else resolve({ success: false, error: `Proxy generation failed with code ${code}`, stderr })
        })
        child.on('error', (err) => resolve({ success: false, error: err.message }))
    })
}
