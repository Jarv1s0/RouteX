import React, { Suspense } from 'react'
import { BaseEditorSimple } from './base-editor-simple'
import type { BaseEditorProps, Language } from './base-editor.shared'

const CODEMIRROR_LANGUAGES = new Set<Language>(['yaml', 'javascript', 'json', 'css'])
const BaseEditorCodeMirror = React.lazy(() =>
  import('./base-editor-codemirror').then((module) => ({ default: module.BaseEditorCodeMirror }))
)

export const BaseEditor: React.FC<BaseEditorProps> = (props) => {
  const shouldUseSimple = props.preferSimple && props.originalValue === undefined
  const shouldUseCodeMirror =
    !shouldUseSimple &&
    (props.originalValue !== undefined || CODEMIRROR_LANGUAGES.has(props.language))

  if (!shouldUseCodeMirror) {
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
      <BaseEditorCodeMirror {...props} />
    </Suspense>
  )
}
