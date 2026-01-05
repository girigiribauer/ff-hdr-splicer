import { describe, it, expect } from 'vitest'
import { Segment } from '../../src/models/Segment'
import { createSegmentSpecs, getNextSelectedId, resizeSegment, validateSegment } from '../../src/services/timeline'

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
        it('空きスペースがある場合、指定通りのセグメントを作成できる', () => {
            const result = createSegmentSpecs([], 10, 5, maxDur)
            expect(result).toEqual({ start: 10, end: 15 })
        })

        it('次のセグメントに衝突する場合、長さを制限して作成する', () => {
            const existing: Segment[] = [{ id: '1', start: 20, end: 30 }]
            // Start at 10, try to add 15 (end 25). Should stop at 20.
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
})
