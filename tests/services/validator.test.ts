import { describe, it, expect } from 'vitest'
import { validateHDR } from '../../src/services/validator'

describe('validator', () => {
    it('PQ方式 + BT.2020 は有効', () => {
        const result = validateHDR('smpte2084', 'bt2020')
        expect(result.valid).toBe(true)
    })

    it('HLG方式 + BT.2020 は有効', () => {
        const result = validateHDR('arib-std-b67', 'bt2020')
        expect(result.valid).toBe(true)
    })

    it('SDR (bt709) は無効', () => {
        const result = validateHDR('bt709', 'bt709')
        expect(result.valid).toBe(false)
        expect(result.error).toContain('This video is not HDR')
    })

    it('BT.2020だがSDR (転送関数なし) は無効', () => {
        const result = validateHDR('bt709', 'bt2020')
        expect(result.valid).toBe(false)
    })

    it('HDR転送関数だが標準色域 (bt709) は無効', () => {
        // Edge case: HDR brightness but wrong colors
        const result = validateHDR('smpte2084', 'bt709')
        expect(result.valid).toBe(false)
    })

    it('未知/未定義のメタデータは無効', () => {
        const result = validateHDR(undefined, undefined)
        expect(result.valid).toBe(false)
    })
})
