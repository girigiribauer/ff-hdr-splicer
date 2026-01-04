import { Segment } from '../models/Segment'

// Ensure segment is valid (start < end, within bounds)
export function validateSegment(seg: Segment, maxDuration: number): Segment {
    let { start, end } = seg
    start = Math.max(0, start)
    end = Math.min(maxDuration, end)
    if (start >= end) {
        // Fallback for invalid: make it min length or clamp
        // Logic: if start pushed past end, reset start?
        // Or if end pushed before start, reset end?
        // Simple: if invalid, keep 0 length at start
        end = start
    }
    return { ...seg, start, end }
}

export function sortSegments(segments: Segment[]): Segment[] {
    return [...segments].sort((a, b) => a.start - b.start)
}

// Find if a time range overlaps with any existing segments (excluding a specific ID)
export function findOverlap(
    segments: Segment[],
    start: number,
    end: number,
    excludeId?: string
): Segment | undefined {
    // 0.01 margin for float precision
    const margin = 0.001
    return segments.find(s => {
        if (s.id === excludeId) return false
        // Overlap logic: (StartA < EndB) and (EndA > StartB)
        // With strict exclusion: use margin
        return (start < s.end - margin) && (end > s.start + margin)
    })
}

// Calculate valid new Segment for creation
// Returns null if start point is invalid (inside another).
// Clamps 'end' if it hits another segment.
export function createSegmentSpecs(
    segments: Segment[],
    time: number,
    duration: number, // 0 for drag-start
    maxDuration: number
): { start: number, end: number } | null {

    // 1. Is start point valid? (Must not be inside existing segment)
    // Actually, UI usually blocks clicks, but logic should be safe.
    // check strict overlap for point
    if (findOverlap(segments, time, time)) {
        return null
    }

    let start = time
    let end = time + duration

    // 2. Find next segment (constraint for end)
    const sorted = sortSegments(segments)
    const nextSeg = sorted.find(s => s.start >= time)

    if (nextSeg) {
        if (end > nextSeg.start) {
            end = nextSeg.start
        }
    }

    if (end > maxDuration) {
        end = maxDuration
    }

    return { start, end }
}

// Resize logic
export function resizeSegment(
    segments: Segment[],
    id: string,
    newStart: number,
    newEnd: number,
    maxDuration: number
): { start: number, end: number } {
    const current = segments.find(s => s.id === id)
    if (!current) return { start: newStart, end: newEnd } // Should not happen

    // Find constraints
    const sorted = sortSegments(segments)
    const index = sorted.findIndex(s => s.id === id)

    const prevSeg = index > 0 ? sorted[index - 1] : null
    const nextSeg = index < sorted.length - 1 ? sorted[index + 1] : null

    const minTime = prevSeg ? prevSeg.end : 0
    const maxTime = nextSeg ? nextSeg.start : maxDuration

    // Clamp
    let s = Math.max(minTime, newStart)
    let e = Math.min(maxTime, newEnd)

    // Self-consistency
    if (e < s + 0.1) {
        // Minimum length rule (0.1s)?
        // Prioritize the Handle being moved.
        // If we don't know which handle, just clamp end.
        // But here we just return safe values.
        e = Math.max(s + 0.1, e)
    }

    return { start: s, end: e }
}

// Auto-select logic
export function getNextSelectedId(segments: Segment[], deletedId: string): string | null {
    const sorted = sortSegments(segments)
    const index = sorted.findIndex(s => s.id === deletedId)

    if (index === -1) return null

    // Try Next
    if (index + 1 < sorted.length) {
        return sorted[index + 1].id
    }
    // Try Prev
    if (index - 1 >= 0) {
        return sorted[index - 1].id
    }

    return null
}
