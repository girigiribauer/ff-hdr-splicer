import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { FfmpegService } from './services/FfmpegService'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  const ffmpegService = new FfmpegService()

  ipcMain.handle('check-ffmpeg', async () => {
    return await ffmpegService.checkFFmpeg()
  })

  ipcMain.handle('run-test-splice', async (_event, args) => {
    const { filePath, segments, outputDir } = args
    if (!filePath) return { error: 'No file path provided' }
    if (!segments || segments.length === 0) return { error: 'No segments provided' }

    // Use outputDir from args or default sibling logic
    // For now, let's keep it simple and handle output path generation inside service or just here?
    // Service already has output logic in runTestCut, but spliceSegments takes direct outPath.
    // Let's generate outPath here to match simple testing needs.

    // Copying logic from runTestCut slightly to determine output path
    const path = await import('node:path')
    const fs = await import('node:fs')

    // outputDir default
    const outDirTarget = outputDir || path.join(path.dirname(filePath), '..', 'output')
    if (!fs.existsSync(outDirTarget)) {
      fs.mkdirSync(outDirTarget, { recursive: true })
    }

    const ext = path.extname(filePath)
    const name = path.basename(filePath, ext)
    const outPath = path.join(outDirTarget, `${name}_splice_${Date.now()}${ext}`)

    return await ffmpegService.spliceSegments(filePath, segments, outPath)
  })

  createWindow()
})
