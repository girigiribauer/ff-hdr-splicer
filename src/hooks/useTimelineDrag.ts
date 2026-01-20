import { createSignal, createEffect, onCleanup } from 'solid-js'
import { resizeSegment, findSnapTime, getTimeFromX } from '../services/timeline'
import { Segment } from '../models/Segment'

interface UseTimelineDragProps {
    min: () => number
    max: () => number
    segments: () => Segment[]
    onChange: (id: string, start: number, end: number) => void
    onSeek: (time: number) => void
    onSelectSegment: (id: string | null) => void
    trackRef: () => HTMLDivElement | undefined
}

export function useTimelineDrag(props: UseTimelineDragProps) {
    const [dragState, setDragState] = createSignal<{
        type: 'start' | 'end' | 'move' | 'scrub',
        targetId: string,
        isCreating?: boolean,
        startOffset?: number,
        originTime?: number
    } | null>(null)

    const handleScrubMove = (e: MouseEvent) => {
        const track = props.trackRef()
        if (!track) return
        const rect = track.getBoundingClientRect()

        const MIN = props.min()
        const MAX = props.max()
        const SEGS = props.segments()

        const rawTime = getTimeFromX(e.clientX, rect, MIN, MAX)

        // Candidates: 0, Max, and all segment edges
        const candidateTimes = [0, MAX]
        SEGS.forEach(s => {
            candidateTimes.push(s.start)
            candidateTimes.push(s.end)
        })

        const timeToPx = (t: number) => {
            const range = MAX - MIN
            return range === 0 ? 0 : ((t - MIN) / range) * rect.width
        }
        const currentPx = timeToPx(rawTime)

        const snaptarget = findSnapTime(currentPx, timeToPx, candidateTimes)
        const time = snaptarget !== null ? snaptarget : rawTime

        props.onSeek(time)
    }

    const handleMouseMove = (e: MouseEvent) => {
        const state = dragState()
        if (!state) return
        if (state.type === 'scrub') {
            handleScrubMove(e)
            return
        }

        const { type, targetId, isCreating, startOffset } = state
        const track = props.trackRef()
        if (!track) return
        const rect = track.getBoundingClientRect()

        const MIN = props.min()
        const MAX = props.max()
        const SEGS = props.segments()

        const rawTime = getTimeFromX(e.clientX, rect, MIN, MAX)

        const timeToPx = (t: number) => {
            const range = MAX - MIN
            return range === 0 ? 0 : ((t - MIN) / range) * rect.width
        }
        const currentPx = timeToPx(rawTime)

        // Candidates for snapping
        const candidateTimes = [MIN, MAX]
        SEGS.forEach(s => {
            if (s.id !== targetId) {
                candidateTimes.push(s.start)
                candidateTimes.push(s.end)
            }
        })

        const snapTarget = findSnapTime(currentPx, timeToPx, candidateTimes)
        const time = snapTarget !== null ? snapTarget : rawTime

        const seg = SEGS.find(s => s.id === targetId)
        if (!seg) return

        if (type === 'start') {
            const { start, end } = resizeSegment(SEGS, seg.id, time, seg.end, MAX)
            if (start !== seg.start || end !== seg.end) {
                props.onChange(seg.id, start, end)
                props.onSeek(start)
            }
        } else if (type === 'end') {
            if (isCreating && state.originTime !== undefined) {
                const origin = state.originTime
                const rawStart = Math.min(origin, time)
                const rawEnd = Math.max(origin, time)
                const { start, end } = resizeSegment(SEGS, seg.id, rawStart, rawEnd, MAX)
                if (start !== seg.start || end !== seg.end) {
                    props.onChange(seg.id, start, end)
                    props.onSeek(end)
                }
            } else {
                let targetEnd = time
                if (targetEnd < seg.start) targetEnd = seg.start
                const { end } = resizeSegment(SEGS, seg.id, seg.start, targetEnd, MAX)
                if (end !== seg.end) {
                    props.onChange(seg.id, seg.start, end)
                    props.onSeek(end)
                }
            }
        } else if (type === 'move') {
            const duration = seg.end - seg.start
            const tentativeStart = (startOffset !== undefined) ? time - startOffset : time - (duration / 2)

            const startPx = timeToPx(tentativeStart)
            const moveSnapTarget = findSnapTime(startPx, timeToPx, candidateTimes)

            let finalStart = tentativeStart
            if (moveSnapTarget !== null) {
                finalStart = moveSnapTarget
            }
            // Constraint within bounds
            finalStart = Math.max(MIN, finalStart)
            finalStart = Math.min(MAX - duration, finalStart)

            if (finalStart !== seg.start) {
                props.onChange(seg.id, finalStart, finalStart + duration)
                props.onSeek(finalStart)
            }
        }
    }

    const handleMouseUp = () => {
        setDragState(null)
    }

    createEffect(() => {
        const state = dragState()
        if (state) {
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

    // Actions
    const startScrub = () => setDragState({ type: 'scrub', targetId: 'SCRUBBER' })

    const startSegmentDrag = (id: string, startOffset: number) => {
        setDragState({ type: 'move', targetId: id, startOffset })
    }

    const startHandleDrag = (id: string, type: 'start' | 'end') => {
        setDragState({ type, targetId: id })
    }

    return {
        dragState,
        startScrub,
        startSegmentDrag,
        startHandleDrag,
        setDragState
    }
}
