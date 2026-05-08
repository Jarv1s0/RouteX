import React, { Suspense } from 'react'
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

  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center text-sm text-default-500">
          加载编辑器...
        </div>
      }
    >
      <BaseEditorMonaco {...props} />
    </Suspense>
  )
}
