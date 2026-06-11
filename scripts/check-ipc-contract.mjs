import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(__filename), '..')

const rustIpcFiles = [
  'src-tauri/src/desktop/ipc/config.rs',
  'src-tauri/src/desktop/ipc/mihomo.rs',
  'src-tauri/src/desktop/ipc/network.rs',
  'src-tauri/src/desktop/ipc/shell.rs',
  'src-tauri/src/desktop/ipc/system.rs'
]

const tsIpcFiles = [
  'src/shared/ipc/invoke-config.ts',
  'src/shared/ipc/invoke-mihomo.ts',
  'src/shared/ipc/invoke-network.ts',
  'src/shared/ipc/invoke-system.ts'
]

const sendChannelsFile = 'src/shared/ipc/send-channels.ts'
const desktopBridgeFile = 'src/renderer/src/api/desktop.ts'
const globalConfirmModalsFile = 'src/renderer/src/components/base/GlobalConfirmModals.tsx'

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function collectRustChannels() {
  const channels = new Set()
  for (const file of rustIpcFiles) {
    const source = readRepoFile(file)
    for (const match of source.matchAll(/map\.insert\(\s*["']([^"']+)["']/g)) {
      channels.add(match[1])
    }
  }
  return channels
}

function collectTypescriptChannels() {
  const channels = new Set()
  for (const file of tsIpcFiles) {
    const source = readRepoFile(file)
    for (const match of source.matchAll(/\b[A-Za-z][A-Za-z0-9_]*\s*:\s*['"]([^'"]+)['"]/g)) {
      channels.add(match[1])
    }
  }
  return channels
}

function collectTypescriptSendChannels() {
  const channels = new Set()
  const source = readRepoFile(sendChannelsFile)
  for (const match of source.matchAll(/\b[A-Za-z][A-Za-z0-9_]*\s*:\s*['"]([^'"]+)['"]/g)) {
    channels.add(match[1])
  }
  return channels
}

function collectTauriSendForwardTargets() {
  const source = readRepoFile(desktopBridgeFile)
  const mapSource =
    source.match(/const invokeChannelMap:[\s\S]*?=\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? ''
  const sendChannels = new Set()
  const invokeTargets = new Set()

  for (const match of mapSource.matchAll(/['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g)) {
    sendChannels.add(match[1])
    invokeTargets.add(match[2])
  }

  for (const match of mapSource.matchAll(/\n\s*([A-Za-z][A-Za-z0-9_]*)\s*:\s*['"]([^'"]+)['"]/g)) {
    sendChannels.add(match[1])
    invokeTargets.add(match[2])
  }

  return { sendChannels, invokeTargets }
}

function collectLocalCustomEventResultChannels() {
  const channels = new Set()
  const source = readRepoFile(globalConfirmModalsFile)
  for (const match of source.matchAll(
    /dispatchInstallConfirmResult\(\s*['"]routex:([^'"]+)['"]/g
  )) {
    channels.add(match[1])
  }
  return channels
}

function difference(left, right) {
  return [...left].filter((item) => !right.has(item)).sort()
}

const rustChannels = collectRustChannels()
const tsChannels = collectTypescriptChannels()
const tsSendChannels = collectTypescriptSendChannels()
const tauriSendForward = collectTauriSendForwardTargets()
const localCustomEventResultChannels = collectLocalCustomEventResultChannels()
const declaredTauriChannels = new Set([...tsChannels, ...tauriSendForward.invokeTargets])
const missingRustHandlers = difference(tsChannels, rustChannels)
const missingTypescriptDeclarations = difference(rustChannels, declaredTauriChannels)
const handledSendChannels = new Set([
  ...tauriSendForward.sendChannels,
  ...localCustomEventResultChannels
])
const missingTauriSendForwards = difference(tsSendChannels, handledSendChannels)
const missingRustHandlersForSendForwards = difference(tauriSendForward.invokeTargets, rustChannels)

if (
  missingRustHandlers.length > 0 ||
  missingTypescriptDeclarations.length > 0 ||
  missingTauriSendForwards.length > 0 ||
  missingRustHandlersForSendForwards.length > 0
) {
  if (missingRustHandlers.length > 0) {
    console.error('\nTypeScript declares invoke channels without Rust handlers:')
    for (const channel of missingRustHandlers) {
      console.error(`  - ${channel}`)
    }
  }

  if (missingTypescriptDeclarations.length > 0) {
    console.error('\nRust registers invoke handlers without TypeScript declarations:')
    for (const channel of missingTypescriptDeclarations) {
      console.error(`  - ${channel}`)
    }
  }

  if (missingTauriSendForwards.length > 0) {
    console.error('\nTypeScript declares send channels without Tauri forwarding entries:')
    for (const channel of missingTauriSendForwards) {
      console.error(`  - ${channel}`)
    }
  }

  if (missingRustHandlersForSendForwards.length > 0) {
    console.error('\nTauri send forwarding targets are missing Rust handlers:')
    for (const channel of missingRustHandlersForSendForwards) {
      console.error(`  - ${channel}`)
    }
  }

  process.exit(1)
}

console.log(
  `IPC contract guard passed (${tsChannels.size} invoke channels, ${tsSendChannels.size} send channels)`
)
