import { createSignal, onMount, onCleanup } from 'solid-js'
import { RangeSlider } from './ui/RangeSlider'
import { Segment } from '../models/Segment'
import { createSegmentSpecs, getNextSelectedId } from '../services/timeline'

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
    const [bussy, setBussy] = createSignal<boolean>(false)
    const [videoRef, setVideoRef] = createSignal<HTMLVideoElement | undefined>(undefined)

    // File protocol
    const getMediaUrl = (path: string) => `file://${path}`

    const handleLoadedMetadata = (e: Event) => {
        const vid = e.target as HTMLVideoElement
        if (isFinite(vid.duration)) {
            setDuration(vid.duration)
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

    let animationFrameId: number

    const loop = () => {
        const vid = videoRef()
        if (vid && !vid.paused && !vid.ended) {
            setCurrentTime(vid.currentTime)
            animationFrameId = requestAnimationFrame(loop)
        }
    }

    const handlePlay = () => {
        loop()
    }

    const handlePause = () => {
        cancelAnimationFrame(animationFrameId)
    }

    onCleanup(() => {
        cancelAnimationFrame(animationFrameId)
    })

    const handleTimeUpdate = (e: Event) => {
        const vid = e.target as HTMLVideoElement
        // Only update if not playing to avoid conflict/double updates,
        // though Solid's batching usually handles it.
        // But mainly we trust rAF during playback.
        if (vid.paused) {
            setCurrentTime(vid.currentTime)
        }
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
        const specs = createSegmentSpecs(segments(), time, initialDuration, duration())
        if (!specs) return null

        const newId = crypto.randomUUID()
        setSegments(prev => [...prev, { id: newId, ...specs }])
        setSelectedSegmentId(newId)
        return newId
    }

    const handleRemoveSegment = (id: string) => {
        // Auto-select logic
        const nextSelectedId = getNextSelectedId(segments(), id)

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
            }} onClick={() => {
                const v = videoRef()
                if (v) v.paused ? v.play() : v.pause()
            }}>
                <video
                    ref={setVideoRef}
                    src={getMediaUrl(props.filePath)}
                    style={{ width: '100%', height: '100%', "max-height": '100%', "object-fit": 'contain' }}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={handlePlay}
                    onPause={handlePause}
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
