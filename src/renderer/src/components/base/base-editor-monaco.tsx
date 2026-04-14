import { useRef } from 'react'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import MonacoEditor, { MonacoDiffEditor } from 'react-monaco-editor'
import { configureMonacoYaml } from 'monaco-yaml'
import metaSchema from 'meta-json-schema/schemas/meta-json-schema.json'
import { useTheme } from 'next-themes'
import { nanoid } from 'nanoid'
import React from 'react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import type { BaseEditorProps } from './base-editor.shared'

let initialized = false
let javascriptLibInitialized = false

type SchemaRecord = Record<string, unknown>

const getSchemaProperties = (
  schema: SchemaRecord,
  path: string[]
): SchemaRecord | undefined => {
  let current: unknown = schema

  for (const segment of path) {
    if (!current || typeof current !== 'object') return undefined
    current = (current as SchemaRecord)[segment]
  }

  if (!current || typeof current !== 'object') return undefined
  const properties = (current as SchemaRecord).properties
  return properties && typeof properties === 'object'
    ? (properties as SchemaRecord)
    : undefined
}

const createPatchedMetaSchema = (): Record<string, unknown> => {
  const schema = structuredClone(metaSchema) as SchemaRecord
  const scMaxEachPostBytes = {
    $ref: '#/definitions/proxies/definitions/shadowsocksr/definitions/compatible/integer',
    title: '单次 POST 最大字节数',
    description: '限制 xhttp 单次 POST 请求体的最大字节数，单位: bytes',
    markdownDescription: '限制 `xhttp` 单次 `POST` 请求体的最大字节数，单位: `bytes`'
  }

  const xhttpClientProperties = getSchemaProperties(schema, [
    'definitions',
    'proxies',
    'definitions',
    'vless',
    'definitions',
    'xhttp-opts'
  ])
  if (xhttpClientProperties && !('sc-max-each-post-bytes' in xhttpClientProperties)) {
    xhttpClientProperties['sc-max-each-post-bytes'] = scMaxEachPostBytes
  }

  const xhttpListenerProperties = getSchemaProperties(schema, [
    'definitions',
    'listeners',
    'definitions',
    'vless',
    'definitions',
    'xhttp-config'
  ])
  if (xhttpListenerProperties && !('sc-max-each-post-bytes' in xhttpListenerProperties)) {
    xhttpListenerProperties['sc-max-each-post-bytes'] = scMaxEachPostBytes
  }

  return schema
}

const patchedMetaSchema = createPatchedMetaSchema()

const monacoInitialization = (): void => {
  if (initialized) return

  configureMonacoYaml(monaco, {
    validate: true,
    enableSchemaRequest: true,
    schemas: [
      {
        uri: 'http://example.com/meta-json-schema.json',
        fileMatch: ['**/*.clash.yaml'],
        schema: {
          ...patchedMetaSchema,
          patternProperties: {
            '\\+rules': {
              type: 'array',
              $ref: '#/definitions/rules',
              description: '“+”开头表示将内容插入到原数组前面'
            },
            'rules\\+': {
              type: 'array',
              $ref: '#/definitions/rules',
              description: '“+”结尾表示将内容追加到原数组后面'
            },
            '\\+proxies': {
              type: 'array',
              $ref: '#/definitions/proxies',
              description: '“+”开头表示将内容插入到原数组前面'
            },
            'proxies\\+': {
              type: 'array',
              $ref: '#/definitions/proxies',
              description: '“+”结尾表示将内容追加到原数组后面'
            },
            '\\+proxy-groups': {
              type: 'array',
              $ref: '#/definitions/proxy-groups',
              description: '“+”开头表示将内容插入到原数组前面'
            },
            'proxy-groups\\+': {
              type: 'array',
              $ref: '#/definitions/proxy-groups',
              description: '“+”结尾表示将内容追加到原数组后面'
            },
            '^\\+': {
              type: 'array',
              description: '“+”开头表示将内容插入到原数组前面'
            },
            '\\+$': {
              type: 'array',
              description: '“+”结尾表示将内容追加到原数组后面'
            },
            '!$': {
              type: 'object',
              description: '“!”结尾表示强制覆盖该项而不进行递归合并'
            }
          }
        }
      }
    ]
  })

  initialized = true
}

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
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>(undefined)
  const diffEditorRef = useRef<monaco.editor.IStandaloneDiffEditor>(undefined)

  const editorWillMount = (): void => {
    monacoInitialization()
    if (language === 'javascript') {
      ensureJavaScriptSupport()
    }
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
