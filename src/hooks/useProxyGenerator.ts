import { createSignal, createComputed, onCleanup, untrack } from 'solid-js'

export function useProxyGenerator(filePath: () => string, addLog: (msg: string) => void) {
    const [proxyPath, setProxyPath] = createSignal<string | null>(null)
    const [isMakingProxy, setIsMakingProxy] = createSignal<boolean>(false)
    const [proxyProgress, setProxyProgress] = createSignal(0)

    // Setup listeners
    createComputed(() => {
        // Safe dependency check? No dependencies here, runs once.
        const onProgress = (_: any, data: any) => setProxyProgress(data.percent)
        if (window.ipcRenderer) {
            window.ipcRenderer.on('proxy-progress', onProgress)
            onCleanup(() => {
                if (window.ipcRenderer.off) {
                    window.ipcRenderer.off('proxy-progress', onProgress)
                }
            })
        }
    })

    createComputed(async () => {
        const path = filePath()
        if (!path) return

        setProxyPath(null)
        setIsMakingProxy(true)
        setProxyProgress(0)

        try {
            const res = await window.ipcRenderer.invoke('run-generate-proxy', path)
            if (res.success && res.proxyPath) {
                setProxyPath(res.proxyPath)
                untrack(() => addLog('Proxy generated for preview.'))
            } else {
                untrack(() => addLog(`Proxy generation failed: ${res.error}`))
                if (res.stderr) {
                    // Log last 200 chars of stderr to avoid spamming
                    const errLog = res.stderr.slice(-200)
                    untrack(() => addLog(`FFmpeg stderr (tail): ${errLog}`))
                }
            }
        } catch (e: any) {
            addLog(`Proxy Error: ${e.message}`)
        } finally {
            setIsMakingProxy(false)
        }
    })

    return {
        proxyPath,
        isMakingProxy,
        proxyProgress
    }
}
