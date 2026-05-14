import React, { Suspense } from 'react'
import { Spinner } from '@heroui/react'
import type { BaseEditorProps } from './base-editor.shared'

const BaseEditorComponent = React.lazy(() =>
  import('./base-editor-codemirror').then((module) => ({ default: module.BaseEditorCodeMirror }))
)

export const BaseEditor: React.FC<BaseEditorProps> = (props) => {
  return (
    <Suspense
      fallback={
        <div className="w-full h-full flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <BaseEditorComponent {...props} />
    </Suspense>
  )
}
