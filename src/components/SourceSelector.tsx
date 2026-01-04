import { createSignal } from 'solid-js'

interface SourceSelectorProps {
    ffmpegStatus: { version: string; path: string } | null
    onLoaded: (path: string) => void
    addLog: (msg: string) => void
}

export function SourceSelector(props: SourceSelectorProps) {
    const [isDragging, setIsDragging] = createSignal<boolean>(false)

    // Handlers
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

    // Drag & Drop Handlers
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
            class="source-selector"
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                "flex-direction": 'column',
                "justify-content": 'center',
                "align-items": 'center',
                background: isDragging() ? '#e6f7ff' : '#fafafa',
                transition: 'background 0.2s'
            }}
        >
            <div class="card" style={{
                width: '100%',
                "max-width": '500px',
                padding: '50px',
                background: 'white',
                "border-radius": '16px',
                "box-shadow": '0 10px 30px rgba(0,0,0,0.08)',
                "text-align": 'center',
                border: isDragging() ? '2px dashed #007AFF' : '1px solid #eee',
                display: 'flex',
                "flex-direction": 'column',
                "align-items": 'center',
                gap: '20px'
            }}>
                <div style={{ "font-size": '48px', opacity: 0.5 }}>📂</div>

                <div>
                    <h2 style={{ "margin-top": 0, "margin-bottom": '10px', color: '#333' }}>
                        {isDragging() ? 'Drop Video Here' : 'Select Video Source'}
                    </h2>
                    <p style={{ margin: 0, color: '#888', "font-size": '14px' }}>
                        Supports HDR video files (.mov, .mp4, .mkv)
                    </p>
                </div>

                <button
                    class="btn-primary"
                    onClick={handleSelectFile}
                    style={{
                        padding: '12px 30px',
                        "font-size": '16px',
                        "margin-top": '10px'
                    }}
                >
                    Choose File
                </button>

                <p style={{ "font-size": '12px', color: '#aaa', "margin-top": '20px' }}>
                    or drag and drop file here
                </p>
            </div>
        </div>
    )
}
