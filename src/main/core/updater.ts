
import axios from 'axios'
import { createWriteStream, existsSync, mkdirSync } from 'fs'
import { chmod, unlink, rename, readFile, writeFile } from 'fs/promises'
import path from 'path'
import os from 'os'
import AdmZip from 'adm-zip'
import zlib from 'zlib'
import { pipeline } from 'stream/promises'
import { getAppConfig, getControledMihomoConfig } from '../config'
import { stopCore, startCore } from './manager'
import { mihomoCorePath } from '../utils/dirs'
import { mainWindow } from '..'

// 获取最新的 Release/Alpha 版本下载地址
async function getDownloadUrl(isAlpha: boolean): Promise<{ url: string; version: string }> {
  const { 'mixed-port': mixedPort = 7890 } = await getControledMihomoConfig()
  
  // 1. 获取 Version String
  const versionUrl = isAlpha
    ? 'https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha/version.txt'
    : 'https://github.com/MetaCubeX/mihomo/releases/latest/download/version.txt'

  const proxyConfig = {
    protocol: 'http',
    host: '127.0.0.1',
    port: mixedPort
  }

  // 尝试使用代理获取版本信息，如果失败则直连
  let version = ''
  try {
    const res = await axios.get(versionUrl, {
      proxy: proxyConfig,
      timeout: 5000
    })
    version = res.data.trim()
  } catch {
    const res = await axios.get(versionUrl, { timeout: 10000 })
    version = res.data.trim()
  }

  // 2. 构建下载 URL
  // Alpha: mihomo-windows-amd64-alpha-{version}.zip
  // Release: mihomo-windows-amd64-{version}.zip
  // 注意：Release 版本通常是 v1.18.1 格式，文件名中不仅包含 v
  
  const platform = os.platform()
  const arch = os.arch()
  
  let osStr = ''
  if (platform === 'win32') osStr = 'windows'
  else if (platform === 'linux') osStr = 'linux'
  else if (platform === 'darwin') osStr = 'darwin'
  else throw new Error(`Unsupported platform: ${platform}`)

  let archStr = ''
  if (arch === 'x64') archStr = 'amd64'
  else if (arch === 'arm64') archStr = 'arm64'
  else throw new Error(`Unsupported arch: ${arch}`)

  const ext = platform === 'win32' ? '.zip' : '.gz'
  
  // Alpha 文件名示例: mihomo-windows-amd64-alpha-a1b2c3d.zip
  // Release 文件名示例: mihomo-windows-amd64-v1.18.1.zip
  
  const filename = isAlpha
    ? `mihomo-${osStr}-${archStr}-alpha-${version}${ext}`
    : `mihomo-${osStr}-${archStr}-${version}${ext}`

  const downloadUrl = isAlpha
    ? `https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha/${filename}`
    : `https://github.com/MetaCubeX/mihomo/releases/download/${version}/${filename}`

  console.log(`[Updater] Target: ${downloadUrl}`)
  return { url: downloadUrl, version }
}

export async function upgradeMihomo(): Promise<void> {
  const { core = 'mihomo' } = await getAppConfig()
  const isAlpha = core === 'mihomo-alpha'
  const isWin = process.platform === 'win32'
  
  // 通知前端开始更新
  mainWindow?.webContents.send('mihomo-download-progress', { status: 'checking' })

  try {
    // 1. 获取下载地址
    const { url, version } = await getDownloadUrl(isAlpha)
    
    // 2. 准备下载路径
    const tempDir = path.join(os.tmpdir(), 'routex-update')
    if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true })
    
    const tempFile = path.join(tempDir, path.basename(url))
    
    // 3. 下载文件
    mainWindow?.webContents.send('mihomo-download-progress', { status: 'downloading', progress: 0 })
    
    const { 'mixed-port': mixedPort = 7890 } = await getControledMihomoConfig()
    
    await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      proxy: { protocol: 'http', host: '127.0.0.1', port: mixedPort },
      timeout: 30000
    }).then(response => {
       const totalLength = response.headers['content-length']
       let downloaded = 0
       
       response.data.on('data', (chunk) => {
         downloaded += chunk.length
         if (totalLength) {
           const progress = Math.round((downloaded / parseInt(totalLength)) * 100)
           mainWindow?.webContents.send('mihomo-download-progress', { status: 'downloading', progress })
         }
       })
       
       return pipeline(response.data, createWriteStream(tempFile))
    }).catch(async (e) => {
        // 重试直连下载
        console.warn('Proxy download failed, trying direct...', e.message)
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            timeout: 30000
        })
        const totalLength = response.headers['content-length']
        let downloaded = 0
        response.data.on('data', (chunk) => {
            downloaded += chunk.length
            if (totalLength) {
                const progress = Math.round((downloaded / parseInt(totalLength)) * 100)
                mainWindow?.webContents.send('mihomo-download-progress', { status: 'downloading', progress })
            }
        })
        return pipeline(response.data, createWriteStream(tempFile))
    })

    // 4. 停止内核
    mainWindow?.webContents.send('mihomo-download-progress', { status: 'extracting' })
    await stopCore(true)
    
    // 5. 解压/安装
    const targetPath = mihomoCorePath(core)
    
    if (url.endsWith('.zip')) {
      const zip = new AdmZip(tempFile)
      const zipEntries = zip.getEntries()
      // 查找 .exe 文件，通常 zip 里只有 mihomo-windows-amd64.exe
      const exeEntry = zipEntries.find(entry => entry.entryName.endsWith('.exe') || entry.entryName.includes('mihomo'))
      
      if (!exeEntry) {
        throw new Error('Invalid Zip: No executable found')
      }
      
      // 解压到目标目录
      // AdmZip extractEntryTo sync
      zip.extractEntryTo(exeEntry, path.dirname(targetPath), false, true)
      
      // 重命名（如果名字不对）
      const extractedName = path.join(path.dirname(targetPath), exeEntry.name)
      if (extractedName !== targetPath) {
        if (existsSync(targetPath)) await unlink(targetPath).catch(() => {})
        await rename(extractedName, targetPath)
      }
    } else if (url.endsWith('.gz')) {
       // Gzip 解压 (Linux/Mac)
       const source = await readFile(tempFile)
       const unzipped = zlib.gunzipSync(source)
       
       await writeFile(targetPath, unzipped)
    }
    
    // 6. 赋予权限
    if (!isWin) {
      await chmod(targetPath, 0o755)
    }
    
    // 7. 清理临时文件
    await unlink(tempFile).catch(() => {})
    
    // 8. 重启内核
    mainWindow?.webContents.send('mihomo-download-progress', { status: 'restarting' })
    await startCore()
    
    mainWindow?.webContents.send('mihomo-download-progress', { status: 'done', version })
    
  } catch (error) {
    console.error('Update Failed:', error)
    mainWindow?.webContents.send('mihomo-download-progress', { status: 'error', error: String(error) })
    throw error
  }
}
