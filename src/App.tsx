import { createSignal, onMount, For, Show } from 'solid-js'
import './App.css'
import { SourceSelector } from './components/SourceSelector'
import { VideoEditor } from './components/VideoEditor'

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
  const handleFileLoaded = (path: string) => {
    setSelectedFile(path)
    setStage('EDIT')
    addLog(`File loaded: ${path}`)
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

        <Show when={error()}>
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

      {/* Footer Area */}
      <div class="footer">
        <div style={{ "margin-right": 'auto', "font-size": '0.8em', color: '#666' }}>
          <Show when={ffmpegStatus()} fallback="Checking Env...">
            FFmpeg: {ffmpegStatus()?.version}
          </Show>
        </div>

        {/* Log Toggle Button */}
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
