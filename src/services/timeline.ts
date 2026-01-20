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
    maxDuration: number
): { start: number, end: number } | null {
    if (findOverlap(segments, time, time)) {
        return null
    }

    let start = Math.min(time, maxDuration)

    const sorted = sortSegments(segments)
    const nextSeg = sorted.find(s => s.start > time + 0.001) // Margin to avoid self-overlap issues

    // Fill to next segment or max duration
    let end = nextSeg ? nextSeg.start : maxDuration

    // Ensure we don't exceed maxDuration (redundant if nextSeg logic is correct, but safe)
    if (end > maxDuration) {
        end = maxDuration
    }

    // Minimum duration check to prevent garbage segments
    if (end - start < 0.1) {
        return null
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

// Helper to find snap target
export function findSnapTime(
    currentPx: number,
    timeToPx: (t: number) => number,
    candidates: number[],
    thresholdPx: number = 10
): number | null {
    let bestDiff = Infinity
    let snapTarget = -1

    candidates.forEach(t => {
        const px = timeToPx(t)
        const diff = Math.abs(px - currentPx)
        if (diff < thresholdPx && diff < bestDiff) {
            bestDiff = diff
            snapTarget = t
        }
    })

    return snapTarget !== -1 ? snapTarget : null
}

export function getTimeFromX(clientX: number, rect: DOMRect, min: number, max: number): number {
    const percent = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
    return min + percent * (max - min)
}
