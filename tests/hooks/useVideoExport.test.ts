import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRoot } from 'solid-js'
import { useVideoExport } from '../../src/hooks/useVideoExport'
import { Segment } from '../../src/models/Segment'

// Mock IPC Renderer
const mockInvoke = vi.fn()
const mockOn = vi.fn()
const mockOff = vi.fn()
const mockRemoveListener = vi.fn()

function setupWindowMock() {
    (window as any).ipcRenderer = {
        invoke: mockInvoke,
        on: mockOn,
        off: mockOff,
        removeListener: mockRemoveListener,
        send: vi.fn()
    }
}

describe('useVideoExport', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setupWindowMock()
    })

    function runHookInRoot(hookFn: () => any) {
        return createRoot((dispose) => {
            const result = hookFn()
            return { result, dispose }
        })
    }

    const mockSegments: Segment[] = [
        { id: '1', start: 0, end: 10 }
    ]
    const mockFadeOptions = {
        crossfade: false,
        fadeInOut: true,
        fadeDuration: 1,
        crossfadeDuration: 0
    }

    it('エクスポート開始時にファイル名が正しく補完される（拡張子維持）', async () => {
        const addLog = vi.fn()
        const { result } = runHookInRoot(() => useVideoExport(addLog))

        mockInvoke.mockResolvedValueOnce({ canceled: false, filePath: '/out/video_cut.mkv' }) // save dialog result
        mockInvoke.mockResolvedValueOnce({ success: true, outPath: '/out/video_cut.mkv' }) // splice result

        // Case 1: .mkv input
        await result.startExport('/input/video.mkv', mockSegments, mockFadeOptions)

        // Check show-save-dialog call
        // Expect defaultName to be video_cut.mkv because input was video.mkv
        expect(mockInvoke).toHaveBeenNthCalledWith(1, 'show-save-dialog', 'video_cut.mkv')
    })

    it('拡張子がない場合、.movが補完される', async () => {
        const addLog = vi.fn()
        const { result } = runHookInRoot(() => useVideoExport(addLog))

        mockInvoke.mockResolvedValue({ canceled: true }) // Cancel immediately to stop logic

        await result.startExport('/input/video', mockSegments, mockFadeOptions)
        expect(mockInvoke).toHaveBeenCalledWith('show-save-dialog', 'video_cut.mov')
    })

    it('保存ダイアログでキャンセルされた場合、処理を中断する', async () => {
        const addLog = vi.fn()
        const { result } = runHookInRoot(() => useVideoExport(addLog))

        mockInvoke.mockResolvedValue({ canceled: true })

        await result.startExport('/input/video.mp4', mockSegments, mockFadeOptions)

        expect(result.isExporting()).toBe(false)
        // run-test-splice should NOT be called (only show-save-dialog was called)
        expect(mockInvoke).toHaveBeenCalledTimes(1)
    })

    it('エクスポート実行時、正しいパラメータでIPCが呼ばれる', async () => {
        const addLog = vi.fn()
        const { result } = runHookInRoot(() => useVideoExport(addLog))

        mockInvoke.mockResolvedValueOnce({ canceled: false, filePath: '/out.mp4' })
        mockInvoke.mockResolvedValueOnce({ success: true })

        await result.startExport('/in.mp4', mockSegments, mockFadeOptions)

        expect(mockInvoke).toHaveBeenLastCalledWith('run-test-splice', expect.objectContaining({
            filePath: '/in.mp4',
            outputFilePath: '/out.mp4',
            segments: [{ start: 0, end: 10 }],
            fadeOptions: expect.objectContaining({ fadeDuration: 1 })
        }))

        expect(result.isExporting()).toBe(false)
        expect(addLog).toHaveBeenCalledWith(expect.stringContaining('Success'))
    })

    it('進捗イベントでプログレスが更新される', async () => {
        const addLog = vi.fn()
        let progressCallback: any
        mockOn.mockImplementation((channel, cb) => {
            if (channel === 'export-progress') progressCallback = cb
        })

        const { result } = runHookInRoot(() => useVideoExport(addLog))

        await vi.waitFor(() => expect(mockOn).toHaveBeenCalled())

        progressCallback({}, { percent: 80 })
        expect(result.exportProgress()).toBe(80)
    })
    it('セグメントが時系列順にソートされてエクスポートされる', async () => {
        const addLog = vi.fn()
        mockInvoke.mockResolvedValueOnce({ filePath: '/out.mp4', canceled: false }) // 1. show-save-dialog
        mockInvoke.mockResolvedValueOnce({ success: true, outPath: '/out.mp4' }) // 2. run-test-splice

        const { result } = runHookInRoot(() => useVideoExport(addLog))

        // Input segments in non-chronological order (Start 100, then Start 0)
        const segments: any = [
            { start: 100, end: 110, id: '2' },
            { start: 0, end: 10, id: '1' }
        ]

        await result.startExport('/in.mp4', segments, {
            crossfade: false,
            fadeInOut: false,
            fadeDuration: 0,
            crossfadeDuration: 0
        })

        // Verify the second argument to run-test-splice
        // Note: mockInvoke calls might include show-save-dialog.
        const spliceCall = mockInvoke.mock.calls.find(call => call[0] === 'run-test-splice')
        expect(spliceCall).toBeDefined()
        const params = spliceCall![1]

        expect(params.segments).toHaveLength(2)
        expect(params.segments[0].start).toBe(0)
        expect(params.segments[1].start).toBe(100)
    })
})
