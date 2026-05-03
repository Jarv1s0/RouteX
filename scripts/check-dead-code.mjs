import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(__filename), '..')
const rendererRoot = path.join(repoRoot, 'src', 'renderer', 'src')
const sharedIpcRoot = path.join(repoRoot, 'src', 'shared', 'ipc')

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css'])
const MODULE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css']
const RENDERER_ENTRY_FILES = new Set([
  'App.tsx',
  'FloatingApp.tsx',
  'TrayMenuApp.tsx',
  'floating.tsx',
  'main.tsx',
  'traymenu.tsx'
])
const PACKAGE_SCRIPT_DEPENDENCIES = new Set([
  '@tauri-apps/cli',
  'eslint',
  'prettier',
  'typescript',
  'vite'
])

function walkFiles(dir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['.git', 'dist-tauri', 'node_modules', 'target'].includes(entry.name)) continue
      files.push(...walkFiles(fullPath))
      continue
    }

    if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath)
    }
  }
  return files
}

function normalizePath(filePath) {
  return filePath.replaceAll(path.sep, '/')
}

function withoutExtension(filePath) {
  return normalizePath(filePath).replace(/\.(ts|tsx|js|jsx|mjs|cjs|css)$/, '')
}

function buildModuleIndex(files) {
  const index = new Map()
  for (const filePath of files) {
    index.set(normalizePath(filePath), filePath)
    const key = withoutExtension(filePath)
    index.set(key, filePath)
    if (path.basename(key) === 'index') {
      index.set(normalizePath(path.dirname(key)), filePath)
    }
  }
  return index
}

function resolveLocalModule(specifier, fromFile, moduleIndex) {
  let targetPath
  if (specifier.startsWith('@renderer/')) {
    targetPath = path.join(rendererRoot, specifier.slice('@renderer/'.length))
  } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    targetPath = path.resolve(path.dirname(fromFile), specifier)
  } else {
    return null
  }

  const normalized = normalizePath(targetPath)
  if (moduleIndex.has(normalized)) return moduleIndex.get(normalized)
  const normalizedWithoutExtension = normalized.replace(/\.(ts|tsx|js|jsx|mjs|cjs|css)$/, '')
  if (moduleIndex.has(normalizedWithoutExtension)) return moduleIndex.get(normalizedWithoutExtension)
  for (const ext of MODULE_EXTENSIONS) {
    const withExt = `${normalized}${ext}`
    if (fs.existsSync(withExt)) return withExt
  }
  return moduleIndex.get(`${normalized}/index`) ?? null
}

function collectSpecifiers(source) {
  const specifiers = []
  const patterns = [
    /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /@(import|plugin|source)\s+['"]([^'"]+)['"]/g
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(source))) {
      specifiers.push(match[2] ?? match[1])
    }
  }

  return specifiers
}

function packageName(specifier) {
  if (
    !specifier ||
    specifier.startsWith('.') ||
    specifier.startsWith('/') ||
    specifier.startsWith('@renderer/') ||
    specifier.startsWith('@shared/')
  ) {
    return null
  }

  return specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]
}

function checkRendererReachability() {
  const files = walkFiles(rendererRoot).filter((filePath) => !filePath.endsWith('.d.ts'))
  const moduleIndex = buildModuleIndex(files)
  const incoming = new Map(files.map((filePath) => [filePath, 0]))

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8')
    for (const specifier of collectSpecifiers(source)) {
      const target = resolveLocalModule(specifier, filePath, moduleIndex)
      if (target && incoming.has(target)) {
        incoming.set(target, incoming.get(target) + 1)
      }
    }
  }

  return [...incoming.entries()]
    .filter(([filePath, count]) => {
      if (count > 0) return false
      if (RENDERER_ENTRY_FILES.has(path.basename(filePath))) return false
      const normalized = normalizePath(path.relative(rendererRoot, filePath))
      return !normalized.startsWith('pages/') && !normalized.startsWith('routes/')
    })
    .map(([filePath]) => normalizePath(path.relative(repoRoot, filePath)))
    .sort()
}

function checkInvokeChannels() {
  const channelFiles = [
    'invoke-config.ts',
    'invoke-mihomo.ts',
    'invoke-network.ts',
    'invoke-system.ts'
  ].map((fileName) => path.join(sharedIpcRoot, fileName))

  const declared = new Set()
  for (const filePath of channelFiles) {
    const source = fs.readFileSync(filePath, 'utf8')
    for (const match of source.matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\s*:\s*['"][^'"]+['"]/g)) {
      declared.add(match[1])
    }
  }

  const usageFiles = [
    ...walkFiles(rendererRoot),
    ...walkFiles(path.join(repoRoot, 'src', 'shared')).filter((filePath) => !normalizePath(filePath).includes('/src/shared/ipc/'))
  ]
  const used = new Set()
  for (const filePath of usageFiles) {
    const source = fs.readFileSync(filePath, 'utf8')
    for (const match of source.matchAll(/\bC\.([A-Za-z][A-Za-z0-9_]*)\b/g)) {
      used.add(match[1])
    }
  }

  return [...declared].filter((channel) => !used.has(channel)).sort()
}

function checkPackageDependencies() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
  const dependencyNames = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {})
  ])
  const sourceFiles = [
    path.join(repoRoot, 'eslint.config.cjs'),
    path.join(repoRoot, 'vite.tauri.config.ts'),
    ...walkFiles(path.join(repoRoot, 'scripts')),
    ...walkFiles(path.join(repoRoot, 'src'))
  ].filter((filePath) => fs.existsSync(filePath))
  const usedPackages = new Set(PACKAGE_SCRIPT_DEPENDENCIES)

  for (const filePath of sourceFiles) {
    const source = fs.readFileSync(filePath, 'utf8')
    for (const specifier of collectSpecifiers(source)) {
      const name = packageName(specifier)
      if (name) usedPackages.add(name)
    }
  }

  return [...dependencyNames]
    .filter((name) => !name.startsWith('@types/'))
    .filter((name) => !usedPackages.has(name))
    .sort()
}

const failures = []
const unreachableRendererFiles = checkRendererReachability()
const unusedInvokeChannels = checkInvokeChannels()
const unusedDependencies = checkPackageDependencies()

if (unreachableRendererFiles.length > 0) {
  failures.push(['Unreachable renderer files', unreachableRendererFiles])
}
if (unusedInvokeChannels.length > 0) {
  failures.push(['Unused invoke channels', unusedInvokeChannels])
}
if (unusedDependencies.length > 0) {
  failures.push(['Unused package dependencies', unusedDependencies])
}

if (failures.length > 0) {
  for (const [title, items] of failures) {
    console.error(`\n${title}:`)
    for (const item of items) {
      console.error(`  - ${item}`)
    }
  }
  process.exit(1)
}

console.log('Dead-code guard passed')
