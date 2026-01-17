import { Segment } from '../models/Segment'

export function validateSegment(seg: Segment, maxDuration: number): Segment {
    let { start, end } = seg
    start = Math.max(0, start)
    end = Math.min(maxDuration, end)
    if (start >= end) {
        end = start
    }
    return { ...seg, start, end }
}

export function sortSegments(segments: Segment[]): Segment[] {
    return [...segments].sort((a, b) => a.start - b.start)
}

export function findOverlap(
    segments: Segment[],
    start: number,
    end: number,
    excludeId?: string
): Segment | undefined {
    const margin = 0.001
    return segments.find(s => {
        if (s.id === excludeId) return false
        return (start < s.end - margin) && (end > s.start + margin)
    })
}

export function createSegmentSpecs(
    segments: Segment[],
    time: number,
    duration: number,
    maxDuration: number
): { start: number, end: number } | null {
    if (findOverlap(segments, time, time)) {
        return null
    }

    let start = time

    const sorted = sortSegments(segments)
    const nextSeg = sorted.find(s => s.start > time + 0.001) // Margin to avoid self-overlap issues

    // Fill to next segment or max duration
    let end = nextSeg ? nextSeg.start : maxDuration

    // Previous implementation used fixed duration, now we fill available space.
    // However, if the gap is extremely small, we might want to return null?
    // User requested "expand as much as possible".
    // If end - start is very small (e.g. < 0.1s), the UI usually handles it (or it's just a tiny segment).

    // Ensure we don't exceed maxDuration (redundant if nextSeg logic is correct, but safe)
    if (end > maxDuration) {
        end = maxDuration
    }

    return { start, end }
}

export function resizeSegment(
    segments: Segment[],
    id: string,
    newStart: number,
    newEnd: number,
    maxDuration: number
): { start: number, end: number } {
    const current = segments.find(s => s.id === id)
    if (!current) return { start: newStart, end: newEnd }

    const sorted = sortSegments(segments)
    const index = sorted.findIndex(s => s.id === id)

    const prevSeg = index > 0 ? sorted[index - 1] : null
    const nextSeg = index < sorted.length - 1 ? sorted[index + 1] : null

    const minTime = prevSeg ? prevSeg.end : 0
    const maxTime = nextSeg ? nextSeg.start : maxDuration

    let s = Math.max(minTime, newStart)
    let e = Math.min(maxTime, newEnd)

    if (e < s + 0.1) {
        e = Math.max(s + 0.1, e)
    }

    return { start: s, end: e }
}

export function getNextSelectedId(segments: Segment[], deletedId: string): string | null {
    const sorted = sortSegments(segments)
    const index = sorted.findIndex(s => s.id === deletedId)

    if (index === -1) return null

    if (index + 1 < sorted.length) {
        return sorted[index + 1].id
    }
    if (index - 1 >= 0) {
        return sorted[index - 1].id
    }

    return null
}
