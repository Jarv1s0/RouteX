import path from 'node:path'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(__filename), '..')
const lockfile = path.join(repoRoot, 'src-tauri', 'Cargo.lock')

const result = spawnSync(
  'cargo',
  ['audit', '--format', 'json', '--file', lockfile],
  {
    cwd: repoRoot,
    encoding: 'utf8'
  }
)

if (result.error) {
  console.error(`[rust-audit] failed to run cargo audit: ${result.error.message}`)
  process.exit(1)
}

let report
try {
  report = JSON.parse(result.stdout)
} catch {
  if (result.stdout.trim()) {
    console.error(result.stdout.trim())
  }
  if (result.stderr.trim()) {
    console.error(result.stderr.trim())
  }
  console.error('[rust-audit] cargo audit did not return valid JSON')
  process.exit(result.status || 1)
}

const databaseUpdated = report.database?.['last-updated'] ?? 'unknown'
const dependencyCount = report.lockfile?.['dependency-count'] ?? 'unknown'
const vulnerabilities = report.vulnerabilities?.list ?? []
const warnings = report.warnings ?? {}
const lockedPackageVersions = readLockedPackageVersions()

const tauriLinuxWebviewWarningPackages = new Set([
  'atk',
  'atk-sys',
  'gdk',
  'gdk-sys',
  'gdkwayland-sys',
  'gdkx11',
  'gdkx11-sys',
  'glib',
  'gtk',
  'gtk-sys',
  'gtk3-macros'
])

function readLockedPackageVersions() {
  const lockfileText = fs.readFileSync(lockfile, 'utf8')
  const packageBlocks = lockfileText.split(/\r?\n(?=\[\[package\]\])/)
  const versions = new Map()

  for (const block of packageBlocks) {
    const name = block.match(/^name = "([^"]+)"$/m)?.[1]
    const version = block.match(/^version = "([^"]+)"$/m)?.[1]

    if (!name || !version) {
      continue
    }

    versions.set(name, version)
  }

  return versions
}

function readLockedVersion(packageName) {
  return lockedPackageVersions.get(packageName) ?? 'unknown'
}

function printTauriLinuxWebviewFollowUp(warningEntries) {
  const trackedWarnings = warningEntries.flatMap(([, items]) =>
    items.filter((item) => tauriLinuxWebviewWarningPackages.has(item.package?.name))
  )

  if (trackedWarnings.length === 0) {
    return
  }

  const trackedPackageList = [...new Set(trackedWarnings.map((item) => formatPackage(item)))]
    .sort()
    .join(', ')

  console.log('[rust-audit] tracked upstream follow-up: Tauri/Wry Linux WebView stack')
  console.log(
    `  chain: tauri@${readLockedVersion('tauri')} -> tauri-runtime-wry@${readLockedVersion('tauri-runtime-wry')} / wry@${readLockedVersion('wry')} -> webkit2gtk@${readLockedVersion('webkit2gtk')} / gtk@${readLockedVersion('gtk')} / glib@${readLockedVersion('glib')}`
  )
  console.log(`  informational warnings in this chain: ${trackedWarnings.length} (${trackedPackageList})`)
  console.log('  action: keep tracking compatible Tauri/Wry upgrades; this is not a direct app-code dependency')
}

function formatPackage(item) {
  const pkg = item.package ?? {}
  return `${pkg.name ?? item.advisory?.package ?? 'unknown'}@${pkg.version ?? 'unknown'}`
}

console.log(`[rust-audit] advisory database updated: ${databaseUpdated}`)
console.log(`[rust-audit] lockfile dependencies: ${dependencyCount}`)

if (vulnerabilities.length > 0) {
  console.error(`[rust-audit] vulnerabilities found: ${vulnerabilities.length}`)
  for (const item of vulnerabilities) {
    const advisory = item.advisory ?? {}
    const pkg = item.package ?? {}
    console.error(
      `  - ${advisory.id ?? 'unknown'} ${pkg.name ?? advisory.package ?? 'unknown'}@${pkg.version ?? 'unknown'}: ${advisory.title ?? 'no title'}`
    )
  }
  process.exit(1)
}

const warningEntries = Object.entries(warnings)
  .map(([kind, items]) => [kind, Array.isArray(items) ? items : []])
  .filter(([, items]) => items.length > 0)

if (warningEntries.length === 0) {
  console.log('[rust-audit] no vulnerabilities or informational warnings found')
  process.exit(0)
}

console.log('[rust-audit] no vulnerabilities found')
console.log('[rust-audit] informational warnings:')
for (const [kind, items] of warningEntries) {
  console.log(`  ${kind}: ${items.length}`)
  for (const item of items) {
    const advisory = item.advisory ?? {}
    console.log(
      `    - ${advisory.id ?? 'unknown'} ${formatPackage(item)}: ${advisory.title ?? 'no title'}`
    )
  }
}

printTauriLinuxWebviewFollowUp(warningEntries)

if (result.stderr.trim()) {
  console.warn('[rust-audit] stderr:')
  console.warn(result.stderr.trim())
}
