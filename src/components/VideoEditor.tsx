import { createSignal, onMount, onCleanup, Show } from 'solid-js'
import { RangeSlider, Segment } from './ui/RangeSlider'

interface VideoEditorProps {
    filePath: string
    onBack: () => void
    addLog: (msg: string) => void
    ffmpegStatus: { version: string; path: string } | null
}

export function VideoEditor(props: VideoEditorProps) {
    const [duration, setDuration] = createSignal<number>(30)
    const [currentTime, setCurrentTime] = createSignal<number>(0)
    const [segments, setSegments] = createSignal<Segment[]>([])
    const [selectedSegmentId, setSelectedSegmentId] = createSignal<string | null>(null)

    // Video dimension state
    const [videoDimensions, setVideoDimensions] = createSignal({ width: 0, height: 0 })

    const [bussy, setBussy] = createSignal<boolean>(false)
    const [videoRef, setVideoRef] = createSignal<HTMLVideoElement | undefined>(undefined)

    // File protocol
    const getMediaUrl = (path: string) => `file://${path}`

    const handleLoadedMetadata = (e: Event) => {
        const vid = e.target as HTMLVideoElement
        if (isFinite(vid.duration)) {
            setDuration(vid.duration)
            setVideoDimensions({ width: vid.videoWidth, height: vid.videoHeight })
            // Default: Select Initial 10% - 30%
            if (segments().length === 0) {
                const newId = crypto.randomUUID()
                const start = Math.max(vid.duration * 0.1, 0)
                const end = Math.min(vid.duration * 0.3, vid.duration)
                setSegments([{ id: newId, start, end }])
                setSelectedSegmentId(newId)
            }
        }
    }

    const handleTimeUpdate = (e: Event) => {
        const vid = e.target as HTMLVideoElement
        setCurrentTime(vid.currentTime)
    }

    const handleSeek = (time: number) => {
        const vid = videoRef()
        if (vid) {
            vid.currentTime = time
            setCurrentTime(time)
        }
    }

    // --- Segment Logic ---
    const handleSegmentChange = (id: string, start: number, end: number) => {
        setSegments(prev => prev.map(s => s.id === id ? { ...s, start, end } : s))
    }

    const handleAddSegment = (time: number, initialDuration: number = 2.0) => {
        let start = time
        let end = time + initialDuration

        const sorted = [...segments()].sort((a, b) => a.start - b.start)
        const nextSeg = sorted.find(s => s.start >= time)

        if (nextSeg) {
            // If we are about to overlap next segment
            if (end > nextSeg.start) end = nextSeg.start
            // Check if strict collision (start point inside existing segment? No, find(s.start >= time) ensures start is before nextSeg start)
            // But wait, if time is inside a segment? RangeSlider prevents clicking there usually.

            // If duration is 0 (drawing), we only care if we are literally touching the next segment start
            if (initialDuration === 0) {
                if (nextSeg.start - start < 0.01) return null // Too close
            } else {
                // For fixed duration, if it doesn't fit, we might snap or fail
                if (end - start < 0.1) {
                    if (nextSeg.start - start < 0.1) return null;
                    end = nextSeg.start
                }
            }
        }
        if (end > duration()) end = duration()

        const newId = crypto.randomUUID()
        setSegments(prev => [...prev, { id: newId, start, end }])
        setSelectedSegmentId(newId)
        return newId
    }

    const handleRemoveSegment = (id: string) => {
        // Auto-select logic: Find neighbor before removing
        const sorted = [...segments()].sort((a, b) => a.start - b.start)
        const index = sorted.findIndex(s => s.id === id)

        let nextSelectedId: string | null = null
        if (selectedSegmentId() === id && index !== -1) {
            // Try next, then prev
            if (index + 1 < sorted.length) {
                nextSelectedId = sorted[index + 1].id
            } else if (index - 1 >= 0) {
                nextSelectedId = sorted[index - 1].id
            }
        }

        setSegments(prev => prev.filter(s => s.id !== id))
        if (selectedSegmentId() === id) {
            setSelectedSegmentId(nextSelectedId)
        }
    }
    // ---------------------

    const handleExport = async () => {
        if (bussy()) return
        try {
            const currentSegments = [...segments()].sort((a, b) => a.start - b.start)
            if (currentSegments.length === 0) {
                props.addLog('Error: No segments to export')
                return
            }

            const defaultName = props.filePath.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, "") + '_cut.mov'
            const saveResult = await window.ipcRenderer.invoke('show-save-dialog', defaultName)
            if (saveResult.canceled || !saveResult.filePath) return

            setBussy(true)
            const outPath = saveResult.filePath
            props.addLog(`Exporting ${currentSegments.length} segments to ${outPath}`)

            const exportSegments = currentSegments.map(s => ({ start: s.start, end: s.end }))

            const result = await window.ipcRenderer.invoke('run-test-splice', {
                filePath: props.filePath,
                segments: exportSegments,
                outputFilePath: outPath
            })

            if (result.success) {
                props.addLog(`Success: ${result.outPath}`)
            } else {
                props.addLog(`Failed: ${result.error}`)
            }
        } catch (e: any) {
            props.addLog(`Error: ${e.message}`)
        } finally {
            setBussy(false)
        }
    }

    // Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
            e.preventDefault()
            const v = videoRef()
            if (v) v.paused ? v.play() : v.pause()
        }
        if (e.code === 'Backspace' || e.code === 'Delete') {
            if (selectedSegmentId()) handleRemoveSegment(selectedSegmentId()!)
        }
    }

    onMount(() => {
        window.addEventListener('keydown', handleKeyDown)
    })
    onCleanup(() => {
        window.removeEventListener('keydown', handleKeyDown)
    })

    return (
        <div class="video-editor-container" style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            "flex-direction": 'column',
            background: '#202020',
        }}>

            {/* Header (Gray/Title/Close/Export) */}
            <div style={{
                height: '50px',
                background: '#e0e0e0',
                display: 'flex',
                "justify-content": 'space-between',
                "align-items": 'center',
                padding: '0 15px',
                "flex-shrink": 0
            }}>
                <div style={{ display: 'flex', "align-items": 'center', gap: '15px' }}>
                    {/* Rounded Close Button */}
                    <button
                        onClick={props.onBack}
                        title="Close File"
                        style={{
                            width: '30px',
                            height: '30px',
                            "border-radius": '50%',
                            border: '1px solid #999',
                            background: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            "align-items": 'center',
                            "justify-content": 'center',
                            "padding": 0,
                            "font-size": '14px',
                            "line-height": 1,
                            color: '#333'
                        }}
                    >
                        ✕
                    </button>
                    <span style={{ "font-weight": 'bold', color: '#333' }}>
                        {props.filePath.split(/[\\/]/).pop()}
                    </span>
                </div>

                <button
                    class="btn-primary"
                    onClick={handleExport}
                    disabled={bussy()}
                    style={{ "font-size": '14px', padding: '6px 16px' }}
                >
                    {bussy() ? 'Exporting...' : 'Export'}
                </button>
            </div>

            {/* Video Preview */}
            <div style={{
                flex: 1,
                background: '#000',
                overflow: 'hidden',
                display: 'flex',
                "justify-content": 'center',
                "align-items": 'center',
                cursor: 'pointer',
                position: 'relative'
            }} onClick={(e) => {
                const v = videoRef()
                if (v) v.paused ? v.play() : v.pause()
            }}>
                <video
                    ref={setVideoRef}
                    src={getMediaUrl(props.filePath)}
                    style={{ width: '100%', height: '100%', "max-height": '100%', "object-fit": 'contain' }}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                />
            </div>

            {/* Timeline Area (Fixed Height at Bottom) */}
            <div style={{
                height: '60px', /* Matched to RangeSlider CSS */
                background: '#333',
                "flex-shrink": 0,
                display: 'flex',
                "flex-direction": 'column',
                "justify-content": 'flex-start' /* Align to top */
            }}>
                <RangeSlider
                    min={0}
                    max={duration()}
                    currentTime={currentTime()}
                    segments={segments()}
                    onChange={handleSegmentChange}
                    onSeek={handleSeek}
                    onSelectSegment={setSelectedSegmentId}
                    onAddSegment={handleAddSegment}
                    onRemoveSegment={handleRemoveSegment}
                    selectedSegmentId={selectedSegmentId()}
                />
            </div>
        </div>
    )
}
