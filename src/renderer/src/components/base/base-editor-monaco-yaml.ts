import { configureMonacoYaml } from 'monaco-yaml'
import metaSchema from 'meta-json-schema/schemas/meta-json-schema.json'
import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api'

type SchemaRecord = Record<string, unknown>

let initialized = false

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

export function configureMonacoYamlSupport(monaco: typeof Monaco): void {
  if (initialized) return

  configureMonacoYaml(monaco, {
    validate: true,
    enableSchemaRequest: true,
    schemas: [
      {
        uri: 'http://example.com/meta-json-schema.json',
        fileMatch: ['**/*.clash.yaml'],
        schema: {
          ...createPatchedMetaSchema(),
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
