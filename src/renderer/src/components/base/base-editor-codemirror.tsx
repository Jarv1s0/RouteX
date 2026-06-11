import React, { type RefObject, useEffect, useMemo, useRef } from 'react'
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  snippetCompletion,
  type Completion,
  type CompletionContext
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { yaml } from '@codemirror/lang-yaml'
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting
} from '@codemirror/language'
import { type Diagnostic, lintGutter, linter } from '@codemirror/lint'
import { MergeView, unifiedMergeView } from '@codemirror/merge'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { EditorState, type Extension } from '@codemirror/state'
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection
} from '@codemirror/view'
import { useTheme } from 'next-themes'
import { load } from 'js-yaml'
import { translate } from '@renderer/i18n'
import type { BaseEditorProps, Language } from './base-editor.shared'
import { MIHOMO_V119_YAML_SNIPPETS } from '../../../../shared/defaults/mihomo-templates'

type YamlParseError = {
  message?: string
  mark?: {
    line?: number
    column?: number
  }
}

interface CodeMirrorViewProps extends BaseEditorProps {
  extensions: Extension[]
  suppressChangeRef: RefObject<boolean>
}

interface CodeMirrorEditorViewProps extends CodeMirrorViewProps {
  unifiedOriginalValue?: string
}

type EditorSettings = {
  isLight: boolean
}

const editorFontFamily =
  'Maple Mono NF CN,Fira Code, JetBrains Mono, Roboto Mono, "Source Code Pro", Consolas, Menlo, Monaco, monospace, "Courier New", "Apple Color Emoji", "Noto Color Emoji"'
const editorContainerClassName = 'h-full w-full overflow-hidden'
const mergeViewWrapperClassName = 'flex h-full min-h-0 w-full flex-col overflow-hidden'
const mergeHeaderClassName =
  'grid shrink-0 grid-cols-2 border-b border-default-200/70 bg-content1 text-xs font-medium text-default-600'
const mergeHeaderItemClassName = 'px-4 py-2'
const mergeContainerClassName = 'min-h-0 flex-1 w-full overflow-auto'
const getSelectionBackground = (isLight: boolean): string =>
  isLight
    ? 'hsl(var(--heroui-primary) / 0.92) !important'
    : 'hsl(var(--heroui-primary) / 0.78) !important'
const getSelectionMatchBackground = (isLight: boolean): string =>
  isLight
    ? 'hsl(var(--heroui-primary) / 0.12) !important'
    : 'hsl(var(--heroui-primary) / 0.10) !important'
const mihomoYamlSnippetCompletions: Completion[] = MIHOMO_V119_YAML_SNIPPETS.map((item) =>
  snippetCompletion(item.snippet, {
    label: item.label,
    detail: item.detail,
    info: item.info,
    type: 'keyword'
  })
)

function mihomoYamlCompletionSource(context: CompletionContext) {
  const word = context.matchBefore(/[\w-]*/)
  if (!word || (word.from === word.to && !context.explicit)) {
    return null
  }

  return {
    from: word.from,
    options: mihomoYamlSnippetCompletions,
    validFor: /^[\w-]*$/
  }
}

const createFoldMarker = (open: boolean): HTMLElement => {
  const marker = document.createElement('span')
  marker.className = `cm-foldMarker ${open ? 'cm-foldMarker-open' : 'cm-foldMarker-closed'}`
  marker.setAttribute('aria-hidden', 'true')
  return marker
}

const useEditorSettings = (): EditorSettings => {
  const { theme, systemTheme } = useTheme()
  const trueTheme = theme === 'system' ? systemTheme : theme

  return {
    isLight: trueTheme?.includes('light') ?? false
  }
}

const yamlParseLinter = linter((view) => {
  const text = view.state.doc.toString()
  if (!text.trim()) return []

  try {
    load(text)
    return []
  } catch (error) {
    const parseError = error as YamlParseError
    const lineNumber = typeof parseError.mark?.line === 'number' ? parseError.mark.line + 1 : 1
    const column = typeof parseError.mark?.column === 'number' ? parseError.mark.column : 0
    const line = view.state.doc.line(Math.min(lineNumber, view.state.doc.lines))
    const from = Math.min(line.from + column, line.to)

    return [
      {
        from,
        to: Math.min(from + 1, view.state.doc.length),
        severity: 'error',
        message: parseError.message || translate('sysproxy.yamlFormatError')
      } satisfies Diagnostic
    ]
  }
})

const languageExtensions = (language: Language): Extension[] => {
  switch (language) {
    case 'css':
      return [css()]
    case 'javascript':
      return [javascript()]
    case 'json':
      return [json(), linter(jsonParseLinter())]
    case 'yaml':
      return [yaml(), yamlParseLinter]
    case 'text':
      return []
  }
}

const createTheme = (isLight: boolean): Extension =>
  EditorView.theme(
    {
      '&': {
        height: '100%',
        backgroundColor: 'transparent',
        color: 'hsl(var(--heroui-foreground))',
        fontSize: '14px'
      },
      '&.cm-focused': {
        outline: 'none'
      },
      '.cm-scroller': {
        fontFamily: editorFontFamily,
        lineHeight: '1.5',
        scrollBehavior: 'smooth'
      },
      '.cm-content': {
        minHeight: '100%',
        padding: '16px 0',
        caretColor: 'hsl(var(--heroui-primary))'
      },
      '.cm-line': {
        padding: '0 14px'
      },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        borderRight: '1px solid hsl(var(--heroui-default-200) / 0.6)',
        color: 'hsl(var(--heroui-default-500))'
      },
      '.cm-activeLine, .cm-activeLineGutter': {
        backgroundColor: isLight
          ? 'hsl(var(--heroui-default-100) / 0.65)'
          : 'hsl(var(--heroui-default-100) / 0.18)'
      },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
        backgroundColor: getSelectionBackground(isLight)
      },
      '&.cm-focused ::selection': {
        backgroundColor: getSelectionBackground(isLight)
      },
      '.cm-selectionMatch': {
        backgroundColor: getSelectionMatchBackground(isLight)
      },
      '.cm-cursor': {
        borderLeftColor: 'hsl(var(--heroui-primary))'
      },
      '.cm-foldGutter': {
        width: '18px'
      },
      '.cm-foldGutter .cm-gutterElement': {
        alignItems: 'center',
        display: 'flex',
        justifyContent: 'center',
        padding: '0'
      },
      '.cm-foldMarker': {
        alignItems: 'center',
        borderRadius: '4px',
        color: 'hsl(var(--heroui-default-500))',
        display: 'inline-flex',
        height: '16px',
        justifyContent: 'center',
        opacity: '0.72',
        transition: 'background-color 140ms ease, color 140ms ease, opacity 140ms ease',
        width: '16px'
      },
      '.cm-foldMarker::before': {
        borderBottom: '1.5px solid currentColor',
        borderRight: '1.5px solid currentColor',
        content: '""',
        height: '6px',
        transform: 'translateX(-1px) rotate(-45deg)',
        transformOrigin: '50% 50%',
        width: '6px'
      },
      '.cm-foldMarker-open::before': {
        transform: 'translateY(-1px) rotate(45deg)'
      },
      '.cm-foldGutter .cm-gutterElement:hover .cm-foldMarker': {
        backgroundColor: isLight
          ? 'hsl(var(--heroui-default-200) / 0.7)'
          : 'hsl(var(--heroui-default-200) / 0.24)',
        color: 'hsl(var(--heroui-foreground))',
        opacity: '1'
      },
      '.cm-tooltip': {
        border: '1px solid hsl(var(--heroui-default-200) / 0.75)',
        borderRadius: '8px',
        backgroundColor: 'hsl(var(--heroui-content1))',
        color: 'hsl(var(--heroui-foreground))',
        boxShadow: '0 12px 30px hsl(var(--heroui-foreground) / 0.12)'
      },
      '.cm-tooltip-autocomplete ul li[aria-selected]': {
        backgroundColor: 'hsl(var(--heroui-primary) / 0.14)',
        color: 'hsl(var(--heroui-foreground))'
      },
      '.cm-diagnostic': {
        padding: '2px 0'
      },
      '.cm-mergeView': {
        height: '100%'
      },
      '.cm-mergeViewEditors': {
        height: '100%'
      },
      '.cm-mergeViewEditor': {
        height: '100%'
      },
      '.cm-mergeViewEditor .cm-editor': {
        height: '100%'
      }
    },
    { dark: !isLight }
  )

const createExtensions = ({
  language,
  readOnly,
  isLight,
  onChangeRef,
  suppressChangeRef
}: {
  language: Language
  readOnly: boolean
  isLight: boolean
  onChangeRef?: RefObject<((value: string) => void) | undefined>
  suppressChangeRef?: RefObject<boolean>
}): Extension[] => [
  lineNumbers(),
  highlightActiveLineGutter(),
  foldGutter({
    markerDOM: createFoldMarker
  }),
  history(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  bracketMatching(),
  closeBrackets(),
  autocompletion(language === 'yaml' ? { override: [mihomoYamlCompletionSource] } : undefined),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  lintGutter(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  ...languageExtensions(language),
  EditorView.lineWrapping,
  EditorState.tabSize.of(['yaml', 'javascript', 'json'].includes(language) ? 2 : 4),
  EditorState.readOnly.of(readOnly),
  EditorView.editable.of(!readOnly),
  createTheme(isLight),
  keymap.of([
    indentWithTab,
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap
  ]),
  EditorView.updateListener.of((update) => {
    if (update.docChanged && !suppressChangeRef?.current) {
      onChangeRef?.current?.(update.state.doc.toString())
    }
  })
]

const replaceDocument = (
  view: EditorView,
  value: string,
  suppressChangeRef: RefObject<boolean>
): void => {
  if (view.state.doc.toString() === value) return

  suppressChangeRef.current = true
  try {
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: value
      }
    })
  } finally {
    suppressChangeRef.current = false
  }
}

const CodeMirrorEditorView: React.FC<CodeMirrorEditorViewProps> = ({
  value,
  extensions,
  suppressChangeRef,
  unifiedOriginalValue
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | undefined>(undefined)

  useEffect(() => {
    if (!containerRef.current) return

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: value,
        extensions:
          unifiedOriginalValue === undefined
            ? extensions
            : [
                ...extensions,
                unifiedMergeView({
                  original: unifiedOriginalValue,
                  gutter: true,
                  highlightChanges: true
                })
              ]
      })
    })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = undefined
    }
  }, [extensions, unifiedOriginalValue])

  useEffect(() => {
    const view = viewRef.current
    if (view) {
      replaceDocument(view, value, suppressChangeRef)
    }
  }, [suppressChangeRef, value])

  return <div ref={containerRef} className={editorContainerClassName} />
}

const CodeMirrorSideBySideDiffView: React.FC<CodeMirrorViewProps> = ({
  value,
  originalValue = '',
  diffOriginalLabel = translate('configViewer.diffSource'),
  diffModifiedLabel = translate('configViewer.diffModified'),
  language,
  extensions,
  suppressChangeRef
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const mergeViewRef = useRef<MergeView | undefined>(undefined)
  const { isLight } = useEditorSettings()
  const originalExtensions = useMemo(
    () =>
      createExtensions({
        language,
        readOnly: true,
        isLight
      }),
    [isLight, language]
  )

  useEffect(() => {
    if (!containerRef.current) return

    const mergeView = new MergeView({
      parent: containerRef.current,
      a: {
        doc: originalValue,
        extensions: originalExtensions
      },
      b: {
        doc: value,
        extensions
      },
      gutter: true,
      highlightChanges: true
    })
    mergeViewRef.current = mergeView

    return () => {
      mergeView.destroy()
      mergeViewRef.current = undefined
    }
  }, [extensions, originalExtensions, originalValue])

  useEffect(() => {
    const mergeView = mergeViewRef.current
    if (mergeView) {
      replaceDocument(mergeView.b, value, suppressChangeRef)
    }
  }, [suppressChangeRef, value])

  return (
    <div className={mergeViewWrapperClassName}>
      <div className={mergeHeaderClassName}>
        <div className={mergeHeaderItemClassName}>{diffOriginalLabel}</div>
        <div className={mergeHeaderItemClassName}>{diffModifiedLabel}</div>
      </div>
      <div ref={containerRef} className={mergeContainerClassName} />
    </div>
  )
}

export const BaseEditorCodeMirror: React.FC<BaseEditorProps> = (props) => {
  const { isLight } = useEditorSettings()
  const {
    originalValue,
    diffRenderSideBySide = false,
    readOnly = false,
    language,
    onChange
  } = props
  const onChangeRef = useRef(onChange)
  const suppressChangeRef = useRef(false)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const extensions = useMemo(
    () =>
      createExtensions({
        language,
        readOnly,
        isLight,
        onChangeRef,
        suppressChangeRef
      }),
    [isLight, language, readOnly]
  )

  const runtimeProps = {
    ...props,
    extensions,
    suppressChangeRef
  }

  if (originalValue !== undefined) {
    if (diffRenderSideBySide) {
      return <CodeMirrorSideBySideDiffView {...runtimeProps} />
    }

    return <CodeMirrorEditorView {...runtimeProps} unifiedOriginalValue={originalValue} />
  }

  return <CodeMirrorEditorView {...runtimeProps} />
}
