import { Component } from 'solid-js'
import styles from './EditorHeader.module.css'

interface EditorHeaderProps {
    filePath: string
    fileMetadata: any
    isExporting: boolean
    onBack: () => void
    onExport: () => void
}

export const EditorHeader: Component<EditorHeaderProps> = (props) => {
    const handleInfoClick = async () => {
        if (!props.fileMetadata) return

        const m = props.fileMetadata
        let info = ''

        info += `File: ${props.filePath.split(/[\\/]/).pop()}\n`
        info += `Size: ${(m.format?.size / 1024 / 1024).toFixed(2)} MB\n`
        info += `Duration: ${m.format?.duration} s\n`
        info += `Bitrate: ${(m.format?.bit_rate / 1000).toFixed(0)} kbps\n\n`

        if (m.streams) {
            m.streams.forEach((s: any, i: number) => {
                info += `[Stream ${i}: ${s.codec_type}]\n`
                info += `Codec: ${s.codec_name} (${s.codec_long_name})\n`
                if (s.codec_type === 'video') {
                    info += `Resolution: ${s.width}x${s.height}\n`
                    info += `Pix Fmt: ${s.pix_fmt}\n`
                    info += `Color: ${s.color_primaries} / ${s.color_transfer} / ${s.color_space}\n`
                }
                info += `\n`
            })
        }

        await window.ipcRenderer.invoke('show-info-dialog', 'File Information', info)
    }

    return (
        <div class={styles.header}>
            <div class={styles.leftGroup}>
                <button onClick={props.onBack} class={styles.closeBtn} title="Close">✕</button>
                <div class={styles.fileName}>{props.filePath.split(/[\\/]/).pop()}</div>
                <div class={styles.fileSize}>
                    ({(props.fileMetadata?.format?.size / 1024 / 1024).toFixed(2)} MB)
                </div>
                <button
                    class={styles.infoBadge}
                    onClick={handleInfoClick}
                    title="Show Metadata"
                >
                    info
                </button>
            </div>

            <button
                onClick={props.onExport}
                class={styles.exportBtn}
                disabled={props.isExporting}
            >
                {props.isExporting ? 'exporting...' : 'export'}
            </button>
        </div>
    )
}
