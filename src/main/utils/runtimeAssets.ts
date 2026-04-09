import axios from 'axios'
import AdmZip from 'adm-zip'
import { existsSync, mkdirSync } from 'fs'
import { chmod, readFile, rename, unlink, writeFile } from 'fs/promises'
import os from 'os'
import path from 'path'
import zlib from 'zlib'
import { dataDir, resourcesDir, resourcesFilesDir } from './dirs'
import { getControledMihomoConfig } from '../config'

interface GitHubReleaseAsset {
  name: string
  browser_download_url: string
}

interface GitHubReleaseResponse {
  assets?: GitHubReleaseAsset[]
}

const OPTIONAL_RUNTIME_DIR = path.join(dataDir(), 'runtime-assets')
const OPTIONAL_RUNTIME_FILES_DIR = path.join(OPTIONAL_RUNTIME_DIR, 'files')
const OPTIONAL_RUNTIME_SIDECAR_DIR = path.join(OPTIONAL_RUNTIME_DIR, 'sidecar')
const TRAFFIC_MONITOR_REPO = 'zhongyang219/TrafficMonitor'
const ENABLE_LOOPBACK_URL =
  'https://github.com/Kuingsmile/uwp-tool/releases/download/latest/enableLoopback.exe'
const MIHOMO_ALPHA_VERSION_URL =
  'https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha/version.txt'
const GITHUB_JSON_HEADERS = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'RouteX'
}

const pendingDownloads = new Map<string, Promise<string>>()

function createGitHubJsonHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_API_TOKEN
  return token
    ? {
        ...GITHUB_JSON_HEADERS,
        Authorization: `Bearer ${token}`
      }
    : GITHUB_JSON_HEADERS
}

function withDownloadLock(key: string, action: () => Promise<string>): Promise<string> {
  const existing = pendingDownloads.get(key)
  if (existing) {
    return existing
  }

  const task = action().finally(() => {
    pendingDownloads.delete(key)
  })
  pendingDownloads.set(key, task)
  return task
}

function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true })
  }
}

async function createAxiosDownloadConfig(): Promise<Record<string, unknown>> {
  const { 'mixed-port': mixedPort = 7890 } = await getControledMihomoConfig()
  return mixedPort !== 0
    ? {
        proxy: {
          protocol: 'http',
          host: '127.0.0.1',
          port: mixedPort
        }
      }
    : {}
}

async function downloadFile(url: string, targetPath: string): Promise<void> {
  const config = await createAxiosDownloadConfig()
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/octet-stream'
    },
    ...config
  })

  ensureDir(path.dirname(targetPath))
  await writeFile(targetPath, Buffer.from(response.data))
}

async function fetchText(url: string): Promise<string> {
  const config = await createAxiosDownloadConfig()
  const response = await axios.get<string>(url, {
    responseType: 'text',
    timeout: 10000,
    ...config
  })
  return response.data.trim()
}

async function fetchLatestGitHubReleaseAssets(repo: string): Promise<GitHubReleaseAsset[]> {
  const config = await createAxiosDownloadConfig()
  const response = await axios.get<GitHubReleaseResponse>(
    `https://api.github.com/repos/${repo}/releases/latest`,
    {
      timeout: 10000,
      headers: createGitHubJsonHeaders(),
      ...config
    }
  )
  return response.data.assets || []
}

async function fetchMihomoReleaseAssets(tag: string): Promise<GitHubReleaseAsset[]> {
  const config = await createAxiosDownloadConfig()
  const response = await axios.get<GitHubReleaseResponse>(
    `https://api.github.com/repos/MetaCubeX/mihomo/releases/tags/${encodeURIComponent(tag)}`,
    {
      timeout: 10000,
      headers: createGitHubJsonHeaders(),
      ...config
    }
  )
  return response.data.assets || []
}

function scoreTrafficMonitorAssetName(name: string): number {
  let value = 0
  if (name.includes('lite')) value += 10
  if (name.includes('portable')) value += 1
  return value
}

function pickTrafficMonitorAsset(assets: GitHubReleaseAsset[], arch: string): GitHubReleaseAsset {
  const archPatterns: Record<string, RegExp[]> = {
    x64: [/(^|[-_. ])x64($|[-_. ])/, /amd64/],
    ia32: [/(^|[-_. ])x86($|[-_. ])/, /(^|[-_. ])386($|[-_. ])/],
    arm64: [/arm64ec/, /(^|[-_. ])arm64($|[-_. ])/]
  }

  const patterns = archPatterns[arch]
  if (!patterns) {
    throw new Error(`unsupported TrafficMonitor arch "${arch}"`)
  }

  const candidates = assets
    .map((asset) => ({
      asset,
      normalizedName: asset.name.toLowerCase()
    }))
    .filter(({ normalizedName }) => normalizedName.endsWith('.zip'))
    .filter(({ normalizedName }) => normalizedName.includes('trafficmonitor'))
    .filter(({ normalizedName }) => patterns.some((pattern) => pattern.test(normalizedName)))
    .sort((a, b) => scoreTrafficMonitorAssetName(a.normalizedName) - scoreTrafficMonitorAssetName(b.normalizedName))
    .map(({ asset }) => asset)

  if (candidates.length === 0) {
    throw new Error(`No matched TrafficMonitor asset found for ${arch}`)
  }

  return candidates[0]
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

function matchMihomoAssetName(
  assetName: string,
  version: string,
  ext: string,
  prefixes: string[]
): boolean {
  const suffix = `-${version}${ext}`
  if (!assetName.endsWith(suffix)) return false

  return prefixes.some((prefix) => {
    if (!assetName.startsWith(prefix)) return false
    const middle = assetName.slice(prefix.length, assetName.length - suffix.length)
    return (
      middle === '' ||
      middle === '-alpha' ||
      /^-alpha-go\d+$/.test(middle) ||
      /^-alpha-[\w.-]+$/.test(middle)
    )
  })
}

function scoreMihomoAssetName(assetName: string, version: string, ext: string): number {
  const suffix = `-${version}${ext}`
  const middle = assetName.slice(0, assetName.length - suffix.length)
  if (middle.endsWith('-alpha')) return 0
  if (/-alpha-go\d+$/.test(middle)) return 1
  return 2
}

function pickBestMihomoAlphaAsset(
  assets: GitHubReleaseAsset[],
  version: string,
  ext: string,
  prefixes: string[]
): GitHubReleaseAsset {
  const matched = assets
    .filter((asset) => matchMihomoAssetName(asset.name, version, ext, prefixes))
    .sort((a, b) => {
      const prefixIndexA = prefixes.findIndex((prefix) => a.name.startsWith(prefix))
      const prefixIndexB = prefixes.findIndex((prefix) => b.name.startsWith(prefix))
      if (prefixIndexA !== prefixIndexB) return prefixIndexA - prefixIndexB
      return scoreMihomoAssetName(a.name, version, ext) - scoreMihomoAssetName(b.name, version, ext)
    })

  if (matched.length === 0) {
    throw new Error(`No matched mihomo alpha asset found for ${process.platform}-${process.arch} (${version})`)
  }

  return matched[0]
}

function findExecutableEntry(zipEntries: AdmZip.IZipEntry[]): AdmZip.IZipEntry | undefined {
  return zipEntries.find(
    (entry) => !entry.isDirectory && (entry.entryName.endsWith('.exe') || entry.entryName.includes('mihomo'))
  )
}

function getOptionalRuntimeFilePath(relativePath: string): string {
  return path.join(OPTIONAL_RUNTIME_FILES_DIR, relativePath)
}

function getBundledSidecarPath(core: 'mihomo' | 'mihomo-alpha'): string {
  return path.join(
    resourcesDir(),
    'sidecar',
    `${core}${process.platform === 'win32' ? '.exe' : ''}`
  )
}

export function getOptionalMihomoAlphaPath(): string {
  return path.join(
    OPTIONAL_RUNTIME_SIDECAR_DIR,
    `mihomo-alpha${process.platform === 'win32' ? '.exe' : ''}`
  )
}

export async function ensureMihomoCoreAvailable(
  core: 'mihomo' | 'mihomo-alpha'
): Promise<string> {
  if (core === 'mihomo-alpha') {
    return await ensureMihomoAlphaPath()
  }

  return getBundledSidecarPath(core)
}

async function ensureOptionalExecutable(
  key: string,
  bundledPath: string,
  runtimePath: string,
  downloadUrl: string
): Promise<string> {
  if (existsSync(bundledPath)) {
    return bundledPath
  }
  if (existsSync(runtimePath)) {
    return runtimePath
  }

  return await withDownloadLock(key, async () => {
    if (existsSync(runtimePath)) {
      return runtimePath
    }

    await downloadFile(downloadUrl, runtimePath)
    return runtimePath
  })
}

export async function ensureEnableLoopbackPath(): Promise<string> {
  return await ensureOptionalExecutable(
    'enableLoopback',
    path.join(resourcesDir(), 'files', 'enableLoopback.exe'),
    getOptionalRuntimeFilePath('enableLoopback.exe'),
    ENABLE_LOOPBACK_URL
  )
}

export async function ensure7ZipPath(): Promise<string> {
  if (process.platform !== 'win32') {
    throw new Error('7za.exe is only available on Windows')
  }

  return await ensureOptionalExecutable(
    '7za',
    path.join(resourcesFilesDir(), '7za.exe'),
    getOptionalRuntimeFilePath('7za.exe'),
    `https://github.com/develar/7zip-bin/raw/master/win/${process.arch}/7za.exe`
  )
}

export async function ensureTrafficMonitorBinary(): Promise<{
  executablePath: string
  cwd: string
}> {
  const bundledRoot = path.join(resourcesFilesDir(), 'TrafficMonitor')
  const bundledExecutablePath = path.join(bundledRoot, 'TrafficMonitor', 'TrafficMonitor.exe')

  if (existsSync(bundledExecutablePath)) {
    return {
      executablePath: bundledExecutablePath,
      cwd: path.join(bundledRoot, 'TrafficMonitor')
    }
  }

  const runtimeRoot = getOptionalRuntimeFilePath('TrafficMonitor')
  const runtimeExecutablePath = path.join(runtimeRoot, 'TrafficMonitor', 'TrafficMonitor.exe')
  if (existsSync(runtimeExecutablePath)) {
    return {
      executablePath: runtimeExecutablePath,
      cwd: path.join(runtimeRoot, 'TrafficMonitor')
    }
  }

  const executablePath = await withDownloadLock('TrafficMonitor', async () => {
    if (existsSync(runtimeExecutablePath)) {
      return runtimeExecutablePath
    }

    const assets = await fetchLatestGitHubReleaseAssets(TRAFFIC_MONITOR_REPO)
    const asset = pickTrafficMonitorAsset(assets, process.arch)
    const tempDir = path.join(os.tmpdir(), 'routex-traffic-monitor')
    const tempZip = path.join(tempDir, `${process.arch}.zip`)

    ensureDir(tempDir)
    await downloadFile(asset.browser_download_url, tempZip)

    const zip = new AdmZip(tempZip)
    ensureDir(runtimeRoot)
    zip.extractAllTo(runtimeRoot, true)
    await unlink(tempZip).catch(() => {})

    return runtimeExecutablePath
  })

  return {
    executablePath,
    cwd: path.dirname(executablePath)
  }
}

export async function ensureMihomoAlphaPath(): Promise<string> {
  const bundledPath = getBundledSidecarPath('mihomo-alpha')
  if (existsSync(bundledPath)) {
    return bundledPath
  }

  const targetPath = getOptionalMihomoAlphaPath()
  if (existsSync(targetPath)) {
    return targetPath
  }

  return await withDownloadLock('mihomo-alpha', async () => {
    if (existsSync(targetPath)) {
      return targetPath
    }

    ensureDir(path.dirname(targetPath))

    const version = await fetchText(MIHOMO_ALPHA_VERSION_URL)
    const platform = os.platform()
    const arch = os.arch()
    const ext = platform === 'win32' ? '.zip' : '.gz'
    const asset = pickBestMihomoAlphaAsset(
      await fetchMihomoReleaseAssets('Prerelease-Alpha'),
      version,
      ext,
      getAssetPrefixCandidates(platform, arch)
    )

    const tempDir = path.join(os.tmpdir(), 'routex-alpha-core')
    const tempFile = path.join(tempDir, asset.name)
    ensureDir(tempDir)
    await downloadFile(asset.browser_download_url, tempFile)

    if (asset.name.endsWith('.zip')) {
      const zip = new AdmZip(tempFile)
      const exeEntry = findExecutableEntry(zip.getEntries())
      if (!exeEntry) {
        throw new Error('Invalid mihomo alpha zip: No executable found')
      }
      zip.extractEntryTo(exeEntry, path.dirname(targetPath), false, true)
      const extractedName = path.join(path.dirname(targetPath), exeEntry.name)
      if (extractedName !== targetPath) {
        if (existsSync(targetPath)) {
          await unlink(targetPath).catch(() => {})
        }
        await rename(extractedName, targetPath)
      }
    } else if (asset.name.endsWith('.gz')) {
      const source = await readFile(tempFile)
      const unzipped = zlib.gunzipSync(source)
      await writeFile(targetPath, unzipped)
      await chmod(targetPath, 0o755).catch(() => {})
    }

    await unlink(tempFile).catch(() => {})
    return targetPath
  })
}
