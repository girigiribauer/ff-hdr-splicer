import { describe, it, expect } from 'vitest'
import { Segment } from '../../src/models/Segment'
import { createSegmentSpecs, getNextSelectedId, resizeSegment, validateSegment, findSnapTime, getTimeFromX } from '../../src/services/timeline'

describe('timeline', () => {
    const maxDur = 100

    describe('validateSegment', () => {
        it('終了時間 < 開始時間の場合、終了時間を開始時間に合わせる (長さ0)', () => {
            const seg = { id: '1', start: 10, end: 5 }
            const res = validateSegment(seg, maxDur)
            expect(res).toEqual({ id: '1', start: 10, end: 10 })
        })

        it('マイナスの開始時間を0に補正する', () => {
            const seg = { id: '1', start: -5, end: 10 }
            const res = validateSegment(seg, maxDur)
            expect(res.start).toBe(0)
        })

        it('最大時間を超える終了時間を補正する', () => {
            const seg = { id: '1', start: 90, end: 110 }
            const res = validateSegment(seg, maxDur)
            expect(res.end).toBe(maxDur)
        })
    })

    describe('createSegmentSpecs', () => {
        it('空きスペースがある場合、動画の最後まで埋める (Smart Fill)', () => {
            // Duration (5) is ignored, fills until maxDur (100)
            const result = createSegmentSpecs([], 10, 5, maxDur)
            expect(result).toEqual({ start: 10, end: 100 })
        })

        it('次のセグメントがある場合、その直前まで埋める (Smart Fill)', () => {
            const existing: Segment[] = [{ id: '1', start: 20, end: 30 }]
            // Start at 10. Duration (15) ignored. Next seg at 20.
            const result = createSegmentSpecs(existing, 10, 15, maxDur)
            expect(result).toEqual({ start: 10, end: 20 })
        })

        it('既存セグメントの上で開始しようとした場合、nullを返す', () => {
            const existing: Segment[] = [{ id: '1', start: 10, end: 20 }]
            const result = createSegmentSpecs(existing, 15, 5, maxDur)
            expect(result).toBeNull()
        })
    })

    describe('resizeSegment', () => {
        const segs: Segment[] = [
            { id: '1', start: 0, end: 10 },
            { id: '2', start: 20, end: 30 },
            { id: '3', start: 40, end: 50 },
        ]

        it('開始位置の変更時、前のセグメントに衝突しないよう制限する', () => {
            // Resize '2' start to 5. '1' ends at 10. Should clamp to 10.
            const res = resizeSegment(segs, '2', 5, 30, maxDur)
            expect(res.start).toBe(10)
        })

        it('終了位置の変更時、次のセグメントに衝突しないよう制限する', () => {
            // Resize '2' end to 45. '3' starts at 40. Should clamp to 40.
            const res = resizeSegment(segs, '2', 20, 45, maxDur)
            expect(res.end).toBe(40)
        })
    })

    describe('getNextSelectedId', () => {
        const segs: Segment[] = [
            { id: 'A', start: 0, end: 10 },
            { id: 'B', start: 20, end: 30 },
            { id: 'C', start: 40, end: 50 },
        ]

        it('中間のセグメントを削除した場合、次のセグメントを選択する', () => {
            const next = getNextSelectedId(segs, 'B')
            expect(next).toBe('C')
        })

        it('最後のセグメントを削除した場合、前のセグメントを選択する', () => {
            const next = getNextSelectedId(segs, 'C')
            expect(next).toBe('B')
        })

        it('最後の1つを削除した場合、nullを返す', () => {
            const one: Segment[] = [{ id: 'A', start: 0, end: 10 }]
            const next = getNextSelectedId(one, 'A')
            expect(next).toBeNull()
        })
    })

    describe('findSnapTime', () => {
        // Mock converter: 100px width, max 100s -> 1px = 1s
        const timeToPx = (t: number) => t
        const candidates = [0, 50, 100]

        it('指定範囲内（デフォルト10px）にあれば、最も近い候補にスナップする', () => {
            // 45px -> closest to 50 (diff 5) -> snaps
            expect(findSnapTime(45, timeToPx, candidates)).toBe(50)
            expect(findSnapTime(55, timeToPx, candidates)).toBe(50)
            expect(findSnapTime(92, timeToPx, candidates)).toBe(100)
            expect(findSnapTime(8, timeToPx, candidates)).toBe(0)
        })

        it('範囲外なら null を返す', () => {
            // 30 -> closest 50 (diff 20) -> no snap (threshold 10)
            expect(findSnapTime(30, timeToPx, candidates)).toBeNull()
        })

        it('複数の候補がある場合、最も近いものを選ぶ', () => {
            const dense = [10, 15]
            expect(findSnapTime(11, timeToPx, dense)).toBe(10) // diff 1
            expect(findSnapTime(14, timeToPx, dense)).toBe(15) // diff 1
        })
    })

    describe('getTimeFromX', () => {
        // Rect: left 10, width 100
        const rect = { left: 10, width: 100 } as DOMRect
        const min = 0
        const max = 200 // 100px represents 200s (1px = 2s)

        it('座標に対応する時間を計算する', () => {
            // clientX 10 (left edge) -> 0% -> 0s
            expect(getTimeFromX(10, rect, min, max)).toBe(0)
            // clientX 60 (center) -> 50% -> 100s
            expect(getTimeFromX(60, rect, min, max)).toBe(100)
            // clientX 110 (right edge) -> 100% -> 200s
            expect(getTimeFromX(110, rect, min, max)).toBe(200)
        })

        it('範囲外（左側）のクリックは最小値にクランプする', () => {
            expect(getTimeFromX(0, rect, min, max)).toBe(0)
        })

        it('範囲外（右側）のクリックは最大値にクランプする', () => {
            expect(getTimeFromX(200, rect, min, max)).toBe(200)
        })
    })
})
