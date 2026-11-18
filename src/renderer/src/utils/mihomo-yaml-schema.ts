import rawSchema from 'meta-json-schema/schemas/meta-json-schema.json'
import { version as schemaVersion } from 'meta-json-schema/package.json'
import { isMap, isSeq, isScalar, parseDocument } from 'yaml'

export type YamlPath = (string | number)[]
export interface MihomoSchema {
  $ref?: string
  type?: string | string[]
  title?: string
  description?: string
  markdownDescription?: string
  deprecationMessage?: string
  doNotSuggest?: boolean
  enum?: unknown[]
  const?: unknown
  default?: unknown
  properties?: Record<string, MihomoSchema>
  patternProperties?: Record<string, MihomoSchema>
  additionalProperties?: boolean | MihomoSchema
  items?: MihomoSchema
  allOf?: MihomoSchema[]
  anyOf?: MihomoSchema[]
  oneOf?: MihomoSchema[]
  if?: MihomoSchema
  then?: MihomoSchema
  else?: MihomoSchema
  required?: string[]
}
export const MIHOMO_SCHEMA_VERSION = schemaVersion
const rootSchema = rawSchema as MihomoSchema

function reference(ref: string): MihomoSchema | undefined {
  if (!ref.startsWith('#/')) return
  let node: unknown = rawSchema
  for (const key of ref
    .slice(2)
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))) {
    if (!node || typeof node !== 'object') return
    node = (node as Record<string, unknown>)[key]
  }
  return typeof node === 'object' && node !== null ? (node as MihomoSchema) : undefined
}
function matches(schema: MihomoSchema, value: unknown, checkRequired = true): boolean {
  if (!checkRequired && value == null) return true
  if (schema.$ref) return matches(reference(schema.$ref) || {}, value, checkRequired)
  if ('const' in schema && JSON.stringify(schema.const) !== JSON.stringify(value)) return false
  if (schema.enum && !schema.enum.some((item) => JSON.stringify(item) === JSON.stringify(value)))
    return false
  if (schema.allOf && !schema.allOf.every((item) => matches(item, value, checkRequired)))
    return false
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    if (checkRequired && schema.required?.some((key) => !(key in record))) return false
    for (const [key, child] of Object.entries(schema.properties || {})) {
      if (key in record && !matches(child, record[key], checkRequired)) return false
    }
  }
  return true
}
export function expandSchema(
  schema: MihomoSchema,
  value?: unknown,
  seen = new Set<string>(),
  depth = 0
): MihomoSchema {
  if (depth > 32) return {}
  let merged: MihomoSchema = { ...schema }
  const combine = (next: MihomoSchema): void => {
    const properties = { ...merged.properties }
    for (const [key, property] of Object.entries(next.properties || {})) {
      const previous = properties[key]
      properties[key] = previous
        ? { anyOf: [...(previous.anyOf || [previous]), property] }
        : property
    }
    const types = [
      ...new Set([
        ...(Array.isArray(merged.type) ? merged.type : merged.type ? [merged.type] : []),
        ...(Array.isArray(next.type) ? next.type : next.type ? [next.type] : [])
      ])
    ]
    merged = {
      ...merged,
      ...next,
      properties,
      required: [...new Set([...(merged.required || []), ...(next.required || [])])],
      type: types.length === 1 ? types[0] : types.length ? types : undefined,
      enum: [
        ...new Set([
          ...(merged.enum || []),
          ...('const' in merged ? [merged.const] : []),
          ...(next.enum || []),
          ...('const' in next ? [next.const] : [])
        ])
      ]
    }
  }
  if (schema.$ref && !seen.has(schema.$ref)) {
    const nextSeen = new Set(seen).add(schema.$ref)
    combine(expandSchema(reference(schema.$ref) || {}, value, nextSeen, depth + 1))
  }
  for (const child of schema.allOf || []) combine(expandSchema(child, value, seen, depth + 1))
  const alternatives = [...(schema.anyOf || []), ...(schema.oneOf || [])]
  const discriminator =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>).type
      : undefined
  const discriminatorSchema = (child: MihomoSchema): MihomoSchema | undefined => {
    if (child.properties?.type) return child.properties.type
    if (child.$ref) return discriminatorSchema(reference(child.$ref) || {})
    return child.allOf?.map(discriminatorSchema).find(Boolean)
  }
  const discriminated =
    discriminator == null
      ? []
      : alternatives.filter((child) => {
          const field = discriminatorSchema(child)
          return field && matches(field, discriminator, false)
        })
  const applicable = discriminated.length
    ? discriminated
    : alternatives.filter((child) => matches(child, value, false))
  for (const child of applicable.length ? applicable : alternatives)
    combine(expandSchema(child, value, seen, depth + 1))
  if (schema.if) {
    const branch = matches(schema.if, value) ? schema.then : schema.else
    if (branch) combine(expandSchema(branch, value, seen, depth + 1))
  }
  return merged
}
export function schemaAtPath(path: YamlPath, data: unknown): MihomoSchema | undefined {
  let schema: MihomoSchema | undefined = rootSchema
  let value = data
  for (const key of path) {
    const expanded: MihomoSchema = expandSchema(schema || {}, value)
    schema =
      typeof key === 'number'
        ? expanded.items
        : expanded.properties?.[key] ||
          Object.entries(expanded.patternProperties || {}).find(([pattern]) =>
            new RegExp(pattern).test(key)
          )?.[1] ||
          (typeof expanded.additionalProperties === 'object'
            ? expanded.additionalProperties
            : undefined)
    if (!schema) return
    value =
      value && typeof value === 'object'
        ? (value as Record<string | number, unknown>)[key]
        : undefined
  }
  return expandSchema(schema || {}, value)
}
export interface YamlEntry {
  path: YamlPath
  keyFrom: number
  keyTo: number
  from: number
  to: number
  value: unknown
}
export function inspectYaml(text: string) {
  const document = parseDocument(text, { merge: true, uniqueKeys: true, prettyErrors: false })
  const entries: YamlEntry[] = []
  const walk = (node: unknown, path: YamlPath, depth: number): void => {
    if (depth > 64) return
    if (isMap(node))
      for (const pair of node.items) {
        if (!isScalar(pair.key)) continue
        const key = String(pair.key.value)
        const range = pair.key.range
        const valueRange =
          pair.value && typeof pair.value === 'object' && 'range' in pair.value
            ? (pair.value.range as [number, number, number] | undefined)
            : undefined
        const next = [...path, key]
        entries.push({
          path: next,
          keyFrom: range?.[0] || 0,
          keyTo: range?.[1] || 0,
          from: valueRange?.[0] ?? range?.[1] ?? 0,
          to: valueRange?.[1] ?? range?.[1] ?? 0,
          value: isScalar(pair.value) ? pair.value.value : undefined
        })
        walk(pair.value, next, depth + 1)
      }
    else if (isSeq(node))
      node.items.forEach((item, index) => walk(item, [...path, index], depth + 1))
  }
  walk(document.contents, [], 0)
  let data: unknown
  try {
    data = document.toJS({ maxAliasCount: 100 })
  } catch {
    /* Invalid or excessive aliases are diagnosed separately. */
  }
  return { document, entries, data }
}

export interface YamlCompletionContext {
  path: YamlPath
  key: boolean
  from: number
  to: number
  data: unknown
  existing: string[]
  suffix?: string
}
export function yamlCompletionContext(
  text: string,
  position: number
): YamlCompletionContext | undefined {
  const start = text.lastIndexOf('\n', position - 1) + 1
  const end = text.indexOf('\n', position)
  const line = text.slice(start, end < 0 ? text.length : end)
  const before = text.slice(start, position)
  if (before.trimStart().startsWith('#')) return
  const keyMatch = /^(\s*(?:-\s+)?)(["']?)([\w-]*)$/.exec(before)
  const flowMatch = /[{,]\s*(["']?)([\w-]*)$/.exec(before)
  const parsed = inspectYaml(text)
  if (keyMatch || flowMatch) {
    const sentinel = '__routex_completion_cursor__'
    const quote = keyMatch ? keyMatch[2] : flowMatch?.[1] || ''
    const from = keyMatch
      ? start + keyMatch[1].length + quote.length
      : position - (flowMatch?.[2].length || 0)
    const to = position + (/^[\w-]*/.exec(text.slice(position))?.[0].length || 0)
    const remainder = text.slice(to, start + line.length)
    const hasQuote = !!quote && remainder.startsWith(quote)
    const afterQuote = hasQuote ? remainder.slice(1) : remainder
    const suffix = quote + (afterQuote.trimStart().startsWith(':') ? '' : ': ')
    const synthetic = inspectYaml(
      keyMatch
        ? text.slice(0, start) + keyMatch[1] + sentinel + ': null' + text.slice(start + line.length)
        : text.slice(0, from - quote.length) +
            sentinel +
            ': null' +
            text.slice(to + (hasQuote ? 1 : 0))
    )
    const entry = synthetic.entries.find((item) => item.path.at(-1) === sentinel)
    if (!entry) return
    const path = entry.path.slice(0, -1)
    const parent = path.reduce<unknown>(
      (value, key) =>
        value && typeof value === 'object'
          ? (value as Record<string | number, unknown>)[key]
          : undefined,
      parsed.data
    )
    return {
      path,
      key: true,
      from,
      to: to + (hasQuote ? 1 : 0),
      suffix,
      data: parsed.data,
      existing: parent && typeof parent === 'object' ? Object.keys(parent) : []
    }
  }
  const entry = parsed.entries
    .filter(
      (item) =>
        (item.from <= position && position <= item.to) ||
        (item.keyTo < position && text.slice(item.keyTo, position).trim() === ':')
    )
    .sort((a, b) => b.path.length - a.path.length)[0]
  if (!entry || /[|>]\s*(?:#.*)?$/.test(text.slice(entry.keyTo + 1, entry.from))) return
  // A block scalar's range may include lines far beyond its key.
  const valueText = text.slice(entry.from, entry.to)
  if (/^[|>]/.test(valueText)) return
  const token = /[\w-]*$/.exec(before)?.[0] || ''
  return {
    path: entry.path,
    key: false,
    from: position - token.length,
    to: position + (/^[\w-]*/.exec(text.slice(position))?.[0].length || 0),
    data: parsed.data,
    existing: []
  }
}

export function minimumMihomoVersion(path: YamlPath, value: unknown): string | undefined {
  if (path[0] === 'tun' || (path[0] === 'listeners' && typeof path[1] === 'number')) {
    if (path.at(-1) === 'dns-mode') return '1.19.33'
    if (path.at(-1) === 'congestion-controller' || (path.at(-1) === 'stack' && value === 'mips'))
      return '1.19.32'
  }
  if (path[0] === 'proxies' && path.at(-1) === 'type') {
    return (
      {
        shadowquic: '1.19.29',
        zerotier: '1.19.30',
        easytier: '1.19.31',
        openvpn: '1.19.28',
        tailscale: '1.19.28',
        'gost-relay': '1.19.28'
      } as Record<string, string>
    )[String(value)]
  }
}
export function stableVersionBefore(version: string | undefined, minimum: string): boolean {
  const parsed = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version || '')
  if (!parsed) return false
  const target = minimum.split('.').map(Number)
  for (let index = 0; index < 3; index++) {
    const difference = Number(parsed[index + 1]) - target[index]
    if (difference) return difference < 0
  }
  return false
}
