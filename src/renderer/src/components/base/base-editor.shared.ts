export type Language = 'yaml' | 'javascript' | 'css' | 'json' | 'text'

export interface BaseEditorProps {
  value: string
  originalValue?: string
  diffRenderSideBySide?: boolean
  preferSimple?: boolean
  diffOriginalLabel?: string
  diffModifiedLabel?: string
  readOnly?: boolean
  language: Language
  onChange?: (value: string) => void
}
