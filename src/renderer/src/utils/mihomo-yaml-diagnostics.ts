import validate from 'virtual:mihomo-validator'
import {
  inspectYaml,
  schemaAtPath,
  minimumMihomoVersion,
  stableVersionBefore,
  MIHOMO_SCHEMA_VERSION,
  type YamlPath
} from './mihomo-yaml-schema'

export interface MihomoYamlOptions {
  version?: string
  locale?: string
  mode?: 'auto' | 'config' | 'merge'
}
export interface YamlDiagnostic {
  from: number
  to: number
  severity: 'error' | 'warning' | 'info'
  message: string
}

export function diagnoseMihomoYaml(
  text: string,
  options: MihomoYamlOptions = {}
): YamlDiagnostic[] {
  const zh = options.locale !== 'en-US'
  if (!text.trim()) return []
  if (text.length > 2 * 1024 * 1024 || text.split('\n').length > 10000)
    return [
      {
        from: 0,
        to: 0,
        severity: 'info',
        message: zh
          ? '文件超过实时校验大小限制（2 MiB / 10000 行），已跳过。保存时仍由内核校验。'
          : 'Live validation skipped above 2 MiB / 10000 lines. The core still validates on save.'
      }
    ]
  const { document, entries, data } = inspectYaml(text)
  const diagnostics: YamlDiagnostic[] = document.errors.map((error) => ({
    from: error.pos[0],
    to: Math.min(text.length, error.pos[1]),
    severity: 'error',
    message: error.message
  }))
  if (diagnostics.length) return diagnostics.slice(0, 100)
  if (data === undefined)
    return [
      {
        from: 0,
        to: 0,
        severity: 'warning',
        message: zh
          ? '无法展开 YAML 引用，已跳过语义校验。'
          : 'YAML aliases could not be resolved; semantic validation skipped.'
      }
    ]
  if (
    options.mode !== 'config' &&
    options.mode !== 'merge' &&
    (!data || typeof data !== 'object' || Array.isArray(data) || 'payload' in data)
  )
    return []
  const locate = (path: YamlPath) => {
    const entry = entries.find((item) => JSON.stringify(item.path) === JSON.stringify(path))
    return entry
      ? { from: entry.from, to: Math.min(entry.to, entry.from + 100) }
      : { from: 0, to: 0 }
  }
  validate(data)
  const errors = validate.errors || []
  const seen = new Set<string>()
  // Schema mismatches are advisory: development kernels can accept newer fields.
  // Do not include the supplied value in messages (it may contain credentials).
  for (const error of errors) {
    if (!['type', 'enum', 'minimum', 'maximum', 'pattern', 'required'].includes(error.keyword))
      continue
    const path: YamlPath = error.instancePath
      .split('/')
      .slice(1)
      .map((part) =>
        /^\d+$/.test(part) ? Number(part) : part.replace(/~1/g, '/').replace(/~0/g, '~')
      )
    if (options.mode === 'merge' && error.keyword === 'required') continue
    // Wrong union branches generate many type/enum errors; only report errors
    // that also describe the selected discriminator branch.
    const field = schemaAtPath(path, data)
    if (!field) continue
    if (
      error.keyword === 'required' &&
      !field.required?.includes(String(error.params.missingProperty))
    )
      continue
    const value = path.reduce<unknown>(
      (node, key) =>
        node && typeof node === 'object'
          ? (node as Record<string | number, unknown>)[key]
          : undefined,
      data
    )
    if (error.keyword === 'type') {
      const expected = Array.isArray(field.type) ? field.type : field.type ? [field.type] : []
      const actual = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value
      if (
        !expected.length ||
        expected.includes(actual) ||
        (actual === 'number' && expected.includes('integer') && Number.isInteger(value))
      )
        continue
    }
    if (error.keyword === 'enum' && (!field.enum?.length || field.enum.includes(value))) continue
    const key =
      path.join('.') +
      error.keyword +
      (error.keyword === 'required' ? String(error.params.missingProperty) : '')
    if (seen.has(key)) continue
    seen.add(key)
    const label = path.join('.') || (zh ? '配置' : 'Config')
    const detail =
      error.keyword === 'type'
        ? zh
          ? `类型应为 ${(Array.isArray(field.type) ? field.type : [field.type]).join(' / ')}`
          : `Expected ${(Array.isArray(field.type) ? field.type : [field.type]).join(' / ')}`
        : error.keyword === 'enum'
          ? zh
            ? `可选值：${field.enum?.map(String).join(', ')}`
            : `Allowed: ${field.enum?.map(String).join(', ')}`
          : error.keyword === 'required'
            ? zh
              ? `缺少字段 ${String(error.params.missingProperty)}`
              : `Missing field ${String(error.params.missingProperty)}`
            : zh
              ? '值不符合字段约束'
              : 'Value does not satisfy field constraints'
    diagnostics.push({
      ...locate(path),
      severity: 'warning',
      message: `${label}: ${detail} (${zh ? '参考 schema' : 'schema'} ${MIHOMO_SCHEMA_VERSION})`
    })
    if (diagnostics.length >= 80) break
  }
  for (const entry of entries) {
    if (diagnostics.length >= 100) break
    const field = schemaAtPath(entry.path, data)
    // Mihomo ignores unknown fields, including custom YAML anchor definitions.
    // Schema coverage alone is not evidence of an invalid core configuration.
    if (field?.deprecationMessage)
      diagnostics.push({
        from: entry.keyFrom,
        to: entry.keyTo,
        severity: 'warning',
        message: field.deprecationMessage
      })
    const minimum = minimumMihomoVersion(entry.path, entry.value)
    if (minimum && stableVersionBefore(options.version, minimum))
      diagnostics.push({
        from: entry.keyFrom,
        to: entry.to,
        severity: 'warning',
        message: zh
          ? `此选项需要 Mihomo v${minimum} 或更新版本；当前为 ${options.version}。`
          : `Requires Mihomo v${minimum} or later; current core: ${options.version}.`
      })
  }
  return diagnostics.slice(0, 100)
}
