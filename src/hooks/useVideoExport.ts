import { createSignal, createComputed, onCleanup } from 'solid-js'
import { Segment } from '../models/Segment'

interface ExportOptions {
    crossfade: boolean
    fadeInOut: boolean
    fadeDuration: number
    crossfadeDuration: number
}

export function useVideoExport(addLog: (msg: string) => void) {
    const [isExporting, setIsExporting] = createSignal<boolean>(false)
    const [exportProgress, setExportProgress] = createSignal(0)

    // Setup Progress Listener
    createComputed(() => {
        const onProgress = (_: any, data: any) => setExportProgress(data.percent)
        if (window.ipcRenderer) {
            window.ipcRenderer.on('export-progress', onProgress)
            onCleanup(() => {
                if (window.ipcRenderer.off) {
                    window.ipcRenderer.off('export-progress', onProgress)
                }
            })
        }
    })

    const startExport = async (
        originalFilePath: string,
        segments: Segment[],
        fadeOptions: ExportOptions
    ) => {
        if (isExporting()) return

        try {
            const currentSegments = [...segments].sort((a, b) => a.start - b.start)
            if (currentSegments.length === 0) {
                addLog('Error: No segments to export')
                return
            }

            const fileName = originalFilePath.split(/[\\/]/).pop() || 'video'
            let defaultName = fileName.replace(/(\.[^/.]+)$/, "_cut$1")

            // If no extension found (replacement didn't happen), default to .mov
            if (defaultName === fileName) {
                defaultName = `${fileName}_cut.mov`
            }

            const saveResult = await window.ipcRenderer.invoke('show-save-dialog', defaultName)
            if (saveResult.canceled || !saveResult.filePath) return

            setIsExporting(true)
            setExportProgress(0)
            const outPath = saveResult.filePath
            addLog(`Exporting ${currentSegments.length} segments to ${outPath}`)

            const exportSegments = currentSegments.map(s => ({ start: s.start, end: s.end }))

            const result = await window.ipcRenderer.invoke('run-test-splice', {
                filePath: originalFilePath,
                segments: exportSegments,
                outputFilePath: outPath,
                fadeOptions: {
                    crossfade: fadeOptions.crossfade,
                    fadeDuration: fadeOptions.fadeInOut ? fadeOptions.fadeDuration : 0,
                    crossfadeDuration: fadeOptions.crossfade ? fadeOptions.crossfadeDuration : 0
                }
            })

            if (result.success) {
                addLog(`Success: ${result.outPath}`)
            } else {
                addLog(`Failed: ${result.error}`)
                if (result.stderr) {
                    const lines = result.stderr.split('\n')
                    const lastLines = lines.slice(-5).join('\n')
                    addLog(`FFmpeg Error Details:\n${lastLines}`)
                }
            }
        } catch (e: any) {
            addLog(`Error: ${e.message}`)
        } finally {
            setIsExporting(false)
        }
    }

    return {
        isExporting,
        exportProgress,
        startExport
    }
}
