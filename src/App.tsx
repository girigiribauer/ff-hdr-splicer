import { createSignal, onMount, For, Show } from 'solid-js'
import './App.css'
import { SourceSelector } from './components/SourceSelector'
import { VideoEditor } from './components/VideoEditor'
import { validateHDR } from './services/validator'

type Stage = 'SELECT' | 'EDIT'

function App() {
  const [ffmpegStatus, setFfmpegStatus] = createSignal<{ version: string; path: string } | null>(null)
  const [error, setError] = createSignal<string>('')
  const [log, setLog] = createSignal<string[]>([])

  // App State
  const [stage, setStage] = createSignal<Stage>('SELECT')
  const [selectedFile, setSelectedFile] = createSignal<string>('')

  // Log Modal State
  const [showLogs, setShowLogs] = createSignal<boolean>(false)

  const addLog = (msg: string) => setLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`])

  const checkFFmpeg = async () => {
    try {
      const result = await window.ipcRenderer.invoke('check-ffmpeg')
      if (result.error) {
        setError(result.error)
        addLog(`Error: ${result.error}`)
      } else {
        setFfmpegStatus(result)
        setError('')
      }
    } catch (e: any) {
      setError(e.message)
      addLog(`Exception: ${e.message}`)
    }
  }

  // Auto-check on mount
  onMount(() => {
    checkFFmpeg()
  })

  // Handlers
  const handleFileLoaded = async (path: string) => {
    // 1. Validation: HDR Check
    try {
      const probe = await window.ipcRenderer.invoke('run-probe', path)
      if (!probe.success) {
        throw new Error(`Failed to probe file: ${probe.error}`)
      }

      const stream = probe.metadata.streams?.[0]
      if (!stream) throw new Error('No video stream found')

      const transfer = stream.color_transfer
      const primaries = stream.color_primaries

      console.log('Probe:', { transfer, primaries })

      const validation = validateHDR(transfer, primaries)
      if (!validation.valid) {
        // Japanese Error Message
        setError('このファイルは読み込めません。\nこのツールはHDR動画 (Rec.2020 PQ/HLG) 専用です。')
        // Log original technical error
        addLog(`Validation Failed: ${validation.error}`)
        return
      }

    } catch (e: any) {
      setError(e.message)
      addLog(`Validation Error: ${e.message}`)
      return
    }

    setSelectedFile(path)
    setStage('EDIT')
    setError('')
    addLog(`File loaded (HDR Verified): ${path}`)
  }

  const handleBack = () => {
    setStage('SELECT')
    setSelectedFile('')
    addLog('Unloaded file, returned to selection.')
  }

  return (
    <div class="container">
      {/* Main Content Area */}
      <div class="main-content">
        <Show when={stage() === 'SELECT'}>
          <SourceSelector
            ffmpegStatus={ffmpegStatus()}
            onLoaded={handleFileLoaded}
            addLog={addLog}
            error={error()}
          />
        </Show>

        <Show when={stage() === 'EDIT'}>
          <VideoEditor
            filePath={selectedFile()}
            onBack={handleBack}
            addLog={addLog}
            ffmpegStatus={ffmpegStatus()}
          />
        </Show>

        <Show when={error() && stage() !== 'SELECT'}>
          <div style={{ color: 'red', "margin-top": '10px' }}>Error: {error()}</div>
        </Show>

        {/* Log Modal Overlay */}
        <Show when={showLogs()}>
          <div class="log-modal">
            <div class="log-header">
              <span>Application Logs</span>
              <button
                onClick={() => setShowLogs(false)}
                style={{ background: 'transparent', border: 'none', color: '#aaa', padding: 0, "font-size": '16px' }}
              >
                ✕
              </button>
            </div>
            <div class="log-body">
              <For each={log()}>
                {(l) => <div class="log-entry">{l}</div>}
              </For>
            </div>
          </div>
        </Show>
      </div>

      <div class="footer">
        <div style={{ "margin-right": 'auto', "font-size": '0.8em', color: '#666' }}>
          <Show when={ffmpegStatus()} fallback="Checking Env...">
            FFmpeg: {ffmpegStatus()?.version}
          </Show>
        </div>

        <button
          class="btn-secondary"
          onClick={() => setShowLogs(!showLogs())}
          style={{ padding: '6px 12px', "font-size": '12px' }}
        >
          Log
        </button>
      </div>
    </div>
  )
}

export default App
