import React, { Suspense } from 'react'
import { Spinner } from '@heroui/react'
import type { BaseEditorProps } from './base-editor.shared'

const BaseEditorComponent = React.lazy(() =>
  import('./base-editor').then((module) => ({ default: module.BaseEditor }))
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
