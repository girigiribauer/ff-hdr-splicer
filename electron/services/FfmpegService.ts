import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export class FfmpegService {
    private getFFmpegPath(): string {
        const ffmpegPath = require('ffmpeg-static')
        if (ffmpegPath) {
            return ffmpegPath.replace('app.asar', 'app.asar.unpacked')
        }
        return ''
    }

    private getFFprobePath(): string {
        const probePath = require('ffprobe-static').path
        if (probePath) {
            return probePath.replace('app.asar', 'app.asar.unpacked')
        }
        return ''
    }

    async checkFFmpeg(): Promise<{ path: string; version?: string; code?: number; error?: any }> {
        const binPath = this.getFFmpegPath()
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

    async getDuration(filePath: string): Promise<number> {
        const ffprobePath = this.getFFprobePath()
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

    async cutSegment(
        filePath: string,
        start: number,
        duration: number,
        outPath: string
    ): Promise<{ success?: boolean; error?: string; stderr?: string }> {
        const ffmpegPath = this.getFFmpegPath()

        // Full Re-encode for precision, trying to keep HDR (using x265 default tagging if input allows)
        const cmdArgs = [
            '-y',
            '-ss', start.toString(),
            '-i', filePath,
            '-t', duration.toString(),
            '-map', '0',
            '-c:v', 'libx265',
            '-crf', '20',
            '-preset', 'fast',
            '-tag:v', 'hvc1',
            '-c:a', 'copy',
            '-map_metadata', '0',
            outPath
        ]

        return new Promise((resolve) => {
            const child = spawn(ffmpegPath, cmdArgs)
            let stderr = ''
            child.stderr.on('data', (d) => (stderr += d.toString()))
            child.on('close', (code) => {
                if (code === 0) resolve({ success: true })
                else resolve({ error: `FFmpeg failed code ${code}`, stderr })
            })
        })
    }

    async runTestCut(filePath: string): Promise<{ success?: boolean; outPath?: string; error?: string; stderr?: string }> {
        if (!filePath) return { error: 'No file path provided' }

        // 1. Probe Duration
        let duration: number
        try {
            duration = await this.getDuration(filePath)
        } catch (e: any) {
            return { error: e.message }
        }

        if (!duration || isNaN(duration)) return { error: 'Could not determine duration' }

        // 2. Calculate Cut Range (40% - 60%)
        const start = duration * 0.4
        const t = duration * 0.2 // Length is 20%

        // 3. Output Path Logic
        const outputDir = path.join(path.dirname(filePath), '..', 'output')

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true })
        }

        const ext = path.extname(filePath)
        const originalName = path.basename(filePath, ext)
        const outPath = this.getUniqueOutputPath(outputDir, originalName, ext)

        // 4. Run FFmpeg Re-encode
        const result = await this.cutSegment(filePath, start, t, outPath)

        if (result.success) {
            return { success: true, outPath }
        } else {
            return { error: result.error, stderr: result.stderr }
        }
    }

    private getUniqueOutputPath(dir: string, name: string, ext: string): string {
        let candidate = path.join(dir, `${name}_cut${ext}`)
        if (!fs.existsSync(candidate)) return candidate

        let counter = 2
        while (true) {
            candidate = path.join(dir, `${name}_cut_${counter}${ext}`)
            if (!fs.existsSync(candidate)) return candidate
            counter++
        }
    }
}
