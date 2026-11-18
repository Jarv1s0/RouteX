import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, test } from 'vitest'

const script = fileURLToPath(new URL('./check-node-audit.mjs', import.meta.url))
const directory = mkdtempSync(path.join(tmpdir(), 'routex-node-audit-'))
const pnpmStub = path.join(directory, 'pnpm.mjs')
writeFileSync(
  pnpmStub,
  `const production = process.argv.includes('--prod')
process.stdout.write(production ? process.env.TEST_PRODUCTION_REPORT : process.env.TEST_FULL_REPORT)
process.exit(Number(production ? process.env.TEST_PRODUCTION_STATUS : process.env.TEST_FULL_STATUS))
`
)
afterAll(() => rmSync(directory, { recursive: true, force: true }))

const trackedAdvisory = {
  github_advisory_id: 'GHSA-fc5q-39xc-vjpf',
  module_name: 'picomatch',
  severity: 'high',
  title: 'picomatch ReDoS',
  patched_versions: '<0.0.0',
  // Real pnpm reports dev=false even for this development-only dependency.
  findings: [{ version: '4.0.7', paths: ['.>vite>picomatch'], dev: false }]
}

function report(advisories = []) {
  return {
    advisories: Object.fromEntries(advisories.map((advisory, index) => [index, advisory])),
    metadata: { vulnerabilities: { high: advisories.length, moderate: 0, low: 0, critical: 0 } }
  }
}

function runAudit(fullReport, productionReport = report(), statuses = {}) {
  return spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      npm_execpath: pnpmStub,
      ROUTEX_NODE_AUDIT_ATTEMPTS: '1',
      TEST_FULL_REPORT: typeof fullReport === 'string' ? fullReport : JSON.stringify(fullReport),
      TEST_FULL_STATUS: String(statuses.full ?? 1),
      TEST_PRODUCTION_REPORT:
        typeof productionReport === 'string' ? productionReport : JSON.stringify(productionReport),
      TEST_PRODUCTION_STATUS: String(statuses.production ?? 0)
    }
  })
}

test('无漏洞的审计正常通过', () => {
  const result = runAudit(report(), report(), { full: 0 })
  assert.equal(result.status, 0, result.stderr)
  assert.doesNotMatch(result.stderr, /temporary build-only exception/)
})

test('指定公告和版本仅在生产依赖无漏洞时豁免并保留告警', () => {
  const result = runAudit(report([trackedAdvisory]))
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stderr, /high picomatch/)
  assert.match(
    result.stderr,
    /temporary build-only exception: GHSA-fc5q-39xc-vjpf picomatch@4\.0\.7/
  )
})

test.each([
  ['其他公告', { github_advisory_id: 'GHSA-other-advisory' }],
  ['其他包', { module_name: 'other-package' }],
  ['其他版本', { findings: [{ version: '4.0.8' }] }],
  ['混合版本', { findings: [{ version: '4.0.7' }, { version: '4.0.6' }] }],
  ['缺少版本', { findings: [] }],
  ['上游已有修复', { patched_versions: '>=4.0.8' }]
])('%s 仍然阻断', (_name, changes) => {
  const result = runAudit(report([{ ...trackedAdvisory, ...changes }]))
  assert.equal(result.status, 1, result.stderr)
  assert.doesNotMatch(result.stderr, /temporary build-only exception/)
})

test('同时出现其他漏洞时仍然阻断', () => {
  const result = runAudit(
    report([trackedAdvisory, { ...trackedAdvisory, github_advisory_id: 'GHSA-new-advisory' }])
  )
  assert.equal(result.status, 1, result.stderr)
})

test.each([
  ['生产依赖包含同一漏洞', report([trackedAdvisory]), 1],
  ['生产依赖包含其他漏洞', report([{ module_name: 'other', severity: 'high' }]), 1],
  ['生产审计命令失败', report(), 1],
  ['生产审计没有有效 JSON', 'not-json', 0],
  ['生产审计返回空值', 'null', 0],
  ['生产审计缺少统计', {}, 0]
])('%s 时拒绝豁免', (_name, productionReport, productionStatus) => {
  const result = runAudit(report([trackedAdvisory]), productionReport, {
    production: productionStatus
  })
  assert.equal(result.status, 1, result.stderr)
  assert.doesNotMatch(result.stderr, /temporary build-only exception:/)
})

test('审计结果不完整或进程异常时仍然阻断', () => {
  const incomplete = report([trackedAdvisory])
  incomplete.metadata.vulnerabilities.high = 2
  assert.equal(runAudit(incomplete).status, 1)
  assert.equal(runAudit(report([trackedAdvisory]), report(), { full: 2 }).status, 2)
  assert.equal(runAudit('null', report(), { full: 0 }).status, 1)
})
