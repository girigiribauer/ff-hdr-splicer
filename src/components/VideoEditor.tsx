import { createSignal, onMount, onCleanup, Show } from 'solid-js'
import { SeekBar } from './SeekBar'
import { TimelineTrack } from './TimelineTrack'
import { Segment } from '../models/Segment'
import { createSegmentSpecs, getNextSelectedId } from '../services/timeline'
import { EditorHeader } from './EditorHeader'
import { VideoPreview } from './VideoPreview'
import { PlayControls } from './PlayControls'
import { FadeInControl } from './FadeInControl'
import { CrossFadeControl } from './CrossFadeControl'
import { SegmentEditor } from './SegmentEditor'
import { DurationDisplay } from './DurationDisplay'
import { ProgressOverlay } from './ProgressOverlay'
import { useProxyGenerator } from '../hooks/useProxyGenerator'
import { useVideoExport } from '../hooks/useVideoExport'
import { toMediaUrl } from '../utils/MediaUrlUtils'
import styles from './VideoEditor.module.css'

interface VideoEditorProps {
    filePath: string
    fileMetadata: any
    onBack: () => void
    addLog: (msg: string) => void
    ffmpegStatus: { version: string; path: string } | null
}

export function VideoEditor(props: VideoEditorProps) {
    const [duration, setDuration] = createSignal<number>(30)
    const [currentTime, setCurrentTime] = createSignal<number>(0)
    const [segments, setSegments] = createSignal<Segment[]>([])
    const [selectedSegmentId, setSelectedSegmentId] = createSignal<string | null>(null)
    const [videoRef, setVideoRef] = createSignal<HTMLVideoElement | undefined>(undefined)

    // Fade Options
    const [fadeOptions, setFadeOptions] = createSignal({
        fadeInOut: true,
        crossfade: false,
        fadeDuration: 1.5,
        crossfadeDuration: 0.5
    })

    // Custom Hooks
    const { proxyPath, isMakingProxy, proxyProgress } = useProxyGenerator(
        () => props.filePath,
        props.addLog
    )

    const { isExporting, exportProgress, startExport } = useVideoExport(props.addLog)

    const getMediaUrl = (path: string) => toMediaUrl(path, proxyPath())

    const handleVideoError = (e: Event) => {
        const vid = e.target as HTMLVideoElement
        const err = vid.error
        props.addLog(`[DEBUG] Video Error: Code=${err?.code}, Msg=${err?.message}`)
        props.addLog(`[DEBUG] Src: ${vid.src}`)
        props.addLog(`[DEBUG] NetworkState: ${vid.networkState}, ReadyState: ${vid.readyState}`)
    }

    const handleLoadedMetadata = (e: Event) => {
        const vid = e.target as HTMLVideoElement
        if (isFinite(vid.duration)) {
            setDuration(vid.duration)
            if (segments().length === 0) {
                const newId = crypto.randomUUID()
                const start = 0
                const end = vid.duration
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

    const handlePlay = () => loop()
    const handlePause = () => cancelAnimationFrame(animationFrameId)
    onCleanup(() => cancelAnimationFrame(animationFrameId))

    const handleTimeUpdate = (e: Event) => {
        const vid = e.target as HTMLVideoElement
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

    const handleSplitOrAddSegment = () => {
        const time = currentTime()
        const currentSeg = segments().find(s => time > s.start && time < s.end)

        if (currentSeg) {
            const newId1 = crypto.randomUUID()
            const newId2 = crypto.randomUUID()
            const seg1: Segment = { id: newId1, start: currentSeg.start, end: time }
            const seg2: Segment = { id: newId2, start: time, end: currentSeg.end }

            setSegments(prev => {
                const filtered = prev.filter(s => s.id !== currentSeg.id)
                return [...filtered, seg1, seg2]
            })
            setSelectedSegmentId(newId2)
            props.addLog(`Split segment at ${time.toFixed(3)}s`)
        } else {
            const newId = handleAddSegment(time)
            if (newId) {
                props.addLog(`Added segment at ${time.toFixed(3)}s`)
            } else {
                props.addLog('Could not add segment (Overlap or too short)')
            }
        }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

        if (e.code === 'Space') {
            e.preventDefault()
            const v = videoRef()
            if (v) v.paused ? v.play() : v.pause()
        }
        if (e.code === 'Backspace' || e.code === 'Delete') {
            if (selectedSegmentId()) handleRemoveSegment(selectedSegmentId()!)
        }
        if (e.code === 'KeyS') {
            e.preventDefault()
            handleSplitOrAddSegment()
        }
    }

    onMount(() => {
        window.addEventListener('keydown', handleKeyDown)
        onCleanup(() => {
            window.removeEventListener('keydown', handleKeyDown)
        })
    })

    // Determine current segment for editor
    const currentSegment = () => segments().find(s => s.id === selectedSegmentId())

    return (
        <div class={styles.videoEditorContainer}>
            <EditorHeader
                filePath={props.filePath}
                fileMetadata={props.fileMetadata}
                isExporting={isExporting()}
                onBack={props.onBack}
                onExport={() => {
                    const v = videoRef()
                    if (v && !v.paused) v.pause()
                    startExport(props.filePath, segments(), fadeOptions())
                }}
            />

            <VideoPreview
                src={getMediaUrl(props.filePath)}
                videoRef={setVideoRef}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onPlay={handlePlay}
                onPause={handlePause}
                onError={handleVideoError}
                onClick={() => {
                    const v = videoRef()
                    if (v) v.paused ? v.play() : v.pause()
                }}
            />

            <div class={styles.editorGrid}>
                <div style={{ "grid-area": "1 / 1 / 2 / 3" }}>
                    <PlayControls
                        isPlaying={!videoRef()?.paused}
                        onTogglePlay={() => { const v = videoRef(); if (v) v.paused ? v.play() : v.pause() }}
                        currentTime={currentTime()}
                        onTimeChange={handleSeek}
                    />
                </div>

                <div style={{ "grid-area": "1 / 3 / 2 / 4" }}>
                    <SeekBar
                        min={0}
                        max={duration()}
                        currentTime={currentTime()}
                        onSeek={handleSeek}
                    />
                </div>

                <div style={{ "grid-area": "1 / 4 / 2 / 5" }}>
                    <DurationDisplay duration={duration()} />
                </div>

                <div style={{ "grid-area": "2 / 1 / 3 / 2" }}>
                    <FadeInControl
                        active={fadeOptions().fadeInOut}
                        duration={fadeOptions().fadeDuration}
                        onToggle={() => setFadeOptions(p => ({ ...p, fadeInOut: !p.fadeInOut }))}
                        onDurationChange={(d) => setFadeOptions(p => ({ ...p, fadeDuration: d }))}
                    />
                </div>

                <div style={{ "grid-area": "3 / 1 / 4 / 2" }}>
                    <CrossFadeControl
                        active={fadeOptions().crossfade}
                        duration={fadeOptions().crossfadeDuration}
                        onToggle={() => setFadeOptions(p => ({ ...p, crossfade: !p.crossfade }))}
                        onDurationChange={(d) => setFadeOptions(p => ({ ...p, crossfadeDuration: d }))}
                    />
                </div>

                <div class={styles.splitControlContainer}>
                    <button
                        class={styles.splitBtn}
                        onClick={handleSplitOrAddSegment}
                        title="Split Segment at Playhead"
                    >
                        <img src="addSegment.svg" class={styles.splitIcon} />
                    </button>
                </div>

                <div style={{ "grid-area": "2 / 3 / 4 / 4", "position": "relative" }}>
                    <TimelineTrack
                        min={0}
                        max={duration()}
                        segments={segments()}
                        selectedSegmentId={selectedSegmentId()}
                        enableFadeIn={fadeOptions().fadeInOut}
                        enableFadeOut={fadeOptions().fadeInOut}
                        enableCrossfade={fadeOptions().crossfade}
                        onChange={handleSegmentChange}
                        onSelectSegment={setSelectedSegmentId}
                        onAddSegment={handleAddSegment}
                        onRemoveSegment={handleRemoveSegment}
                        onSeek={handleSeek}
                    />
                </div>

                <div class={styles.segmentEditorContainer}>
                    <Show when={currentSegment()} fallback={<div class={styles.noSegmentMessage}>No segment selected</div>}>
                        <SegmentEditor
                            segment={currentSegment()!}
                            onUpdate={(start, end) => {
                                const seg = currentSegment()
                                if (seg) handleSegmentChange(seg.id, start, end)
                            }}
                            onDelete={() => {
                                const seg = currentSegment()
                                if (seg) handleRemoveSegment(seg.id)
                            }}
                        />
                    </Show>
                </div>
            </div>

            <ProgressOverlay
                isVisible={isExporting()}
                message="Exporting..."
                progress={exportProgress()}
                color="green"
            />

            <ProgressOverlay
                isVisible={isMakingProxy()}
                message="Generating Preview Proxy..."
                subMessage="(Optimization for smooth playback)"
                progress={proxyProgress()}
                color="blue"
            />
        </div >
    )
}
