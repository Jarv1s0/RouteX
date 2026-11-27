import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getBoundedDelayChipClassName } from '../utils/delay-color'
import { getProxyChipClassName, NEUTRAL_CHIP_CLASSNAME } from '../utils/proxy-colors'

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url))
const RENDERER_SRC_DIR = path.resolve(CURRENT_DIR, '..')
const REPO_ROOT = path.resolve(RENDERER_SRC_DIR, '../../..')

const FORBIDDEN_CLASS_RULES: Array<{ name: string; pattern: RegExp }> = [
  {
    name: 'HeroUI 暗色双重反转文本类名',
    pattern: /(?<![-\w])dark:text-(?:default-(?:100|300|400)|foreground-(?:300|400))(?![-\w])/g
  },
  {
    name: '硬编码 Tailwind gray 文本类名',
    pattern: /(?<![-\w])text-gray-\d+(?![-\w])/g
  },
  {
    name: '中低对比度 default/foreground 文本色阶',
    pattern: /(?<![-\w])text-(?:default|foreground)-(?:300|400|500)(?![-\w])/g
  }
]

function collectRendererSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectRendererSourceFiles(fullPath))
      continue
    }

    if (
      /\.(ts|tsx|css)$/.test(entry.name) &&
      !entry.name.includes('.test.') &&
      !entry.name.endsWith('.d.ts')
    ) {
      files.push(fullPath)
    }
  }

  return files
}

describe('UI contrast guard', () => {
  it('forbids low-contrast or double-inverted text classes in renderer sources', () => {
    const sourceFiles = collectRendererSourceFiles(RENDERER_SRC_DIR)
    const violations: string[] = []

    for (const filePath of sourceFiles) {
      const content = fs.readFileSync(filePath, 'utf8')
      const lines = content.split(/\r?\n/)

      lines.forEach((line, index) => {
        for (const rule of FORBIDDEN_CLASS_RULES) {
          rule.pattern.lastIndex = 0
          const match = rule.pattern.exec(line)
          if (match) {
            const relPath = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/')
            violations.push(`${relPath}:${index + 1} [${rule.name}] -> ${match[0]}`)
          }
        }
      })
    }

    expect(violations).toEqual([])
  })

  it('keeps default.css and main.css aligned on foreground fallback variables', () => {
    const mainCss = fs.readFileSync(path.join(RENDERER_SRC_DIR, 'assets/main.css'), 'utf8')
    const defaultCss = fs.readFileSync(
      path.join(REPO_ROOT, 'src-tauri/src/desktop/foundation/default.css'),
      'utf8'
    )

    for (const token of [
      '--heroui-foreground-400: 240 5% 44%;',
      '--heroui-foreground-500: 240 5% 34%;',
      '--heroui-foreground-600: 240 6% 24%;',
      '--heroui-foreground-400: 220 8% 66%;',
      '--heroui-foreground-500: 220 10% 76%;',
      '--heroui-foreground-600: 215 12% 85%;'
    ]) {
      expect(mainCss).toContain(token)
      expect(defaultCss).toContain(token)
    }
  })

  it('applies explicit high-contrast neutral styling to DIRECT and unknown delay chips', () => {
    expect(getProxyChipClassName('DIRECT')).toBe(NEUTRAL_CHIP_CLASSNAME)
    expect(getProxyChipClassName('REJECT')).toBe('')
    expect(getProxyChipClassName('Proxy')).toBe('')

    expect(getBoundedDelayChipClassName(undefined, 150, 300)).toBe(NEUTRAL_CHIP_CLASSNAME)
    expect(getBoundedDelayChipClassName(-1, 150, 300)).toBe(NEUTRAL_CHIP_CLASSNAME)
    expect(getBoundedDelayChipClassName(120, 150, 300)).toBe('')
  })
})
