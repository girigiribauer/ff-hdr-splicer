import { spawn } from 'node:child_process'
import { getFFmpegPath, getFFprobePath } from './FfmpegPath'

export async function getKeyframes(filePath: string): Promise<number[]> {
    const ffprobePath = getFFprobePath()
    return new Promise((resolve, reject) => {
        const child = spawn(ffprobePath, [
            '-v', 'error',
            '-select_streams', 'v:0',
            '-skip_frame', 'nokey',
            '-show_entries', 'frame=pkt_pts_time',
            '-of', 'csv=p=0',
            filePath
        ])
        let out = ''
        child.stdout.on('data', (d) => out += d.toString())
        child.on('close', (code) => {
            if (code === 0) {
                const timestamps = out.trim().split('\n')
                    .map(t => parseFloat(t))
                    .filter(t => !isNaN(t))
                    .sort((a, b) => a - b)
                resolve(timestamps)
            } else {
                reject(new Error(`Keyframe probe failed code ${code}`))
            }
        })
        child.on('error', reject)
    })
}

export async function smartSplice(
    filePath: string,
    segments: { start: number; end: number }[],
    outPath: string,
    fadeOptions: { fadeInOut: boolean; crossfade: boolean; fadeDuration: number; crossfadeDuration: number },
    onProgress?: (percent: number, phase: string) => void
): Promise<{ success?: boolean; outPath?: string; error?: string; stderr?: string }> {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const os = await import('node:os')
    const ffmpegPath = getFFmpegPath()

    const tempDir = path.join(os.tmpdir(), `ff-hdr-smart-${Date.now()}`)
    fs.mkdirSync(tempDir, { recursive: true })

    const cleanup = () => {
        try { fs.rmSync(tempDir, { recursive: true, force: true }) } catch (e) { }
    }

    try {
        if (onProgress) onProgress(5, 'Analyzing Keyframes...')
        const keyframes = await getKeyframes(filePath)
        const videoDur = fadeOptions.fadeDuration || 1.0

        // Step 1: Process Video Segments
        const segmentFiles: string[] = []

        const totalSegments = segments.length

        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i]
            const isFirst = i === 0
            const isLast = i === segments.length - 1

            // Safe Body Calculation
            const fadeInDur = (isFirst && fadeOptions.fadeInOut) ? videoDur : 0
            const fadeOutDur = (isLast && fadeOptions.fadeInOut) ? videoDur : 0

            // Find Body Start Keyframe
            // Must be >= seg.start + fadeInDur
            // Must be <= seg.end - fadeOutDur

            const potentialBodyStartMatches = keyframes.filter(k => k >= (seg.start + fadeInDur))
            const bodyStartKF = potentialBodyStartMatches.length > 0 ? potentialBodyStartMatches[0] : null

            const potentialBodyEndMatches = keyframes.filter(k => k <= (seg.end - fadeOutDur))
            const bodyEndKF = potentialBodyEndMatches.length > 0 ? potentialBodyEndMatches[potentialBodyEndMatches.length - 1] : null

            const fileBase = path.join(tempDir, `seg_${i}`)

            if (bodyStartKF !== null && bodyEndKF !== null && bodyEndKF > bodyStartKF) {
                // We have a valid Copy Body

                // 1. Head (Encode)
                if (bodyStartKF > seg.start) {
                    const headPath = `${fileBase}_head.mp4`
                    await runSmartEncode(ffmpegPath, filePath, seg.start, bodyStartKF, headPath, isFirst && fadeOptions.fadeInOut, false, videoDur)
                    segmentFiles.push(headPath)
                }

                // 2. Body (Copy)
                const bodyPath = `${fileBase}_body.mp4`
                await runStreamCopy(ffmpegPath, filePath, bodyStartKF, bodyEndKF, bodyPath)
                segmentFiles.push(bodyPath)

                // 3. Tail (Encode)
                if (bodyEndKF < seg.end) {
                    const tailPath = `${fileBase}_tail.mp4`
                    await runSmartEncode(ffmpegPath, filePath, bodyEndKF, seg.end, tailPath, false, isLast && fadeOptions.fadeInOut, videoDur)
                    segmentFiles.push(tailPath)
                }
            } else {
                // No valid body (segment too short or no keyframes inside), re-encode whole segment
                const fullPath = `${fileBase}_full.mp4`
                await runSmartEncode(ffmpegPath, filePath, seg.start, seg.end, fullPath, isFirst && fadeOptions.fadeInOut, isLast && fadeOptions.fadeInOut, videoDur)
                segmentFiles.push(fullPath)
            }

            if (onProgress) onProgress(10 + Math.round((i / totalSegments) * 40), `Processed segment ${i + 1}/${totalSegments}`)
        }

        // Step 2: Concat Video Parts
        if (onProgress) onProgress(50, 'Concatenating Video...')
        const videoListPath = path.join(tempDir, 'video_list.txt')
        const videoListContent = segmentFiles.map(f => `file '${f}'`).join('\n')
        fs.writeFileSync(videoListPath, videoListContent)

        const concatenatedVideoPath = path.join(tempDir, 'concat_video.mp4')
        await new Promise((resolve, reject) => {
            const child = spawn(ffmpegPath, [
                '-f', 'concat',
                '-safe', '0',
                '-i', videoListPath,
                '-c', 'copy',
                '-y', concatenatedVideoPath
            ])
            child.on('close', code => code === 0 ? resolve(true) : reject(new Error(`Video concat failed ${code}`)))
            child.on('error', reject)
        })

        // Step 3: Process Audio (Full Re-encode)
        if (onProgress) onProgress(70, 'Processing Audio...')
        const audioPath = path.join(tempDir, 'full_audio.m4a')

        let audioFilter = ''
        // Simplified Audio Graph Construction
        let aStreamMap = ''

        segments.forEach((seg, i) => {
            const isFirst = i === 0
            const isLast = i === segments.length - 1
            const segDur = seg.end - seg.start

            let aFilter = `[0:a]atrim=${seg.start}:${seg.end},asetpts=PTS-STARTPTS`
            if (isFirst && fadeOptions.fadeInOut) aFilter += `,afade=t=in:st=0:d=${videoDur}:curve=desi`
            if (isLast && fadeOptions.fadeInOut) {
                const startOut = Math.max(0, segDur - videoDur)
                aFilter += `,afade=t=out:st=${startOut}:d=${videoDur}:curve=desi`
            }
            audioFilter += `${aFilter}[a${i}];`
            aStreamMap += `[a${i}]`
        })
        audioFilter += `${aStreamMap}concat=n=${segments.length}:v=0:a=1[outa]`

        await new Promise((resolve, reject) => {
            const child = spawn(ffmpegPath, [
                '-i', filePath,
                '-filter_complex', audioFilter,
                '-map', '[outa]',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-y', audioPath
            ])
            child.on('close', code => code === 0 ? resolve(true) : reject(new Error(`Audio processing failed ${code}`)))
            child.on('error', reject)
        })

        // Step 4: Final Mux
        if (onProgress) onProgress(90, 'Final Muxing...')
        await new Promise((resolve, reject) => {
            const child = spawn(ffmpegPath, [
                '-i', concatenatedVideoPath,
                '-i', audioPath,
                '-c', 'copy',
                '-map', '0:v',
                '-map', '1:a',
                '-shortest', // Audio might be slightly different length, clip check?
                '-y', outPath
            ])
            child.on('close', code => code === 0 ? resolve(true) : reject(new Error(`Final mux failed ${code}`)))
            child.on('error', reject)
        })

        if (onProgress) onProgress(100, 'Done')
        cleanup()
        return { success: true, outPath }

    } catch (e: any) {
        cleanup()
        return { error: e.message }
    }
}

// Helper for Smart Encoding (Head/Tail)
function runSmartEncode(
    ffmpegPath: string,
    inFile: string,
    start: number,
    end: number,
    outFile: string,
    fadeIn: boolean,
    fadeOut: boolean,
    fadeDur: number
): Promise<void> {
    return new Promise((resolve, reject) => {
        const duration = end - start
        let filter = `[0:v]trim=${start}:${end},setpts=PTS-STARTPTS`

        // Fades are relative to the CUT segment (0 to duration)
        if (fadeIn) {
            filter += `,fade=t=in:st=0:d=${fadeDur}`
        }
        if (fadeOut) {
            // Last part fade out
            const fadeStart = Math.max(0, duration - fadeDur)
            filter += `,fade=t=out:st=${fadeStart}:d=${fadeDur}`
        }

        filter += `[outv]`

        // Detect HW Accel
        const vArgs = ['-c:v', 'libx265', '-crf', '20', '-preset', 'fast', '-tag:v', 'hvc1']

        const args = [
            '-y',
            '-i', inFile,
            '-filter_complex', filter,
            '-map', '[outv]',
            ...vArgs,
            '-pix_fmt', 'yuv420p10le', // Maintain HDR 10bit
            '-an', // No Audio
            outFile
        ]

        const child = spawn(ffmpegPath, args)
        child.on('close', code => code === 0 ? resolve() : reject(new Error(`Encode failed ${code}`)))
        child.on('error', reject)
    })
}

// Helper for Stream Copy
function runStreamCopy(
    ffmpegPath: string,
    inFile: string,
    start: number,
    end: number,
    outFile: string
): Promise<void> {
    return new Promise((resolve, reject) => {
        // Must use -ss before -i for fast seek to keyframe.
        const duration = end - start
        const args = [
            '-y',
            '-ss', start.toString(),
            '-t', duration.toString(),
            '-i', inFile,
            '-c', 'copy',
            '-an', // No Audio
            outFile
        ]
        const child = spawn(ffmpegPath, args)
        child.on('close', code => code === 0 ? resolve() : reject(new Error(`Copy failed ${code}`)))
        child.on('error', reject)
    })
}
