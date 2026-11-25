import { expect, it } from 'vitest'
import { extractImportedThemeName } from './theme-ipc'

it('decodes virtual file theme names and preserves local filenames containing %', () => {
  expect(extractImportedThemeName('tauri-file:///id-1/dark%20theme.css')).toBe('dark theme.css')
  expect(extractImportedThemeName('C:\\Users\\demo\\100%_clean.css')).toBe('100%_clean.css')
  expect(extractImportedThemeName('tauri-file:///id-2/%E0%A4%A.css')).toBe('%E0%A4%A.css')
})
