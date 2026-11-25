// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { extractImportedThemeName, upsertTauriThemeStyle } from './theme-ipc'

afterEach(() => {
  document.head.innerHTML = ''
  delete document.documentElement.dataset['routexTheme']
})

it('decodes virtual file theme names and preserves local filenames containing %', () => {
  expect(extractImportedThemeName('tauri-file:///id-1/dark%20theme.css')).toBe('dark theme.css')
  expect(extractImportedThemeName('C:\\Users\\demo\\100%_clean.css')).toBe('100%_clean.css')
  expect(extractImportedThemeName('tauri-file:///id-2/%E0%A4%A.css')).toBe('%E0%A4%A.css')
})

it('skips redundant style textContent writes for identical CSS and applies edited CSS immediately', () => {
  const initialCss = ':root { --accent: #111; }'
  upsertTauriThemeStyle(initialCss)

  const styleEl = document.getElementById('routex-tauri-theme-style')
  expect(styleEl).toBeInstanceOf(HTMLStyleElement)
  expect(styleEl?.textContent).toBe(initialCss)

  const textDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent')!
  const setCalls: string[] = []
  Object.defineProperty(styleEl!, 'textContent', {
    configurable: true,
    get() {
      return textDescriptor.get!.call(this)
    },
    set(value: string) {
      setCalls.push(value)
      textDescriptor.set!.call(this, value)
    }
  })

  upsertTauriThemeStyle(initialCss)
  expect(setCalls).toEqual([])

  const updatedCss = ':root { --accent: #222; }'
  upsertTauriThemeStyle(updatedCss)
  expect(setCalls).toEqual([updatedCss])
  expect(styleEl?.textContent).toBe(updatedCss)

  upsertTauriThemeStyle('   ')
  expect(document.getElementById('routex-tauri-theme-style')).toBeNull()
})
