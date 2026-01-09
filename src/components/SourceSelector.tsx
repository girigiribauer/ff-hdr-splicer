import { createSignal, Show } from 'solid-js'
import styles from './SourceSelector.module.css'

interface SourceSelectorProps {
    ffmpegStatus: { version: string; path: string } | null
    onLoaded: (path: string) => void
    addLog: (msg: string) => void
    error?: string
}

export function SourceSelector(props: SourceSelectorProps) {
    const [isDragging, setIsDragging] = createSignal<boolean>(false)

    const handleSelectFile = async () => {
        try {
            const result = await window.ipcRenderer.invoke('show-open-dialog')
            if (!result.canceled && result.filePaths.length > 0) {
                const path = result.filePaths[0]
                props.addLog(`File selected: ${path}`)
                props.onLoaded(path)
            }
        } catch (e: any) {
            props.addLog(`Selection Error: ${e.message}`)
        }
    }

    const onDragOver = (e: DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const onDragLeave = (e: DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }

    const onDrop = (e: DragEvent) => {
        e.preventDefault()
        setIsDragging(false)

        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0]
            const fullPath = (file as any).path
            if (fullPath) {
                props.addLog(`File dropped: ${fullPath}`)
                props.onLoaded(fullPath)
            }
        }
    }

    return (
        <div
            class={`${styles.container} ${isDragging() ? styles.dragging : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <div class={`${styles.card} ${isDragging() ? styles.cardDragging : ''}`}>
                <div class={styles.icon}>🎬</div>

                <div>
                    <h2 class={styles.title}>
                        {isDragging() ? 'Drop Video Here' : 'Select Video Source'}
                    </h2>
                    <p class={styles.subtitle}>
                        Supports HDR video files (.mov, .mp4, .mkv)
                    </p>
                </div>

                <Show when={props.error}>
                    <div class={styles.error}>
                        {props.error}
                    </div>
                </Show>

                <button
                    class={styles.button}
                    onClick={handleSelectFile}
                >
                    Choose File
                </button>

                <p class={styles.note}>
                    or drag and drop file here
                </p>
            </div>
        </div>
    )
}
