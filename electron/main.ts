import { app, BrowserWindow, ipcMain, protocol, Menu } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import * as FfmpegService from './services/FfmpegService'
import { handleMediaRequest } from './protocols/MediaProtocol'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

const template: Electron.MenuItemConstructorOptions[] = [
  {
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  }
]

const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      webSecurity: true,
      // Disable DevTools in production (native Electron way)
      devTools: process.env.NODE_ENV === 'development'
    },
  })

  // Block sensitive permissions
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media'] // Add any required permissions here
    if (allowedPermissions.includes(permission)) {
      callback(true)
    } else {
      console.log(`Blocked permission request: ${permission}`)
      callback(false)
    }
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

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true
    }
  }
])

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
    const { filePath, segments, outputDir, outputFilePath, fadeOptions } = args
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

    return await FfmpegService.spliceSegments(filePath, segments, outPath, fadeOptions, (percent) => {
      _event.sender.send('export-progress', { percent })
    })
  })

  ipcMain.handle('run-generate-proxy', async (_event, filePath) => {
    if (!filePath) return { success: false, error: 'No file path provided' }
    return await FfmpegService.generateProxy(filePath, (percent) => {
      _event.sender.send('proxy-progress', { percent })
    })
  })



  ipcMain.handle('show-open-dialog', async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Movies', extensions: ['mov', 'mp4', 'mkv'] }]
    })
    return result
  })

  ipcMain.handle('show-info-dialog', async (_event, title, content) => {
    const { dialog } = await import('electron')
    return await dialog.showMessageBox({
      type: 'info',
      title: title,
      message: title,
      detail: content,
      buttons: ['OK']
    })
  })

  ipcMain.handle('show-save-dialog', async (_event, defaultName) => {
    const { dialog } = await import('electron')
    const path = await import('node:path')
    const ext = path.extname(defaultName).replace('.', '') || 'mov'

    // Reorder extensions to prioritize the current one
    const allExts = ['mov', 'mp4', 'mkv']
    const contextExts = [ext, ...allExts.filter(e => e !== ext)]

    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'Movies', extensions: contextExts }]
    })
    return result
  })

  createWindow()
})

app.whenReady().then(() => {
  protocol.handle('media', handleMediaRequest)
})
