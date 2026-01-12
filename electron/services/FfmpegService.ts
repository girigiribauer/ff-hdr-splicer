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
    fadeOptions?: { crossfade: boolean; fadeDuration: number; crossfadeDuration: number }
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
        child.stderr.on('data', (d) => (stderr += d.toString()))
        child.on('close', (code) => {
            if (code === 0) resolve({ success: true, outPath })
            else resolve({ error: `FFmpeg splice failed code ${code}`, stderr })
        })
    })
}
