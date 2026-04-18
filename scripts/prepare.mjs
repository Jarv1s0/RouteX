import fs from 'fs'
import AdmZip from 'adm-zip'
import path from 'path'
import zlib from 'zlib'
import { extract } from 'tar'
import { execSync } from 'child_process'

const cwd = process.cwd()
const TEMP_DIR = path.join(cwd, 'node_modules/.temp')
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
const DEFAULT_TASK_RETRY = 5
const platform = process.platform
const OPTIONAL_EXTRA_PATHS = [
  path.join(cwd, 'extra', 'sidecar', platform === 'win32' ? 'mihomo-alpha.exe' : 'mihomo-alpha'),
  path.join(cwd, 'extra', 'files', 'enableLoopback.exe'),
  path.join(cwd, 'extra', 'files', 'TrafficMonitor'),
  path.join(cwd, 'extra', 'files', '7za.exe'),
  path.join(cwd, 'extra', 'files', 'sub-store.bundle.js'),
  path.join(cwd, 'extra', 'files', 'sub-store-frontend')
]
let arch = process.arch
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

function cleanupOptionalExtraResources() {
  for (const targetPath of OPTIONAL_EXTRA_PATHS) {
    const label = path.relative(cwd, targetPath) || targetPath
    tryRemoveExisting(targetPath, label)
  }
  console.log('[INFO]: optional extra resources cleaned')
}
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
    throw new Error(`Error fetching latest ${label} version: ${error.message}`)
  }
}

/*
 * check available
 */
getAssetPrefixCandidates(platform, arch)
cleanupOptionalExtraResources()

// Pre-create directories to ensure they exist for the build system
const sidecarDir = path.join(cwd, 'extra', 'sidecar')
const resDir = path.join(cwd, 'extra', 'files')
console.log(`[INFO]: Working directory: ${cwd}`)
console.log(`[INFO]: Ensuring directories exist: ${sidecarDir}, ${resDir}`)
fs.mkdirSync(sidecarDir, { recursive: true })
fs.mkdirSync(resDir, { recursive: true })

if (process.env.ROUTEX_SKIP_RESOURCE_REFRESH === 'true' || process.env.ROUTEX_SKIP_RESOURCE_REFRESH === '1') {
  console.log('[INFO]: resource refresh skipped by ROUTEX_SKIP_RESOURCE_REFRESH')
  process.exit(0)
}

/**
 * core info
 */
async function createMihomoBinaryInfo(name, versionUrl, isAlpha) {
  const isWin = platform === 'win32'
  try {
    const version = await getLatestVersion(versionUrl, isAlpha ? 'alpha' : 'release')
    const asset = await resolveReleaseAsset(version, isAlpha)

    return {
      name,
      targetFile: `${name}${isWin ? '.exe' : ''}`,
      zipFile: asset.name,
      downloadURL: asset.browser_download_url
    }
  } catch (error) {
    const targetFile = `${name}${isWin ? '.exe' : ''}`
    const sidecarPath = path.join(cwd, 'extra', 'sidecar', targetFile)
    if (fs.existsSync(sidecarPath)) {
      console.warn(
        `[WARN]: failed to refresh ${name}, keeping existing binary: ${error.message}`
      )
      return null
    }
    throw error
  }
}
/**
 * download sidecar and rename
 */
async function resolveSidecar(binInfo) {
  if (!binInfo) {
    return
  }

  const { name, targetFile, zipFile, downloadURL } = binInfo

  const sidecarDir = path.join(cwd, 'extra', 'sidecar')
  const sidecarPath = path.join(sidecarDir, targetFile)

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
    if (!fs.existsSync(sidecarPath)) {
      throw err
    }
    console.warn(`[WARN]: failed to refresh "${name}", keeping existing binary: ${err.message}`)
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
  const hadExisting = fs.existsSync(targetPath)
  const tempPath = `${targetPath}.tmp`

  try {
    await downloadFile(downloadURL, tempPath)
    if (hadExisting) {
      fs.rmSync(targetPath, { force: true })
    }
    fs.renameSync(tempPath, targetPath)
  } catch (error) {
    fs.rmSync(tempPath, { force: true })
    if (hadExisting) {
      console.warn(
        `[WARN]: failed to refresh "${file}", keeping existing resource: ${error.message}`
      )
      return
    }
    throw error
  }

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
const resolveFont = async () => {
  // const targetPath = path.join(cwd, 'src', 'renderer', 'src', 'assets', 'NotoColorEmoji.ttf')
  const targetPath = path.join(cwd, 'src', 'renderer', 'src', 'assets', 'twemoji.ttf')

  if (fs.existsSync(targetPath)) {
    return
  }
  try {
    await downloadFile(
      // 'https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf',
      'https://github.com/Sav22999/emoji/raw/refs/heads/master/font/twemoji.ttf',
      targetPath
    )
  } catch (error) {
    if (fs.existsSync(targetPath)) {
      console.warn(`[WARN]: failed to refresh twemoji font, keeping existing file: ${error.message}`)
      return
    }
    throw error
  }

  console.log(`[INFO]: twemoji.ttf finished`)
}

const tasks = [
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
    name: 'routex-service',
    func: resolveRoutexService,
    retry: DEFAULT_TASK_RETRY
  },
  {
    name: 'runner',
    func: resolveRunner,
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

await Promise.all([runTask(), runTask()])
