import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'vitest'

const script = fileURLToPath(new URL('./write-release-tauri-config.mjs', import.meta.url))

function generateConfig(version, rpm = false) {
  const directory = mkdtempSync(path.join(tmpdir(), 'routex-release-config-'))
  const output = path.join(directory, 'release.json')
  try {
    const result = spawnSync(process.execPath, [script, output, ...(rpm ? ['--rpm'] : [])], {
      encoding: 'utf8',
      env: {
        ...process.env,
        ROUTEX_BUILD_VERSION: version,
        ROUTEX_UPDATER_PUBLIC_KEY: 'A'.repeat(56)
      }
    })
    assert.equal(result.status, 0, result.stderr)
    return JSON.parse(readFileSync(output, 'utf8'))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test('应用与非 RPM 安装包保留完整预发布版本', () => {
  const config = generateConfig('4.5.0-autobuild.204')
  assert.equal(config.version, '4.5.0-autobuild.204')
  assert.equal(config.bundle.linux, undefined)
  assert.equal(config.bundle.createUpdaterArtifacts, true)
})

test('RPM 将自动构建标记放入 Release 并保留更新签名配置', () => {
  const config = generateConfig('4.5.0-autobuild.204', true)
  assert.equal(config.version, '4.5.0')
  assert.equal(config.bundle.linux.rpm.release, '0.autobuild.204')
  assert.equal(config.bundle.createUpdaterArtifacts, true)
  assert.equal(config.plugins.updater.pubkey, 'A'.repeat(56))
})

test('RPM 正式版使用标准 Release 并在未指定版本时读取项目版本', () => {
  assert.equal(generateConfig('4.5.0', true).bundle.linux.rpm.release, '1')
  const config = generateConfig('', true)
  const version = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8')
  ).version
  assert.equal(config.version, version)
  assert.equal(config.bundle.linux.rpm.release, '1')
})

test('RPM 发布元数据不进入 Version 且 Release 不包含连字符', () => {
  const config = generateConfig('4.5.0-beta-test.2+build.42', true)
  assert.equal(config.version, '4.5.0')
  assert.equal(config.bundle.linux.rpm.release, '0.beta.test.2')
})
