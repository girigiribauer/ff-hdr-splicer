import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import * as FfmpegService from './services/FfmpegService'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// Reverted custom protocol due to video streaming/seeking issues with net.fetch
// Back to webSecurity: false for local file access

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      webSecurity: false // Disabled to allow file:// access for video
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
  ipcMain.handle('check-ffmpeg', async () => {
    return await FfmpegService.checkFFmpeg()
  })

  ipcMain.handle('run-probe', async (_event, filePath) => {
    try {
      const metadata = await FfmpegService.getVideoMetadata(filePath)
      return { success: true, metadata }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('run-test-splice', async (_event, args) => {
    const { filePath, segments, outputDir, outputFilePath } = args
    if (!filePath) return { error: 'No file path provided' }
    if (!segments || segments.length === 0) return { error: 'No segments provided' }

    let outPath = ''

    if (outputFilePath) {
      outPath = outputFilePath
    } else {
      const path = await import('node:path')
      const fs = await import('node:fs')

      const outDirTarget = outputDir || path.join(path.dirname(filePath), '..', 'output')
      if (!fs.existsSync(outDirTarget)) {
        fs.mkdirSync(outDirTarget, { recursive: true })
      }

      const ext = path.extname(filePath)
      const name = path.basename(filePath, ext)
      outPath = path.join(outDirTarget, `${name}_splice_${Date.now()}${ext}`)
    }

    return await FfmpegService.spliceSegments(filePath, segments, outPath)
  })

  ipcMain.handle('show-open-dialog', async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Movies', extensions: ['mov', 'mp4', 'mkv'] }]
    })
    return result
  })

  ipcMain.handle('show-save-dialog', async (_event, defaultName) => {
    const { dialog } = await import('electron')
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'Movies', extensions: ['mov', 'mp4', 'mkv'] }]
    })
    return result
  })

  createWindow()
})
