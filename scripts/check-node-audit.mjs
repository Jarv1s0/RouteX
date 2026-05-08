import { spawnSync } from 'node:child_process'

const auditLevel = process.env.ROUTEX_NODE_AUDIT_LEVEL || 'moderate'
const maxAttempts = Number.parseInt(process.env.ROUTEX_NODE_AUDIT_ATTEMPTS || '3', 10)
const retryDelayMs = Number.parseInt(process.env.ROUTEX_NODE_AUDIT_RETRY_DELAY_MS || '10000', 10)
const pnpmCli = process.env.npm_execpath
const auditArgs = ['audit', '--json', '--audit-level', auditLevel]
const pnpmCommand = pnpmCli ? process.execPath : process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const pnpmAuditArgs = pnpmCli ? [pnpmCli, ...auditArgs] : auditArgs

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function isTransientFailure(result) {
  const output = `${result.stderr || ''}\n${result.stdout || ''}`
  return /ERR_SOCKET_TIMEOUT|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|timeout/i.test(output)
}

function parseAuditReport(stdout) {
  const trimmed = stdout.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed)
  } catch {
    const jsonStart = trimmed.indexOf('{')
    const jsonEnd = trimmed.lastIndexOf('}')
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1))
    }
    throw new Error('pnpm audit did not return valid JSON')
  }
}

function collectAdvisories(report) {
  if (!report || typeof report !== 'object') return []

  if (report.advisories && typeof report.advisories === 'object') {
    return Object.values(report.advisories)
  }

  if (report.vulnerabilities && typeof report.vulnerabilities === 'object') {
    return Object.entries(report.vulnerabilities).map(([name, value]) => ({
      module_name: name,
      ...(typeof value === 'object' && value ? value : {})
    }))
  }

  return []
}

function severityCounts(report, advisories) {
  const metadataCounts = report?.metadata?.vulnerabilities
  if (metadataCounts && typeof metadataCounts === 'object') {
    return metadataCounts
  }

  return advisories.reduce((counts, advisory) => {
    const severity = advisory.severity || 'unknown'
    counts[severity] = (counts[severity] || 0) + 1
    counts.total = (counts.total || 0) + 1
    return counts
  }, {})
}

let lastResult
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  lastResult = spawnSync(pnpmCommand, pnpmAuditArgs, {
    encoding: 'utf8',
    shell: false
  })

  if (lastResult.error) {
    console.error(`[node-audit] failed to run pnpm audit: ${lastResult.error.message}`)
    process.exit(1)
  }

  if (!isTransientFailure(lastResult) || attempt === maxAttempts) {
    break
  }

  console.warn(`[node-audit] transient audit failure, retrying ${attempt}/${maxAttempts}`)
  sleep(retryDelayMs)
}

let report
try {
  report = parseAuditReport(lastResult.stdout)
} catch (error) {
  if (lastResult.stdout.trim()) console.error(lastResult.stdout.trim())
  if (lastResult.stderr.trim()) console.error(lastResult.stderr.trim())
  console.error(`[node-audit] ${error.message}`)
  process.exit(lastResult.status || 1)
}

const advisories = collectAdvisories(report)
const counts = severityCounts(report, advisories)
const total = Number(counts.total ?? advisories.length ?? 0)

console.log(`[node-audit] audit level: ${auditLevel}`)
console.log(
  `[node-audit] vulnerabilities: total=${total}, critical=${counts.critical || 0}, high=${counts.high || 0}, moderate=${counts.moderate || 0}, low=${counts.low || 0}`
)

if (total > 0) {
  for (const advisory of advisories.slice(0, 20)) {
    const name = advisory.module_name || advisory.name || advisory.package || 'unknown'
    const severity = advisory.severity || 'unknown'
    const title = advisory.title || advisory.via?.[0]?.title || advisory.url || 'no title'
    console.error(`  - ${severity} ${name}: ${title}`)
  }

  if (advisories.length > 20) {
    console.error(`  - ... ${advisories.length - 20} more advisories`)
  }
}

if (lastResult.stderr.trim()) {
  console.warn('[node-audit] stderr:')
  console.warn(lastResult.stderr.trim())
}

process.exit(lastResult.status || 0)
