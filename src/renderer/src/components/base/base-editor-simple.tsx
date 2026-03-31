import React from 'react'
import type { BaseEditorProps } from './base-editor.shared'

export const BaseEditorSimple: React.FC<BaseEditorProps> = ({
  value,
  readOnly = false,
  onChange
}) => {
  return (
    <div className="h-full w-full rounded-xl border border-default-200/60 bg-default-50/40 dark:bg-default-100/30 overflow-hidden">
      <textarea
        value={value}
        readOnly={readOnly}
        spellCheck={false}
        onChange={(event) => onChange?.(event.target.value)}
        className="h-full w-full resize-none border-0 bg-transparent p-4 font-mono text-sm leading-6 text-foreground outline-none select-text"
      />
    </div>
  )
}
