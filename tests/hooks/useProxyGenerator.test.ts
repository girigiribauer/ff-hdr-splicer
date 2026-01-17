import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, createSignal } from 'solid-js'
import { useProxyGenerator } from '../../src/hooks/useProxyGenerator'

// Mock IPC Renderer
const mockInvoke = vi.fn()
const mockOn = vi.fn()
const mockOff = vi.fn()
const mockRemoveListener = vi.fn()

// Global window mock setup
function setupWindowMock() {
    (window as any).ipcRenderer = {
        invoke: mockInvoke,
        on: mockOn,
        off: mockOff,
        removeListener: mockRemoveListener,
        send: vi.fn()
    }
}

describe('useProxyGenerator', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setupWindowMock()
    })

    // Helper to run hook in reactive context
    function runHookInRoot(hookFn: () => any) {
        return createRoot((dispose) => {
            const result = hookFn()
            return { result, dispose }
        })
    }

    it('初期パスがある場合、プロキシ生成が開始される', async () => {
        const [path, setPath] = createSignal<string>('/init.mov')
        const addLog = vi.fn()

        mockInvoke.mockResolvedValue({ success: true, proxyPath: '/tmp/proxy.mp4' })

        runHookInRoot(() => {
            useProxyGenerator(path, addLog)
        })

        await vi.waitFor(() => {
            expect(mockInvoke).toHaveBeenCalledWith('run-generate-proxy', '/init.mov')
        })
    })

    it('初期パスが空の場合、プロキシ生成は行われない', () => {
        const [path, setPath] = createSignal<string>('')
        const addLog = vi.fn()

        runHookInRoot(() => {
            useProxyGenerator(path, addLog)
        })

        // No wait needed as computed is sync, but async part is next tick
        expect(mockInvoke).not.toHaveBeenCalled()
    })

    it('プロキシ生成が成功した場合、proxyPathが更新される', async () => {
        const [path, setPath] = createSignal<string>('/video.mov')
        const addLog = vi.fn()

        mockInvoke.mockResolvedValue({ success: true, proxyPath: '/tmp/proxy.mp4' })

        const { result } = runHookInRoot(() => useProxyGenerator(path, addLog))

        // Wait for processing
        await vi.waitFor(() => {
            expect(result.proxyPath()).toBe('/tmp/proxy.mp4')
        })
        expect(addLog).toHaveBeenCalledWith('Proxy generated for preview.')
    })

    it('プロキシ生成が失敗した場合、ログが出力されproxyPathはnullのまま', async () => {
        const [path, setPath] = createSignal<string>('/video.mov')
        const addLog = vi.fn()

        mockInvoke.mockResolvedValue({ success: false, error: 'Test Error' })

        const { result } = runHookInRoot(() => useProxyGenerator(path, addLog))

        await vi.waitFor(() => {
            expect(result.isMakingProxy()).toBe(false)
        })

        expect(result.proxyPath()).toBe(null)
        expect(addLog).toHaveBeenCalledWith('Proxy generation failed: Test Error')
    })

    it('進捗イベントを受け取り、progressが更新される', async () => {
        const [path, setPath] = createSignal<string>('/video.mov')
        const addLog = vi.fn()

        // Mock success but taking time
        mockInvoke.mockImplementation(async () => {
            return { success: true, proxyPath: 'p.mp4' }
        })

        // Capture the event listener
        let progressCallback: any
        mockOn.mockImplementation((channel, cb) => {
            if (channel === 'proxy-progress') progressCallback = cb
        })

        const { result } = runHookInRoot(() => useProxyGenerator(path, addLog))

        // Wait for listener registration (in effect)
        await vi.waitFor(() => expect(mockOn).toHaveBeenCalledWith('proxy-progress', expect.any(Function)))

        // Emit progress
        progressCallback({}, { percent: 50 })

        expect(result.proxyProgress()).toBe(50)
    })
})
