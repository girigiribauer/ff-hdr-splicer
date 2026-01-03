import { createSignal, onMount, For, Show } from 'solid-js'
import './App.css'

function App() {
  const [ffmpegStatus, setFfmpegStatus] = createSignal<{ version: string; path: string } | null>(null)
  const [error, setError] = createSignal<string>('')
  // Default path for easier testing
  const [testFilePath, setTestFilePath] = createSignal<string>('/Users/y/works/ff-hdr-splicer/test-samples/something.mov')
  const [log, setLog] = createSignal<string[]>([])

  const addLog = (msg: string) => setLog(prev => [...prev, msg])

  const checkFFmpeg = async () => {
    try {
      addLog('Checking FFmpeg...')
      const result = await window.ipcRenderer.invoke('check-ffmpeg')
      console.log(result)
      if (result.error) {
        setError(result.error)
        addLog(`Error: ${result.error}`)
      } else {
        setFfmpegStatus(result)
        setError('')
        addLog(`Found FFmpeg: ${result.version} at ${result.path}`)
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

  const runTestCut = async () => {
    if (!testFilePath()) return
    try {
      addLog(`Starting Test Cut on: ${testFilePath()}`)
      const result = await window.ipcRenderer.invoke('run-test-cut', { filePath: testFilePath() })
      addLog(`Test Cut Result: ${JSON.stringify(result)}`)
    } catch (e: any) {
      addLog(`Cut Error: ${e.message}`)
    }
  }

  return (
    <div class="container" style={{ padding: '20px', "max-width": '800px', margin: '0 auto', "font-family": 'sans-serif' }}>
      <h1>FF HDR Splicer - Dev Dashboard (SolidJS)</h1>

      <div class="card" style={{ border: '1px solid #ccc', padding: '15px', "margin-bottom": '15px', "border-radius": '8px', background: '#fafafa' }}>
        <h2>Phase 0: Environment</h2>
        <Show
          when={ffmpegStatus()}
          fallback={<div style={{ color: 'orange' }}>Checking FFmpeg...</div>}
        >
          <div style={{ "margin-top": '10px', "font-size": '0.9em', color: 'green' }}>
            ✅ Ready: {ffmpegStatus()?.version}
          </div>
        </Show>
      </div>

      <div class="card" style={{ border: '1px solid #ccc', padding: '15px', "margin-bottom": '15px', "border-radius": '8px', background: '#fff' }}>
        <h2>Phase 1: Core Logic Test</h2>
        <div style={{ display: 'flex', gap: '10px', "align-items": 'center' }}>
          <input
            type="text"
            placeholder="Absolute Path to HDR Video"
            value={testFilePath()}
            onInput={(e) => setTestFilePath(e.currentTarget.value)}
            style={{ flex: 1, padding: '8px', "border-radius": '4px', border: '1px solid #ddd' }}
          />
          <button
            onClick={runTestCut}
            disabled={!testFilePath() || !ffmpegStatus()}
            style={{
              padding: '10px 20px',
              cursor: (!testFilePath() || !ffmpegStatus()) ? 'not-allowed' : 'pointer',
              background: (!testFilePath() || !ffmpegStatus()) ? '#ccc' : '#007BFF',
              color: 'white',
              border: 'none',
              "border-radius": '4px',
              "font-weight": 'bold'
            }}
          >
            Test Cut (40%-60%)
          </button>
        </div>
        <p style={{ "font-size": '0.8em', color: '#666', "margin-top": '5px' }}>
          *Logic: Cuts from 40% to 60% of duration (using probe) and saves to file_cut.mp4 in same dir.
        </p>
      </div>

      <div class="log-area" style={{ background: '#333', color: '#eee', padding: '15px', "border-radius": '4px', height: '300px', "overflow-y": 'auto', "text-align": 'left', "font-family": 'monospace', "font-size": '12px' }}>
        <For each={log()}>
          {(l) => <div>{l}</div>}
        </For>
      </div>
      <Show when={error()}>
        <p style={{ color: 'red' }}>Last Error: {error()}</p>
      </Show>
    </div>
  )
}

export default App
