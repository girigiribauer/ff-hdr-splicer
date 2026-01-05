export function validateHDR(transfer: string | undefined, primaries: string | undefined): { valid: boolean; error?: string } {
    const isPQ = transfer === 'smpte2084'
    const isHLG = transfer === 'arib-std-b67'
    const isRec2020 = primaries === 'bt2020'

    if ((isPQ || isHLG) && isRec2020) {
        return { valid: true }
    }

    return {
        valid: false,
        error: `Error: This video is not HDR.\nDetected: ${transfer || 'unknown'} / ${primaries || 'unknown'}\nRequired: smpte2084(PQ) or arib-std-b67(HLG) AND bt2020`
    }
}
