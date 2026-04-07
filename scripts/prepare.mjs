import fs from 'fs'
import AdmZip from 'adm-zip'
import path from 'path'
import zlib from 'zlib'
import { extract } from 'tar'
import { execSync } from 'child_process'

const cwd = process.cwd()
const TEMP_DIR = path.join(cwd, 'node_modules/.temp')
const BUILD_DIR = path.join(cwd, 'build')
const RESOURCES_DIR = path.join(cwd, 'resources')
const ROUTEX_SERVICE_RELEASE_PREFIX =
  'https://github.com/Jarv1s0/routex-service/releases/download/pre-release'
const ROUTEX_SERVICE_ASSETS = {
  'win32-x64': 'routex-service-windows-amd64-v3',
  'win32-ia32': 'routex-service-windows-386',
  'win32-arm64': 'routex-service-windows-arm64',
  'darwin-x64': 'routex-service-darwin-amd64-v3',
  'darwin-arm64': 'routex-service-darwin-arm64',
  'linux-x64': 'routex-service-linux-amd64-v3',
  'linux-arm64': 'routex-service-linux-arm64',
  'linux-loong64': 'routex-service-linux-loong64-abi2'
}
const ROUTEX_RUN_ASSETS = {
  x64: 'routex-run-windows-amd64-v3.exe',
  ia32: 'routex-run-windows-386.exe',
  arm64: 'routex-run-windows-arm64.exe'
}
const TRAFFIC_MONITOR_REPO = 'zhongyang219/TrafficMonitor'
const DEFAULT_TASK_RETRY = 5
let arch = process.arch
const platform = process.platform
if (process.argv.slice(2).length !== 0) {
  arch = process.argv.slice(2)[0].replace('--', '')
}

function isLockedFileError(error) {
  return platform === 'win32' && (error?.code === 'EPERM' || error?.code === 'EACCES')
}

function tryRemoveExisting(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    return true
  }

  try {
    fs.rmSync(targetPath, { recursive: true, force: true })
    return true
  } catch (error) {
    if (isLockedFileError(error)) {
      console.warn(`[WARN]: skip updating ${label}, file is locked: ${targetPath}`)
      return false
    }
    throw error
  }
}

if (process.env.SKIP_PREPARE === '1') {
  console.log('Skipping prepare script...')
  process.exit(0)
}

function syncBuildIcons() {
  const iconFiles = ['icon.icns', 'icon.ico', 'icon.png', 'installerIcon.ico']

  fs.mkdirSync(BUILD_DIR, { recursive: true })

  for (const file of iconFiles) {
    const sourcePath = path.join(RESOURCES_DIR, file)
    const targetPath = path.join(BUILD_DIR, file)

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`missing icon resource: ${sourcePath}`)
    }

    fs.copyFileSync(sourcePath, targetPath)
  }

  console.log('[INFO]: build icon assets synced')
}

const MIHOMO_ALPHA_VERSION_URL =
  'https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha/version.txt'
const MIHOMO_VERSION_URL =
  'https://github.com/MetaCubeX/mihomo/releases/latest/download/version.txt'

const GITHUB_JSON_HEADERS = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'RouteX'
}

function createGitHubJsonHeaders() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_API_TOKEN
  return token
    ? {
        ...GITHUB_JSON_HEADERS,
        Authorization: `Bearer ${token}`
      }
    : GITHUB_JSON_HEADERS
}

function getAssetPrefixCandidates(platform, arch) {
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
      throw new Error(`unsupported platform "${key}"`)
  }
}

function matchAssetName(assetName, version, isAlpha, ext, prefixes) {
  const suffix = `-${version}${ext}`
  if (!assetName.endsWith(suffix)) return false

  return prefixes.some((prefix) => {
    if (!assetName.startsWith(prefix)) return false
    const middle = assetName.slice(prefix.length, assetName.length - suffix.length)
    if (isAlpha) {
      return (
        middle === '' ||
        middle === '-alpha' ||
        /^-alpha-go\d+$/.test(middle) ||
        /^-alpha-[\w.-]+$/.test(middle)
      )
    }
    return middle === '' || /^-go\d+$/.test(middle)
  })
}

function scoreAssetName(assetName, version, isAlpha, ext) {
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

function pickBestReleaseAsset(assets, version, isAlpha, ext, prefixes) {
  const matched = assets
    .filter((asset) => matchAssetName(asset.name, version, isAlpha, ext, prefixes))
    .sort((a, b) => {
      const prefixIndexA = prefixes.findIndex((prefix) => a.name.startsWith(prefix))
      const prefixIndexB = prefixes.findIndex((prefix) => b.name.startsWith(prefix))
      if (prefixIndexA !== prefixIndexB) return prefixIndexA - prefixIndexB
      return scoreAssetName(a.name, version, isAlpha, ext) - scoreAssetName(b.name, version, isAlpha, ext)
    })

  if (matched.length === 0) {
    throw new Error(`No matched mihomo asset found for ${platform}-${arch} (${version})`)
  }

  return matched[0]
}

function findExecutableEntry(entries, name) {
  return entries.find((entry) => {
    console.log(`[DEBUG]: "${name}" entry name`, entry.entryName)
    return !entry.isDirectory && (entry.entryName.endsWith('.exe') || entry.entryName.includes('mihomo'))
  })
}

async function fetchReleaseAssets(tag) {
  return fetchGitHubReleaseAssets(
    `https://api.github.com/repos/MetaCubeX/mihomo/releases/tags/${encodeURIComponent(tag)}`,
    'mihomo release assets'
  )
}

async function fetchGitHubReleaseAssets(url, label) {
  const response = await fetch(url, {
    method: 'GET',
    headers: createGitHubJsonHeaders()
  })
  if (!response.ok) {
    throw new Error(`failed to fetch ${label}: ${response.status}`)
  }
  const json = await response.json()
  return json.assets || []
}

async function fetchLatestGitHubReleaseAssets(repo) {
  return fetchGitHubReleaseAssets(
    `https://api.github.com/repos/${repo}/releases/latest`,
    `${repo} latest release assets`
  )
}

function scoreTrafficMonitorAssetName(name) {
  let value = 0
  if (name.includes('lite')) value += 10
  if (name.includes('portable')) value += 1
  return value
}

function pickTrafficMonitorAsset(assets, arch) {
  const archPatterns = {
    x64: [/(^|[-_. ])x64($|[-_. ])/, /amd64/],
    ia32: [/(^|[-_. ])x86($|[-_. ])/, /(^|[-_. ])386($|[-_. ])/],
    arm64: [/arm64ec/, /(^|[-_. ])arm64($|[-_. ])/]
  }

  const patterns = archPatterns[arch]
  if (!patterns) {
    throw new Error(`unsupported monitor arch "${arch}"`)
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

function buildFallbackReleaseAsset(version, isAlpha, prefixes) {
  const prefix = prefixes[0]
  const ext = platform === 'win32' ? '.zip' : '.gz'
  const fileName = `${prefix}-${version}${ext}`
  const tag = isAlpha ? 'Prerelease-Alpha' : version

  return {
    name: fileName,
    browser_download_url: `https://github.com/MetaCubeX/mihomo/releases/download/${tag}/${fileName}`
  }
}

async function resolveReleaseAsset(version, isAlpha) {
  const ext = platform === 'win32' ? '.zip' : '.gz'
  const prefixes = getAssetPrefixCandidates(platform, arch)
  const tag = isAlpha ? 'Prerelease-Alpha' : version
  try {
    const assets = await fetchReleaseAssets(tag)
    return pickBestReleaseAsset(assets, version, isAlpha, ext, prefixes)
  } catch (error) {
    console.warn(
      `[WARN]: failed to resolve mihomo asset from release API, falling back to legacy naming: ${error.message}`
    )
    return buildFallbackReleaseAsset(version, isAlpha, prefixes)
  }
}

async function getLatestVersion(url, label) {
  try {
    const response = await fetch(url, {
      method: 'GET'
    })
    const version = (await response.text()).trim()
    console.log(`Latest ${label} version: ${version}`)
    return version
  } catch (error) {
    console.error(`Error fetching latest ${label} version:`, error.message)
    process.exit(1)
  }
}

/*
 * check available
 */
getAssetPrefixCandidates(platform, arch)
syncBuildIcons()

/**
 * core info
 */
async function createMihomoBinaryInfo(name, versionUrl, isAlpha) {
  const isWin = platform === 'win32'
  const version = await getLatestVersion(versionUrl, isAlpha ? 'alpha' : 'release')
  const asset = await resolveReleaseAsset(version, isAlpha)

  return {
    name,
    targetFile: `${name}${isWin ? '.exe' : ''}`,
    zipFile: asset.name,
    downloadURL: asset.browser_download_url
  }
}
/**
 * download sidecar and rename
 */
async function resolveSidecar(binInfo) {
  const { name, targetFile, zipFile, downloadURL } = binInfo

  const sidecarDir = path.join(cwd, 'extra', 'sidecar')
  const sidecarPath = path.join(sidecarDir, targetFile)

  fs.mkdirSync(sidecarDir, { recursive: true })
  if (!tryRemoveExisting(sidecarPath, name)) {
    return
  }
  const tempDir = path.join(TEMP_DIR, name)
  const tempZip = path.join(tempDir, zipFile)

  fs.mkdirSync(tempDir, { recursive: true })
  try {
    if (!fs.existsSync(tempZip)) {
      await downloadFile(downloadURL, tempZip)
    }

    if (zipFile.endsWith('.zip')) {
      const zip = new AdmZip(tempZip)
      const exeEntry = findExecutableEntry(zip.getEntries(), name)
      if (!exeEntry) {
        throw new Error(`Expected executable not found in ${zipFile}`)
      }
      zip.extractAllTo(tempDir, true)
      const extractedExe = path.join(tempDir, exeEntry.entryName)
      fs.renameSync(extractedExe, sidecarPath)
      console.log(`[INFO]: "${name}" unzip finished`)
    } else if (zipFile.endsWith('.tgz')) {
      // tgz
      fs.mkdirSync(tempDir, { recursive: true })
      await extract({
        cwd: tempDir,
        file: tempZip
      })
      const files = fs.readdirSync(tempDir)
      console.log(`[DEBUG]: "${name}" files in tempDir:`, files)
      const extractedFile = files.find((file) => file.startsWith('虚空终端-'))
      if (extractedFile) {
        const extractedFilePath = path.join(tempDir, extractedFile)
        fs.renameSync(extractedFilePath, sidecarPath)
        console.log(`[INFO]: "${name}" file renamed to "${sidecarPath}"`)
        execSync(`chmod 755 ${sidecarPath}`)
        console.log(`[INFO]: "${name}" chmod binary finished`)
      } else {
        throw new Error(`Expected file not found in ${tempDir}`)
      }
    } else {
      // gz
      const readStream = fs.createReadStream(tempZip)
      const writeStream = fs.createWriteStream(sidecarPath)
      await new Promise((resolve, reject) => {
        const onError = (error) => {
          console.error(`[ERROR]: "${name}" gz failed:`, error.message)
          reject(error)
        }
        readStream
          .pipe(zlib.createGunzip().on('error', onError))
          .pipe(writeStream)
          .on('finish', () => {
            console.log(`[INFO]: "${name}" gunzip finished`)
            execSync(`chmod 755 ${sidecarPath}`)
            console.log(`[INFO]: "${name}" chmod binary finished`)
            resolve()
          })
          .on('error', onError)
      })
    }
  } catch (err) {
    // 需要删除文件
    fs.rmSync(sidecarPath)
    throw err
  } finally {
    fs.rmSync(tempDir, { recursive: true })
  }
}

/**
 * download the file to the extra dir
 */
async function resolveResource(binInfo) {
  const { file, downloadURL, needExecutable = false } = binInfo

  const resDir = path.join(cwd, 'extra', 'files')
  const targetPath = path.join(resDir, file)

  if (!tryRemoveExisting(targetPath, file)) {
    return
  }

  fs.mkdirSync(resDir, { recursive: true })
  await downloadFile(downloadURL, targetPath)

  if (needExecutable && platform !== 'win32') {
    execSync(`chmod 755 ${targetPath}`)
    console.log(`[INFO]: ${file} chmod finished`)
  }

  console.log(`[INFO]: ${file} finished`)
}

/**
 * download file and save to `path`
 */
async function downloadFile(url, path) {
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/octet-stream' }
  })

  if (!response.ok) {
    throw new Error(`download failed "${url}": HTTP ${response.status}`)
  }

  const buffer = await response.arrayBuffer()
  fs.writeFileSync(path, new Uint8Array(buffer))

  console.log(`[INFO]: download finished "${url}"`)
}

function getMappedAsset(map, key, label) {
  const asset = map[key]
  if (!asset) {
    throw new Error(`unsupported ${label} "${key}"`)
  }
  return asset
}

const resolveMmdb = () =>
  resolveResource({
    file: 'country.mmdb',
    downloadURL: `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country-lite.mmdb`
  })
const resolveMetadb = () =>
  resolveResource({
    file: 'geoip.metadb',
    downloadURL: `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.metadb`
  })
const resolveGeosite = () =>
  resolveResource({
    file: 'geosite.dat',
    downloadURL: `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat`
  })
const resolveGeoIP = () =>
  resolveResource({
    file: 'geoip.dat',
    downloadURL: `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.dat`
  })
const resolveASN = () =>
  resolveResource({
    file: 'ASN.mmdb',
    downloadURL: `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/GeoLite2-ASN.mmdb`
  })
const resolveEnableLoopback = () =>
  resolveResource({
    file: 'enableLoopback.exe',
    downloadURL: `https://github.com/Kuingsmile/uwp-tool/releases/download/latest/enableLoopback.exe`
  })
const resolveRoutexService = () => {
  const key = `${platform}-${arch}`
  const base = getMappedAsset(ROUTEX_SERVICE_ASSETS, key, 'platform')
  const ext = platform == 'win32' ? '.exe' : ''

  return resolveResource({
    file: `routex-service${ext}`,
    downloadURL: `${ROUTEX_SERVICE_RELEASE_PREFIX}/${base}${ext}`,
    needExecutable: true
  })
}
const resolveRunner = () => {
  const asset = getMappedAsset(ROUTEX_RUN_ASSETS, arch, 'runner arch')
  return resolveResource({
    file: 'routex-run.exe',
    downloadURL: `${ROUTEX_SERVICE_RELEASE_PREFIX}/${asset}`
  })
}

const resolveMonitor = async () => {
  const assets = await fetchLatestGitHubReleaseAssets(TRAFFIC_MONITOR_REPO)
  const asset = pickTrafficMonitorAsset(assets, arch)
  const tempDir = path.join(TEMP_DIR, 'TrafficMonitor')
  const tempZip = path.join(tempDir, `${arch}.zip`)
  fs.mkdirSync(tempDir, { recursive: true })
  await downloadFile(asset.browser_download_url, tempZip)
  const zip = new AdmZip(tempZip)
  const resDir = path.join(cwd, 'extra', 'files')
  const targetPath = path.join(resDir, 'TrafficMonitor')
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true })
  }
  zip.extractAllTo(targetPath, true)

  console.log(`[INFO]: TrafficMonitor finished`)
}

const resolve7zip = () =>
  resolveResource({
    file: '7za.exe',
    downloadURL: `https://github.com/develar/7zip-bin/raw/master/win/${arch}/7za.exe`
  })
const resolveSubstore = () =>
  resolveResource({
    file: 'sub-store.bundle.js',
    downloadURL:
      'https://github.com/sub-store-org/Sub-Store/releases/latest/download/sub-store.bundle.js'
  })
const resolveSubstoreFrontend = async () => {
  const tempDir = path.join(TEMP_DIR, 'substore-frontend')
  const tempZip = path.join(tempDir, 'dist.zip')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  await downloadFile(
    'https://github.com/sub-store-org/Sub-Store-Front-End/releases/latest/download/dist.zip',
    tempZip
  )
  const zip = new AdmZip(tempZip)
  const resDir = path.join(cwd, 'extra', 'files')
  const targetPath = path.join(resDir, 'sub-store-frontend')
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true })
  }
  zip.extractAllTo(resDir, true)
  fs.renameSync(path.join(resDir, 'dist'), targetPath)

  if (platform !== 'win32') {
    try {
      const fixPermissions = (dir) => {
        const items = fs.readdirSync(dir, { withFileTypes: true })
        for (const item of items) {
          const fullPath = path.join(dir, item.name)
          if (item.isDirectory()) {
            fs.chmodSync(fullPath, 0o755)
            fixPermissions(fullPath)
          } else {
            fs.chmodSync(fullPath, 0o644)
          }
        }
      }
      fs.chmodSync(targetPath, 0o755)
      fixPermissions(targetPath)
      console.log(`[INFO]: sub-store-frontend permissions fixed`)
    } catch (error) {
      console.warn(`[WARN]: Failed to fix permissions: ${error.message}`)
    }
  }

  console.log(`[INFO]: sub-store-frontend finished`)
}
const resolveFont = async () => {
  // const targetPath = path.join(cwd, 'src', 'renderer', 'src', 'assets', 'NotoColorEmoji.ttf')
  const targetPath = path.join(cwd, 'src', 'renderer', 'src', 'assets', 'twemoji.ttf')

  if (fs.existsSync(targetPath)) {
    return
  }
  await downloadFile(
    // 'https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf',
    'https://github.com/Sav22999/emoji/raw/refs/heads/master/font/twemoji.ttf',
    targetPath
  )

  console.log(`[INFO]: twemoji.ttf finished`)
}

const tasks = [
  {
    name: 'mihomo-alpha',
    func: async () =>
      resolveSidecar(await createMihomoBinaryInfo('mihomo-alpha', MIHOMO_ALPHA_VERSION_URL, true)),
    retry: DEFAULT_TASK_RETRY
  },
  {
    name: 'mihomo',
    func: async () =>
      resolveSidecar(await createMihomoBinaryInfo('mihomo', MIHOMO_VERSION_URL, false)),
    retry: DEFAULT_TASK_RETRY
  },
  { name: 'mmdb', func: resolveMmdb, retry: DEFAULT_TASK_RETRY },
  { name: 'metadb', func: resolveMetadb, retry: DEFAULT_TASK_RETRY },
  { name: 'geosite', func: resolveGeosite, retry: DEFAULT_TASK_RETRY },
  { name: 'geoip', func: resolveGeoIP, retry: DEFAULT_TASK_RETRY },
  { name: 'asn', func: resolveASN, retry: DEFAULT_TASK_RETRY },
  {
    name: 'font',
    func: resolveFont,
    retry: DEFAULT_TASK_RETRY
  },
  {
    name: 'enableLoopback',
    func: resolveEnableLoopback,
    retry: DEFAULT_TASK_RETRY,
    winOnly: true
  },
  {
    name: 'routex-service',
    func: resolveRoutexService,
    retry: DEFAULT_TASK_RETRY
  },
  {
    name: 'runner',
    func: resolveRunner,
    retry: DEFAULT_TASK_RETRY,
    winOnly: true
  },
  {
    name: 'monitor',
    func: resolveMonitor,
    retry: DEFAULT_TASK_RETRY,
    winOnly: true
  },
  {
    name: 'substore',
    func: resolveSubstore,
    retry: DEFAULT_TASK_RETRY
  },
  {
    name: 'substorefrontend',
    func: resolveSubstoreFrontend,
    retry: DEFAULT_TASK_RETRY
  },
  {
    name: '7zip',
    func: resolve7zip,
    retry: DEFAULT_TASK_RETRY,
    winOnly: true
  }
]

async function runTask() {
  while (true) {
    const task = tasks.shift()
    if (!task) return
    if (task.winOnly && platform !== 'win32') continue
    if (task.linuxOnly && platform !== 'linux') continue
    if (task.unixOnly && platform === 'win32') continue

    for (let i = 0; i < task.retry; i++) {
      try {
        await task.func()
        break
      } catch (err) {
        console.error(`[ERROR]: task::${task.name} try ${i} ==`, err.message)
        if (i === task.retry - 1) throw err
      }
    }
  }
}

runTask()
runTask()
