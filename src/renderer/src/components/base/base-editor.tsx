import React, { Suspense } from 'react'
import { Spinner } from '@heroui/react'
import { BaseEditorSimple } from './base-editor-simple'
import type { BaseEditorProps, Language } from './base-editor.shared'

const MonacoBaseEditor = React.lazy(() =>
  import('./base-editor-monaco').then((module) => ({ default: module.BaseEditorMonaco }))
)

const MONACO_LANGUAGES = new Set<Language>(['yaml', 'javascript', 'json'])

function getEditorFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}

export const BaseEditor: React.FC<BaseEditorProps> = (props) => {
  const shouldUseMonaco =
    props.originalValue !== undefined || MONACO_LANGUAGES.has(props.language)

  if (!shouldUseMonaco) {
    return <BaseEditorSimple {...props} />
  }

  return (
    <Suspense fallback={getEditorFallback()}>
      <MonacoBaseEditor {...props} />
    </Suspense>
  )
}
