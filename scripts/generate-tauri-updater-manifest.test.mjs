import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'vitest'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./generate-tauri-updater-manifest.mjs', import.meta.url))

function generateManifest(assetNames, assetVersion = '') {
  const directory = mkdtempSync(path.join(tmpdir(), 'routex-updater-manifest-'))
  const output = path.join(directory, 'latest.json')
  const release = {
    tag_name: 'v4.5.0',
    body: '更新说明',
    published_at: '2026-10-23T00:00:00Z',
    assets: assetNames.flatMap((name) => [
      { name, url: `https://example.invalid/${name}` },
      { name: `${name}.sig`, url: `https://example.invalid/${name}.sig` }
    ])
  }
  const mockFetch = `globalThis.fetch = async (url) => new Response(
    String(url).endsWith('.sig') ? 'test-signature' : JSON.stringify(${JSON.stringify(release)})
  )`
  const preload = `data:text/javascript;base64,${Buffer.from(mockFetch).toString('base64')}`
  try {
    const result = spawnSync(process.execPath, ['--import', preload, script, 'v4.5.0', output], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_REPOSITORY: 'test/routex',
        GH_TOKEN: '',
        GITHUB_TOKEN: '',
        VERSION: assetVersion,
        RELEASE_ASSET_VERSION: assetVersion
      }
    })
    return {
      ...result,
      manifest: result.status === 0 ? JSON.parse(readFileSync(output, 'utf8')) : null
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test('原生安装包和 macOS 压缩应用继续生成签名更新清单', () => {
  const result = generateManifest([
    'RouteX-setup.exe',
    'RouteX.msi',
    'RouteX.app.tar.gz',
    'RouteX.AppImage',
    'RouteX.deb',
    'RouteX.rpm',
    'RouteX-portable.exe',
    'RouteX-setup.exe.zip',
    'RouteX.AppImage.tar.gz'
  ])
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.manifest.version, '4.5.0')
  assert.deepEqual(Object.keys(result.manifest.platforms).sort(), [
    'darwin-aarch64',
    'darwin-aarch64-app',
    'linux-x86_64',
    'linux-x86_64-appimage',
    'linux-x86_64-deb',
    'linux-x86_64-rpm',
    'windows-x86_64',
    'windows-x86_64-msi',
    'windows-x86_64-nsis'
  ])
  for (const platform of Object.values(result.manifest.platforms)) {
    assert.equal(platform.signature, 'test-signature')
    assert.ok(platform.url.startsWith('https://github.com/test/routex/releases/download/v4.5.0/'))
    assert.doesNotMatch(platform.url, /portable|\.exe\.zip$|\.AppImage\.tar\.gz$/)
  }
})

test('仅有旧版压缩格式时拒绝生成无法安装的更新清单', () => {
  const result = generateManifest(['RouteX-setup.exe.zip', 'RouteX.AppImage.tar.gz'])
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /No signed updater platforms found/)
})

test('自动构建的签名安装包保留完整应用版本并进入更新清单', () => {
  const version = '4.5.0-autobuild.205'
  const result = generateManifest(
    [
      `RouteX-${version}-linux-x86_64.rpm`,
      `RouteX_${version}_amd64.deb`,
      `RouteX-${version}-macos-arm64.app.tar.gz`,
      `RouteX_${version}_x64-setup.exe`,
      'RouteX-4.5.0-autobuild.204-linux-x86_64.rpm'
    ],
    version
  )
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.manifest.version, version)
  assert.deepEqual(Object.keys(result.manifest.platforms).sort(), [
    'darwin-aarch64',
    'darwin-aarch64-app',
    'linux-x86_64-deb',
    'linux-x86_64-rpm',
    'windows-x86_64',
    'windows-x86_64-nsis'
  ])
  assert.ok(
    result.manifest.platforms['linux-x86_64-rpm'].url.endsWith(`${version}-linux-x86_64.rpm`)
  )
  assert.equal(result.manifest.platforms['linux-x86_64-rpm'].signature, 'test-signature')
})
