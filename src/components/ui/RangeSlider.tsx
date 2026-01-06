import { createSignal, createEffect, onCleanup, For, Show } from 'solid-js'
import './RangeSlider.css'
import { resizeSegment } from '../../services/timeline'
import { Segment } from '../../models/Segment'

interface RangeSliderProps {
    min: number
    max: number
    segments: Segment[]
    currentTime: number
    onChange: (id: string, start: number, end: number) => void
    onSeek: (time: number) => void
    onSelectSegment: (id: string | null) => void
    onAddSegment: (time: number, initialDuration?: number) => string | null
    onRemoveSegment: (id: string) => void
    selectedSegmentId: string | null
    // Visual flags for first/last segment fades
    videoFadeDuration: number
}

export function RangeSlider(props: RangeSliderProps) {
    let seekRef: HTMLDivElement | undefined
    let clipRef: HTMLDivElement | undefined

    const [dragState, setDragState] = createSignal<{ type: 'playhead' | 'start' | 'end' | 'move', targetId?: string, isCreating?: boolean } | null>(null)

    const getPercent = (value: number) => {
        if (props.max - props.min === 0) return 0
        return ((value - props.min) / (props.max - props.min)) * 100
    }

    const getTimeFromX = (clientX: number, rect: DOMRect) => {
        const percent = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
        return props.min + percent * (props.max - props.min)
    }

    // --- Seek Track Handlers ---
    const handleSeekMouseDown = (e: MouseEvent) => {
        if (!seekRef) return
        e.preventDefault()
        const time = getTimeFromX(e.clientX, seekRef.getBoundingClientRect())
        props.onSeek(time)
        setDragState({ type: 'playhead' })
    }

    // --- Clip Track Handlers ---
    const handleClipTrackMouseDown = (e: MouseEvent) => {
        if (!seekRef) return
        const time = getTimeFromX(e.clientX, seekRef.getBoundingClientRect())
        const newId = props.onAddSegment(time, 0)
        if (newId) {
            setDragState({ type: 'end', targetId: newId, isCreating: true })
        }
    }

    const handleSegmentMouseDown = (e: MouseEvent, id: string) => {
        e.stopPropagation()
        props.onSelectSegment(id)
        setDragState({ type: 'move', targetId: id })
    }

    const handleHandleMouseDown = (e: MouseEvent, type: 'start' | 'end', id: string) => {
        e.stopPropagation()
        props.onSelectSegment(id)
        setDragState({ type, targetId: id })
    }

    const handleMouseMove = (e: MouseEvent) => {
        if (!dragState()) return
        const { type, targetId, isCreating } = dragState()!
        if (!seekRef) return
        const rect = seekRef.getBoundingClientRect()
        const time = getTimeFromX(e.clientX, rect)

        if (type === 'playhead') {
            props.onSeek(time)
            return
        }

        if (!targetId) return
        const seg = props.segments.find(s => s.id === targetId)
        if (!seg) return

        if (type === 'start') {
            const { start } = resizeSegment(props.segments, seg.id, time, seg.end, props.max)
            if (start !== seg.start) props.onChange(seg.id, start, seg.end)
        } else if (type === 'end') {
            let targetEnd = time
            if (isCreating && targetEnd < seg.start) targetEnd = seg.start
            const { end } = resizeSegment(props.segments, seg.id, seg.start, targetEnd, props.max)
            if (end !== seg.end) props.onChange(seg.id, seg.start, end)
        } else if (type === 'move') {
            const duration = seg.end - seg.start
            let newStart = time - (duration / 2)
            let newEnd = newStart + duration
            const sorted = [...props.segments].sort((a, b) => a.start - b.start)
            const index = sorted.findIndex(s => s.id === targetId)
            const prevSeg = index > 0 ? sorted[index - 1] : null
            const nextSeg = index < sorted.length - 1 ? sorted[index + 1] : null
            const minTime = prevSeg ? prevSeg.end : props.min
            const maxTime = nextSeg ? nextSeg.start : props.max

            if (newStart < minTime) { newStart = minTime; newEnd = newStart + duration; }
            if (newEnd > maxTime) { newEnd = maxTime; newStart = newEnd - duration; }

            if (newStart !== seg.start) props.onChange(seg.id, newStart, newEnd)
        }
    }

    const handleMouseUp = () => {
        const state = dragState()
        if (state && state.isCreating && state.targetId) {
            const seg = props.segments.find(s => s.id === state.targetId)
            if (seg && (seg.end - seg.start < 0.5)) {
                const sorted = [...props.segments].sort((a, b) => a.start - b.start)
                const index = sorted.findIndex(s => s.id === state.targetId)
                const nextSeg = index < sorted.length - 1 ? sorted[index + 1] : null
                const maxTime = nextSeg ? nextSeg.start : props.max
                let newEnd = seg.start + 2.0
                if (newEnd > maxTime) newEnd = maxTime
                props.onChange(seg.id, seg.start, newEnd)
            }
        }
        setDragState(null)
    }

    createEffect(() => {
        if (dragState()) {
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
        } else {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    })

    onCleanup(() => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
    })

    // Helper to check if segment is first/last for visuals
    const getSortedSegments = () => [...props.segments].sort((a, b) => a.start - b.start)

    return (
        <div class="range-slider-container">
            <div class="seek-track-area" ref={seekRef} onMouseDown={handleSeekMouseDown}>
                <div class="seek-track-line" />
                <div class="seek-playhead-knob" style={{ left: `${getPercent(props.currentTime)}% ` }} />
            </div>

            <div class="clip-track-area" ref={clipRef} onMouseDown={handleClipTrackMouseDown}>
                <For each={props.segments}>
                    {(segment) => {
                        const sorted = getSortedSegments()
                        const index = sorted.findIndex(s => s.id === segment.id)
                        const isFirst = index === 0
                        const isLast = index === sorted.length - 1

                        // Visualizing logic:
                        // First segment gets visual FadeIn if configured.
                        // Last segment gets visual FadeOut if configured.
                        // Middle segments get Crossfade logic? (Not implemented in UI yet, simplifying)

                        return (
                            <div
                                class={`range-segment ${props.selectedSegmentId === segment.id ? 'selected' : ''}`}
                                style={{
                                    left: `${getPercent(segment.start)}% `,
                                    width: `${getPercent(segment.end) - getPercent(segment.start)}% `
                                }}
                                onMouseDown={(e) => handleSegmentMouseDown(e, segment.id)}
                            >
                                {/* Fade Overlays (Purely Visual) */}
                                <Show when={isFirst && props.videoFadeDuration > 0}>
                                    <div class="fade-overlay fade-in-overlay" />
                                </Show>
                                <Show when={isLast && props.videoFadeDuration > 0}>
                                    <div class="fade-overlay fade-out-overlay" />
                                </Show>

                                <div class="segment-handle left-handle" onMouseDown={(e) => handleHandleMouseDown(e, 'start', segment.id)} />
                                <div class="segment-handle right-handle" onMouseDown={(e) => handleHandleMouseDown(e, 'end', segment.id)} />

                                <Show when={props.selectedSegmentId === segment.id}>
                                    <div
                                        class="segment-remove-btn"
                                        onMouseDown={(e) => {
                                            e.stopPropagation()
                                            props.onRemoveSegment(segment.id)
                                        }}
                                        title="Remove Clip"
                                    >
                                        ×
                                    </div>
                                </Show>
                            </div>
                        )
                    }}
                </For>
            </div>
        </div>
    )
}
