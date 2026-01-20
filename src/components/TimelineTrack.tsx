import { createMemo, For, Show } from 'solid-js'
import styles from './TimelineTrack.module.css'
import { Segment } from '../models/Segment'
import { useTimelineDrag } from '../hooks/useTimelineDrag'
import { getTimeFromX } from '../services/timeline'

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

    const {
        startScrub,
        startSegmentDrag,
        startHandleDrag
    } = useTimelineDrag({
        min: () => props.min,
        max: () => props.max,
        segments: () => props.segments,
        onChange: props.onChange,
        onSeek: props.onSeek,
        onSelectSegment: props.onSelectSegment,
        trackRef: () => trackRef
    })

    const getPercent = (value: number) => {
        if (props.max - props.min === 0) return 0
        return ((value - props.min) / (props.max - props.min)) * 100
    }

    const handleTrackMouseDown = (e: MouseEvent) => {
        e.preventDefault()
        if (!trackRef) {
            console.warn('[TimelineTrack] handleTrackMouseDown - NO TRACK REF')
            return
        }
        const rect = trackRef.getBoundingClientRect()
        const time = getTimeFromX(e.clientX, rect, props.min, props.max)
        props.onSeek(time)
        props.onSelectSegment(null)
        startScrub()
    }

    const handleSegmentMouseDown = (e: MouseEvent, id: string) => {
        e.preventDefault()
        e.stopPropagation()
        if (!trackRef) return

        const rect = trackRef.getBoundingClientRect()
        const clickTime = getTimeFromX(e.clientX, rect, props.min, props.max)
        const seg = props.segments.find(s => s.id === id)
        const startOffset = seg ? clickTime - seg.start : 0

        props.onSeek(clickTime)
        props.onSelectSegment(id)
        startSegmentDrag(id, startOffset)
    }

    const handleHandleMouseDown = (e: MouseEvent, type: 'start' | 'end', id: string) => {
        e.preventDefault()
        e.stopPropagation()
        props.onSelectSegment(id)
        startHandleDrag(id, type)
    }

    const getSortedSegments = createMemo(() => [...props.segments].sort((a, b) => a.start - b.start))

    return (
        <div class={styles.timelineTrackContainer} ref={el => trackRef = el} onMouseDown={handleTrackMouseDown}>
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
