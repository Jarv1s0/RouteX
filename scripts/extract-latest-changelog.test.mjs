import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const script = fileURLToPath(new URL('./extract-latest-changelog.mjs', import.meta.url))
const packageVersion = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')
).version
let directory
let source
let output

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'routex-changelog-'))
  source = path.join(directory, 'changelog.md')
  output = path.join(directory, 'notes.md')
})

afterEach(() => fs.rmSync(directory, { recursive: true, force: true }))

function extract(markdown, version) {
  fs.writeFileSync(source, markdown)
  return spawnSync(process.execPath, [script, source, output, version], { encoding: 'utf8' })
}

describe('version-specific release notes', () => {
  it.each(['4.1.0', 'v4.1.0'])(
    'extracts %s regardless of section order and preserves upgrade warnings',
    (version) => {
      const result = extract(
        '# 更新日志\n\n## v4.0.0\n\n- Older\n\n## v4.1.0\n\n> Backup first\n\n### 修复\n\n- Selected\n\n## v4.5.0\n\n- Newer\n',
        version
      )
      expect(result.status).toBe(0)
      expect(fs.readFileSync(output, 'utf8')).toBe(
        '# 更新日志\n\n> Backup first\n\n### 修复\n\n- Selected\n'
      )
    }
  )

  it('defaults to the package version rather than the first section', () => {
    fs.writeFileSync(source, `## v0.0.0\n\n- Wrong\n\n## v${packageVersion}\n\n- Current\n`)
    const result = spawnSync(process.execPath, [script, source], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stdout).toBe('# 更新日志\n\n- Current\n')
  })

  it('does not fall back to another version or overwrite output when a version is missing', () => {
    fs.writeFileSync(output, 'Keep existing output')
    const result = extract('## v4.0.0\n\n- Older\n', '4.5.0')
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('found 0')
    expect(fs.readFileSync(output, 'utf8')).toBe('Keep existing output')
  })

  it('rejects duplicate target sections', () => {
    const result = extract('## v4.5.0\n\n- First\n\n## v4.5.0\n\n- Duplicate\n', '4.5.0')
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('found 2')
    expect(fs.existsSync(output)).toBe(false)
  })

  it.each(['', '### 修复\n\n<!-- Pending -->'])('rejects empty release content: %j', (body) => {
    const result = extract(`## v4.5.0\n\n${body}\n\n## v4.4.0\n\n- Older\n`, '4.5.0')
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('has no body')
    expect(fs.existsSync(output)).toBe(false)
  })

  it('stops at a non-version level-two heading', () => {
    const result = extract('## v4.5.0\n\n- Selected\n\n## 参考\n\nPrivate appendix\n', '4.5.0')
    expect(result.status).toBe(0)
    expect(fs.readFileSync(output, 'utf8')).toBe('# 更新日志\n\n- Selected\n')
  })

  it.each(['```', '~~~~'])('ignores version headings inside %s code fences', (fence) => {
    const body = `- Selected\n\n${fence}markdown\n## v4.5.0\nExample heading\n${fence}`
    const result = extract(`## v4.5.0\n\n${body}\n\n## v4.4.0\n\n- Older\n`, '4.5.0')
    expect(result.status).toBe(0)
    expect(fs.readFileSync(output, 'utf8')).toBe(`# 更新日志\n\n${body}\n`)
  })

  it('supports CRLF and exact prerelease versions', () => {
    const result = extract(
      '## v4.5.0\r\n\r\n- Stable\r\n\r\n## v4.5.0-beta.1+build.2\r\n\r\n- Preview\r\n',
      'v4.5.0-beta.1+build.2'
    )
    expect(result.status).toBe(0)
    expect(fs.readFileSync(output, 'utf8')).toBe('# 更新日志\n\n- Preview\n')
  })

  it('rejects invalid version arguments', () => {
    const result = extract('## v4.5.0\n\n- Current\n', 'latest')
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Invalid release version')
  })
})
