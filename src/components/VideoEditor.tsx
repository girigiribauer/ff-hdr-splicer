import { createSignal, onMount, onCleanup } from 'solid-js'
import { RangeSlider } from './ui/RangeSlider'
import './VideoEditor.css'
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

    // Fade Options
    const [fadeOptions, setFadeOptions] = createSignal({
        crossfade: true,
        fadeDuration: 2.0,
        crossfadeDuration: 1.0
    })

    // Media protocol (See main.ts)
    const getMediaUrl = (path: string) => `media://${path}`

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
        const nextSelectedId = getNextSelectedId(segments(), id)

        setSegments(prev => prev.filter(s => s.id !== id))
        if (selectedSegmentId() === id) {
            setSelectedSegmentId(nextSelectedId)
        }
    }

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
                outputFilePath: outPath,
                fadeOptions: fadeOptions()
            })

            if (result.success) {
                props.addLog(`Success: ${result.outPath}`)
            } else {
                props.addLog(`Failed: ${result.error}`)
                if (result.stderr) {
                    console.error(result.stderr)
                    // Extract last few lines of stderr for UI log
                    const lines = result.stderr.split('\n')
                    const lastLines = lines.slice(-5).join('\n')
                    props.addLog(`FFmpeg Error Details:\n${lastLines}`)
                }
            }
        } catch (e: any) {
            props.addLog(`Error: ${e.message}`)
        } finally {
            setBussy(false)
        }
    }

    // Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
        // Prevent shortcuts when typing in inputs
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
            return
        }

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
        <div class="video-editor-container">
            <div class="video-editor-header">
                <div class="header-left">
                    <button
                        onClick={props.onBack}
                        title="Close File"
                        class="close-btn"
                    >
                        ✕
                    </button>
                    <span class="file-name">
                        {props.filePath.split(/[\\/]/).pop()}
                    </span>
                </div>

                <button
                    class="btn-primary btn-export"
                    onClick={handleExport}
                    disabled={bussy()}
                >
                    {bussy() ? 'Exporting...' : 'Export'}
                </button>
            </div>

            <div
                class="video-preview-area"
                onClick={() => {
                    const v = videoRef()
                    if (v) v.paused ? v.play() : v.pause()
                }}
            >
                <video
                    ref={setVideoRef}
                    src={getMediaUrl(props.filePath)}
                    class="preview-video"
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onError={(e) => {
                        const vid = e.target as HTMLVideoElement
                        const err = vid.error
                        props.addLog(`Video Error: ${err ? err.message : 'Unknown error'} (Code: ${err ? err.code : 'N/A'})`)
                        props.addLog(`Src: ${vid.src}`)
                        console.error('Video Error:', err)
                    }}
                />
            </div>

            <div class="timeline-area">
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
                    videoFadeDuration={fadeOptions().fadeDuration}
                />
            </div>

            <div class="footer-toolbar">
                <div class="footer-left">
                    <label class="setting-label">
                        <input
                            type="checkbox"
                            checked={fadeOptions().crossfade}
                            onChange={(e) => setFadeOptions(prev => ({ ...prev, crossfade: e.currentTarget.checked }))}
                        />
                        Enable Transitions
                    </label>

                    <div class="setting-group">
                        <span>Fade In/Out:</span>
                        <input
                            type="number"
                            min="0"
                            max="5.0"
                            step="0.1"
                            value={fadeOptions().fadeDuration}
                            onChange={(e) => setFadeOptions(prev => ({ ...prev, fadeDuration: parseFloat(e.currentTarget.value) }))}
                            class="input-number"
                        />
                        <span>s</span>
                    </div>

                    <div class="setting-group">
                        <span>Join Crossfade:</span>
                        <input
                            type="number"
                            min="0"
                            max="5.0"
                            step="0.1"
                            value={fadeOptions().crossfadeDuration}
                            onChange={(e) => setFadeOptions(prev => ({ ...prev, crossfadeDuration: parseFloat(e.currentTarget.value) }))}
                            class="input-number"
                        />
                        <span>s</span>
                    </div>
                </div>

                <div class="footer-right">
                    {selectedSegmentId() !== null ? (() => {
                        const seg = segments().find(s => s.id === selectedSegmentId())
                        if (!seg) return <span class="no-selection">Segment not found</span>
                        return (
                            <>
                                <span class="selected-label">Selected:</span>
                                <div class="segment-editor-group">
                                    <label>Start:</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={seg.start.toFixed(3)}
                                        onChange={(e) => {
                                            const val = parseFloat(e.currentTarget.value)
                                            if (!isNaN(val) && val >= 0 && val < seg.end) {
                                                setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, start: val } : s))
                                            }
                                        }}
                                        class="input-coord"
                                    />
                                </div>
                                <div class="segment-editor-group">
                                    <label>End:</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={seg.end.toFixed(3)}
                                        onChange={(e) => {
                                            const val = parseFloat(e.currentTarget.value)
                                            if (!isNaN(val) && val > seg.start) {
                                                setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, end: val } : s))
                                            }
                                        }}
                                        class="input-coord"
                                    />
                                </div>
                                <div class="duration-display">
                                    ({(seg.end - seg.start).toFixed(2)}s)
                                </div>
                            </>
                        )
                    })() : (
                        <span class="no-selection">Select a segment to edit</span>
                    )}
                </div>
            </div>
        </div>
    )
}
