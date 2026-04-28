import React from 'react'
import { BaseEditorSimple } from './base-editor-simple'
import { BaseEditorMonaco } from './base-editor-monaco'
import type { BaseEditorProps, Language } from './base-editor.shared'

const MONACO_LANGUAGES = new Set<Language>(['yaml', 'javascript', 'json'])

export const BaseEditor: React.FC<BaseEditorProps> = (props) => {
  const shouldUseMonaco =
    props.originalValue !== undefined || MONACO_LANGUAGES.has(props.language)

  if (!shouldUseMonaco) {
    return <BaseEditorSimple {...props} />
  }

  return <BaseEditorMonaco {...props} />
}
