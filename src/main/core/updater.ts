
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

interface MihomoReleaseAsset {
  name: string
  browser_download_url: string
}

interface MihomoReleaseResponse {
  assets?: MihomoReleaseAsset[]
}

const GITHUB_JSON_HEADERS = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'RouteX'
}

function getAssetPrefixCandidates(platform: NodeJS.Platform, arch: string): string[] {
  const key = `${platform}-${arch}`
  switch (key) {
    case 'win32-x64':
      return [
        'mihomo-windows-amd64',
        'mihomo-windows-amd64-compatible',
        'mihomo-windows-amd64-v1',
        'mihomo-windows-amd64-v2',
        'mihomo-windows-amd64-v3'
      ]
    case 'win32-ia32':
      return ['mihomo-windows-386']
    case 'win32-arm64':
      return ['mihomo-windows-arm64']
    case 'darwin-x64':
      return ['mihomo-darwin-amd64', 'mihomo-darwin-amd64-compatible', 'mihomo-darwin-amd64-v1']
    case 'darwin-arm64':
      return ['mihomo-darwin-arm64']
    case 'linux-x64':
      return [
        'mihomo-linux-amd64',
        'mihomo-linux-amd64-compatible',
        'mihomo-linux-amd64-v1',
        'mihomo-linux-amd64-v2',
        'mihomo-linux-amd64-v3'
      ]
    case 'linux-arm64':
      return ['mihomo-linux-arm64']
    case 'linux-loong64':
      return ['mihomo-linux-loong64', 'mihomo-linux-loong64-abi2']
    default:
      throw new Error(`Unsupported platform or arch: ${key}`)
  }
}

function matchAssetName(
  assetName: string,
  version: string,
  isAlpha: boolean,
  ext: string,
  prefixes: string[]
): boolean {
  const suffix = `-${version}${ext}`
  if (!assetName.endsWith(suffix)) return false

  return prefixes.some((prefix) => {
    if (!assetName.startsWith(prefix)) return false
    const middle = assetName.slice(prefix.length, assetName.length - suffix.length)
    if (isAlpha) {
      return middle === '-alpha' || /^-alpha-go\d+$/.test(middle) || /^-alpha-[\w.-]+$/.test(middle)
    }
    return middle === '' || /^-go\d+$/.test(middle)
  })
}

function scoreAssetName(assetName: string, version: string, isAlpha: boolean, ext: string): number {
  const suffix = `-${version}${ext}`
  const middle = assetName.slice(0, assetName.length - suffix.length)
  if (isAlpha) {
    if (middle.endsWith('-alpha')) return 0
    if (/-alpha-go\d+$/.test(middle)) return 1
    return 2
  }
  if (!middle.includes('-go')) return 0
  if (/-go\d+$/.test(middle)) return 1
  return 2
}

function pickBestReleaseAsset(
  assets: MihomoReleaseAsset[],
  version: string,
  isAlpha: boolean,
  ext: string,
  prefixes: string[]
): MihomoReleaseAsset {
  const matched = assets
    .filter((asset) => matchAssetName(asset.name, version, isAlpha, ext, prefixes))
    .sort((a, b) => {
      const prefixIndexA = prefixes.findIndex((prefix) => a.name.startsWith(prefix))
      const prefixIndexB = prefixes.findIndex((prefix) => b.name.startsWith(prefix))
      if (prefixIndexA !== prefixIndexB) return prefixIndexA - prefixIndexB
      return scoreAssetName(a.name, version, isAlpha, ext) - scoreAssetName(b.name, version, isAlpha, ext)
    })

  if (matched.length === 0) {
    throw new Error(`No matched mihomo asset found for ${process.platform}-${process.arch} (${version})`)
  }

  return matched[0]
}

function findExecutableEntry(zipEntries: AdmZip.IZipEntry[]): AdmZip.IZipEntry | undefined {
  return zipEntries.find(
    (entry) => !entry.isDirectory && (entry.entryName.endsWith('.exe') || entry.entryName.includes('mihomo'))
  )
}

async function fetchReleaseAssets(tag: string): Promise<MihomoReleaseAsset[]> {
  const response = await axios.get<MihomoReleaseResponse>(
    `https://api.github.com/repos/MetaCubeX/mihomo/releases/tags/${encodeURIComponent(tag)}`,
    {
      timeout: 10000,
      headers: GITHUB_JSON_HEADERS
    }
  )
  return response.data.assets || []
}

async function resolveAssetFromRelease(
  version: string,
  isAlpha: boolean,
  platform: NodeJS.Platform,
  arch: string
): Promise<MihomoReleaseAsset> {
  const ext = platform === 'win32' ? '.zip' : '.gz'
  const prefixes = getAssetPrefixCandidates(platform, arch)
  const tag = isAlpha ? 'Prerelease-Alpha' : version
  const assets = await fetchReleaseAssets(tag)
  return pickBestReleaseAsset(assets, version, isAlpha, ext, prefixes)
}

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
  const platform = os.platform()
  const arch = os.arch()
  const asset = await resolveAssetFromRelease(version, isAlpha, platform, arch)
  const downloadUrl = asset.browser_download_url

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
      const exeEntry = findExecutableEntry(zip.getEntries())
      
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
