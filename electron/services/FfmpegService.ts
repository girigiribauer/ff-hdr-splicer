import { spawn } from 'node:child_process'
import { getFFmpegPath, getFFprobePath } from './FfmpegPath'
export { getKeyframes, smartSplice } from './FfmpegSmartRender'

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
