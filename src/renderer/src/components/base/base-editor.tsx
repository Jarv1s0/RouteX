import React from 'react'
import { BaseEditorSimple } from './base-editor-simple'
import type { BaseEditorProps, Language } from './base-editor.shared'

const MONACO_LANGUAGES = new Set<Language>(['yaml', 'javascript', 'json'])
const BaseEditorMonaco = React.lazy(() =>
  import('./base-editor-monaco').then((module) => ({ default: module.BaseEditorMonaco }))
)

export const BaseEditor: React.FC<BaseEditorProps> = (props) => {
  const shouldUseMonaco =
    props.originalValue !== undefined || MONACO_LANGUAGES.has(props.language)

  if (!shouldUseMonaco) {
    return <BaseEditorSimple {...props} />
  }

  return <BaseEditorMonaco {...props} />
}
