import path from 'node:path'
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
    const pkg = item.package ?? {}
    console.log(
      `    - ${advisory.id ?? 'unknown'} ${pkg.name ?? advisory.package ?? 'unknown'}@${pkg.version ?? 'unknown'}: ${advisory.title ?? 'no title'}`
    )
  }
}

if (result.stderr.trim()) {
  console.warn('[rust-audit] stderr:')
  console.warn(result.stderr.trim())
}
