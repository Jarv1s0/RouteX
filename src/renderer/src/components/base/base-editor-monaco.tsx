import { useEffect, useRef, useState } from 'react'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import MonacoEditor, { MonacoDiffEditor } from 'react-monaco-editor'
import { useTheme } from 'next-themes'
import { nanoid } from 'nanoid'
import React from 'react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import type { BaseEditorProps } from './base-editor.shared'

let javascriptLibInitialized = false

const ensureJavaScriptSupport = (): void => {
  if (!javascriptLibInitialized) {
    javascriptLibInitialized = true
    void import('types-pac/pac.d.ts?raw').then((module) => {
      const pacTypes = typeof module === 'string' ? module : module.default
      monaco.languages.typescript.javascriptDefaults.addExtraLib(pacTypes, 'pac.d.ts')
    })
  }
}

export const BaseEditorMonaco: React.FC<BaseEditorProps> = (props) => {
  const { theme, systemTheme } = useTheme()
  const trueTheme = theme === 'system' ? systemTheme : theme
  const {
    value,
    originalValue,
    diffRenderSideBySide = false,
    readOnly = false,
    language,
    onChange
  } = props
  const [yamlReady, setYamlReady] = useState(language !== 'yaml')
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>(undefined)
  const diffEditorRef = useRef<monaco.editor.IStandaloneDiffEditor>(undefined)

  const editorWillMount = (): void => {
    if (language === 'javascript') {
      ensureJavaScriptSupport()
    }
  }

  useEffect(() => {
    if (language !== 'yaml') {
      setYamlReady(true)
      return
    }

    let active = true
    setYamlReady(false)
    void import('./base-editor-monaco-yaml')
      .then(async ({ configureMonacoYamlSupport }) => {
        await configureMonacoYamlSupport(monaco)
        if (active) {
          setYamlReady(true)
        }
      })
      .catch((error) => {
        console.error('[base-editor] failed to initialize yaml support', error)
        if (active) {
          setYamlReady(true)
        }
      })

    return () => {
      active = false
    }
  }, [language])

  if (!yamlReady) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-default-500">
        加载 YAML 编辑器...
      </div>
    )
  }

  const editorDidMount = (editor: monaco.editor.IStandaloneCodeEditor): void => {
    editorRef.current = editor

    const uri = monaco.Uri.parse(`${nanoid()}.${language === 'yaml' ? 'clash' : ''}.${language}`)
    const model = monaco.editor.createModel(value, language, uri)
    editorRef.current.setModel(model)
  }

  const diffEditorDidMount = (editor: monaco.editor.IStandaloneDiffEditor): void => {
    diffEditorRef.current = editor

    const originalUri = monaco.Uri.parse(
      `original-${nanoid()}.${language === 'yaml' ? 'clash' : ''}.${language}`
    )
    const modifiedUri = monaco.Uri.parse(
      `modified-${nanoid()}.${language === 'yaml' ? 'clash' : ''}.${language}`
    )
    const originalModel = monaco.editor.createModel(originalValue || '', language, originalUri)
    const modifiedModel = monaco.editor.createModel(value, language, modifiedUri)
    diffEditorRef.current.setModel({
      original: originalModel,
      modified: modifiedModel
    })
  }

  const options = {
    tabSize: ['yaml', 'javascript', 'json'].includes(language) ? 2 : 4,
    minimap: {
      enabled: document.documentElement.clientWidth >= 1500
    },
    mouseWheelZoom: true,
    readOnly,
    renderValidationDecorations: 'on' as 'off' | 'on' | 'editable',
    quickSuggestions: {
      strings: true,
      comments: true,
      other: true
    },
    fontFamily: `Maple Mono NF CN,Fira Code, JetBrains Mono, Roboto Mono, "Source Code Pro", Consolas, Menlo, Monaco, monospace, "Courier New", "Apple Color Emoji", "Noto Color Emoji"`,
    fontLigatures: true,
    smoothScrolling: !disableAnimation,
    pixelRatio: window.devicePixelRatio,
    renderSideBySide: diffRenderSideBySide,
    glyphMargin: false,
    folding: true,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    wordWrap: 'on' as const,
    cursorBlinking: (disableAnimation ? 'solid' : 'blink') as 'solid' | 'blink',
    cursorSmoothCaretAnimation: (disableAnimation ? 'off' : 'on') as 'off' | 'on',
    scrollbar: {
      useShadows: !disableAnimation,
      verticalScrollbarSize: disableAnimation ? 10 : 14,
      horizontalScrollbarSize: disableAnimation ? 10 : 14
    },
    suggest: {
      insertMode: (disableAnimation ? 'replace' : 'insert') as 'replace' | 'insert',
      showIcons: !disableAnimation
    },
    hover: {
      enabled: !disableAnimation,
      delay: disableAnimation ? 0 : 300
    }
  }

  if (originalValue !== undefined) {
    return (
      <MonacoDiffEditor
        language={language}
        original={originalValue}
        value={value}
        height="100%"
        theme={trueTheme?.includes('light') ? 'vs' : 'vs-dark'}
        options={options}
        editorWillMount={editorWillMount}
        editorDidMount={diffEditorDidMount}
        editorWillUnmount={(): void => {
          diffEditorRef.current?.getModel()?.original?.dispose()
          diffEditorRef.current?.getModel()?.modified?.dispose()
        }}
        onChange={onChange}
      />
    )
  }

  return (
    <MonacoEditor
      language={language}
      value={value}
      height="100%"
      theme={trueTheme?.includes('light') ? 'vs' : 'vs-dark'}
      options={options}
      editorWillMount={editorWillMount}
      editorDidMount={editorDidMount}
      editorWillUnmount={(): void => {
        editorRef.current?.getModel()?.dispose()
      }}
      onChange={onChange}
    />
  )
}
