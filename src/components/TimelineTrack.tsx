import { createSignal, createEffect, onCleanup, For, Show, createMemo } from 'solid-js'
import styles from './TimelineTrack.module.css'
import { resizeSegment } from '../services/timeline'
import { Segment } from '../models/Segment'

interface TimelineTrackProps {
    min: number
    max: number
    segments: Segment[]
    onChange: (id: string, start: number, end: number) => void
    onSelectSegment: (id: string | null) => void
    onAddSegment: (time: number, initialDuration?: number) => string | null
    onRemoveSegment: (id: string) => void
    selectedSegmentId: string | null
    enableFadeIn: boolean
    enableFadeOut: boolean
    enableCrossfade: boolean
    onSeek: (time: number) => void
}

export function TimelineTrack(props: TimelineTrackProps) {
    let trackRef: HTMLDivElement | undefined
    const [dragState, setDragState] = createSignal<{
        type: 'start' | 'end' | 'move',
        targetId: string,
        isCreating?: boolean,
        startOffset?: number,
        originTime?: number
    } | null>(null)

    const getPercent = (value: number) => {
        if (props.max - props.min === 0) return 0
        return ((value - props.min) / (props.max - props.min)) * 100
    }

    const getTimeFromX = (clientX: number, rect: DOMRect) => {
        const percent = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
        return props.min + percent * (props.max - props.min)
    }

    const handleTrackMouseDown = (e: MouseEvent) => {
        if (!trackRef) return
        const time = getTimeFromX(e.clientX, trackRef.getBoundingClientRect())
        // Unify UX: Click on empty space also Seeks (creates consistency)
        // User uses (+) button or 'S' key to add segments now.
        props.onSeek(time)
        props.onSelectSegment(null) // Deselect any active segment

        // Enable Scrubbing (Drag to Seek)
        setDragState({ type: 'move', targetId: 'SCRUBBER' })
        window.addEventListener('mousemove', handleScrubMove)
        window.addEventListener('mouseup', handleScrubUp)
    }

    const handleScrubMove = (e: MouseEvent) => {
        if (!trackRef) return
        const time = getTimeFromX(e.clientX, trackRef.getBoundingClientRect())
        props.onSeek(time)
    }

    const handleScrubUp = () => {
        window.removeEventListener('mousemove', handleScrubMove)
        window.removeEventListener('mouseup', handleScrubUp)
        setDragState(null)
    }

    const handleSegmentMouseDown = (e: MouseEvent, id: string) => {
        e.stopPropagation()
        if (!trackRef) return

        const rect = trackRef.getBoundingClientRect()
        const clickTime = getTimeFromX(e.clientX, rect)
        const seg = props.segments.find(s => s.id === id)
        const startOffset = seg ? clickTime - seg.start : 0

        props.onSeek(clickTime)

        props.onSelectSegment(id)
        setDragState({ type: 'move', targetId: id, startOffset })
    }

    const handleHandleMouseDown = (e: MouseEvent, type: 'start' | 'end', id: string) => {
        e.stopPropagation()
        props.onSelectSegment(id)
        setDragState({ type, targetId: id })
    }

    const handleMouseMove = (e: MouseEvent) => {
        if (!dragState()) return
        const { type, targetId, isCreating, startOffset } = dragState()!
        if (!trackRef) return
        const rect = trackRef.getBoundingClientRect()
        const time = getTimeFromX(e.clientX, rect)

        const seg = props.segments.find(s => s.id === targetId)
        if (!seg) return

        if (type === 'start') {
            const { start } = resizeSegment(props.segments, seg.id, time, seg.end, props.max)
            if (start !== seg.start) {
                props.onChange(seg.id, start, seg.end)
                props.onSeek(start) // Update playhead to new start
            }
        } else if (type === 'end') {
            if (isCreating && dragState()?.originTime !== undefined) {
                const origin = dragState()!.originTime!
                // Bi-directional creation logic
                const rawStart = Math.min(origin, time)
                const rawEnd = Math.max(origin, time)

                // Validate constraints using resizeSegment
                const { start, end } = resizeSegment(props.segments, seg.id, rawStart, rawEnd, props.max)

                if (start !== seg.start || end !== seg.end) {
                    props.onChange(seg.id, start, end)
                    props.onSeek(end) // Update playhead to new end (or valid end)
                }
            } else {
                // Normal resizing logic (end handle only)
                let targetEnd = time
                // Prevent dragging end handle before start
                if (targetEnd < seg.start) targetEnd = seg.start
                const { end } = resizeSegment(props.segments, seg.id, seg.start, targetEnd, props.max)
                if (end !== seg.end) {
                    props.onChange(seg.id, seg.start, end)
                    props.onSeek(end) // Update playhead to new end
                }
            }
        } else if (type === 'move') {
            const duration = seg.end - seg.start
            // Use offset if available, otherwise fallback to center (though offset should always be set for move)
            let newStart = (startOffset !== undefined) ? time - startOffset : time - (duration / 2)
            let newEnd = newStart + duration
            const sorted = [...props.segments].sort((a, b) => a.start - b.start)
            const index = sorted.findIndex(s => s.id === targetId)
            const prevSeg = index > 0 ? sorted[index - 1] : null
            const nextSeg = index < sorted.length - 1 ? sorted[index + 1] : null
            const minTime = prevSeg ? prevSeg.end : props.min
            const maxTime = nextSeg ? nextSeg.start : props.max

            if (newStart < minTime) { newStart = minTime; newEnd = newStart + duration; }
            if (newEnd > maxTime) { newEnd = maxTime; newStart = newEnd - duration; }

            if (newStart !== seg.start) {
                props.onChange(seg.id, newStart, newEnd)
                props.onSeek(newStart) // Focus on start time while moving? Or maybe keep relative?
                // For moving, seeing the start frame is usually most useful.
            }
        }
    }

    const handleMouseUp = () => {
        const state = dragState()
        if (state && state.isCreating && state.targetId) {
            const seg = props.segments.find(s => s.id === state.targetId)
            if (seg && (seg.end - seg.start < 0.5)) {
                // Enforce min duration on creation
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

    const getSortedSegments = createMemo(() => [...props.segments].sort((a, b) => a.start - b.start))

    return (
        <div class={styles.timelineTrackContainer} ref={trackRef} onMouseDown={handleTrackMouseDown}>
            <For each={props.segments}>
                {(segment) => {
                    const isFirst = () => {
                        const sorted = getSortedSegments()
                        return sorted.length > 0 && sorted[0].id === segment.id
                    }
                    const isLast = () => {
                        const sorted = getSortedSegments()
                        return sorted.length > 0 && sorted[sorted.length - 1].id === segment.id
                    }

                    return (
                        <div
                            class={`${styles.rangeSegment} ${props.selectedSegmentId === segment.id ? styles.selected : ''}`}
                            style={{
                                left: `${getPercent(segment.start)}% `,
                                width: `${getPercent(segment.end) - getPercent(segment.start)}% `
                            }}
                            onMouseDown={(e) => handleSegmentMouseDown(e, segment.id)}
                        >
                            {/* Start Icon: FadeIn (First) OR Crossfade (Not First) */}
                            <Show when={isFirst()}>
                                <Show when={props.enableFadeIn}>
                                    <div class={`${styles.fadeOverlay} ${styles.fadeInOverlay}`} />
                                    <img src="fadeInOut.svg" class={`${styles.segmentIcon} ${styles.bottomLeft}`} alt="Fade In" />
                                </Show>
                            </Show>
                            <Show when={!isFirst() && props.enableCrossfade}>
                                <img src="crossFade.svg" class={`${styles.segmentIcon} ${styles.bottomLeftCross}`} alt="Crossfade Start" />
                            </Show>

                            {/* End Icon: FadeOut (Last) OR Crossfade (Not Last) */}
                            <Show when={isLast()}>
                                <Show when={props.enableFadeOut}>
                                    <div class={`${styles.fadeOverlay} ${styles.fadeOutOverlay}`} />
                                    <img src="fadeInOut.svg" class={`${styles.segmentIcon} ${styles.bottomRight}`} alt="Fade Out" />
                                </Show>
                            </Show>
                            <Show when={!isLast() && props.enableCrossfade}>
                                <img src="crossFade.svg" class={`${styles.segmentIcon} ${styles.bottomRightCross}`} alt="Crossfade End" />
                            </Show>

                            <div class={`${styles.segmentHandle} ${styles.leftHandle}`} onMouseDown={(e) => handleHandleMouseDown(e, 'start', segment.id)} />
                            <div class={`${styles.segmentHandle} ${styles.rightHandle}`} onMouseDown={(e) => handleHandleMouseDown(e, 'end', segment.id)} />
                        </div>
                    )
                }}
            </For>
        </div>
    )
}
