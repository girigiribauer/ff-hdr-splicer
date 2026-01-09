import { createSignal, onMount, Show } from 'solid-js'
import './App.css'
import { SourceSelector } from './components/SourceSelector'
import { VideoEditor } from './components/VideoEditor'
import { Footer } from './components/Footer'
import { validateHDR } from './services/validator'

type Stage = 'SELECT' | 'EDIT'

function App() {
  const [ffmpegStatus, setFfmpegStatus] = createSignal<{ version: string; path: string } | null>(null)
  const [error, setError] = createSignal<string>('')
  const [log, setLog] = createSignal<string[]>([])

  // App State
  const [stage, setStage] = createSignal<Stage>('SELECT')
  const [selectedFile, setSelectedFile] = createSignal<string>('')
  const [fileMetadata, setFileMetadata] = createSignal<any>(null)

  const addLog = (msg: string) => setLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`])

  const checkFFmpeg = async () => {
    try {
      const result = await window.ipcRenderer.invoke('check-ffmpeg')
      if (result.error) {
        setError(result.error)
        setFfmpegStatus(null)
        addLog(`Error: ${result.error}`)
      } else {
        setFfmpegStatus(result)
        setError('')
      }
    } catch (e: any) {
      setError(e.message)
      setFfmpegStatus(null)
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

      // Success
      setSelectedFile(path)
      setFileMetadata(probe.metadata)
      setStage('EDIT')
      setError('')
      addLog(`File loaded (HDR Verified): ${path}`)

    } catch (e: any) {
      setError(e.message)
      addLog(`Validation Error: ${e.message}`)
      return
    }
  }

  const handleBack = () => {
    setStage('SELECT')
    setSelectedFile('')
    setFileMetadata(null)
    addLog('Unloaded file, returned to selection.')
  }

  return (
    <div class="container">
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
            fileMetadata={fileMetadata()}
            onBack={handleBack}
            addLog={addLog}
            ffmpegStatus={ffmpegStatus()}
          />
        </Show>

        <Show when={error() && stage() !== 'SELECT'}>
          <div style={{ color: 'red', "margin-top": '10px' }}>Error: {error()}</div>
        </Show>
      </div>

      <Footer
        ffmpegVersion={ffmpegStatus()?.version}
        hasError={!!error() && !ffmpegStatus()}
        logs={log()}
      />
    </div>
  )
}

export default App
