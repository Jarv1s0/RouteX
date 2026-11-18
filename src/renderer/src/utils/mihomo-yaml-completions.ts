import {
  inspectYaml,
  schemaAtPath,
  yamlCompletionContext,
  minimumMihomoVersion,
  MIHOMO_SCHEMA_VERSION
} from './mihomo-yaml-schema'

export interface YamlCompletionOption {
  label: string
  type: string
  detail?: string
  info?: string
  apply: string
}
export function completeMihomoYaml(text: string, position: number) {
  if (text.length > 2 * 1024 * 1024 || text.split('\n').length > 10000) return null
  const location = yamlCompletionContext(text, position)
  if (!location) return null
  const schema = schemaAtPath(location.path, location.data)
  const options: YamlCompletionOption[] = []
  if (location.key) {
    for (const [key, field] of Object.entries(schema?.properties || {})) {
      if (
        field.doNotSuggest ||
        (location.existing.includes(key) && key !== text.slice(location.from, location.to))
      )
        continue
      const resolved = schemaAtPath([...location.path, key], location.data) || field
      options.push({
        label: key,
        type: 'property',
        detail: resolved.title,
        info: resolved.description || resolved.markdownDescription,
        apply: key + (location.suffix || '')
      })
    }
  } else {
    const booleanType = schema?.type === 'boolean' || schema?.type?.includes('boolean')
    const choices = [
      ...new Set([
        ...(schema?.enum || []),
        ...('const' in (schema || {}) ? [schema?.const] : []),
        ...(booleanType ? [true, false] : [])
      ])
    ]
    for (const value of choices) {
      if (!['string', 'number', 'boolean'].includes(typeof value)) continue
      const label = String(value)
      const quote = text[location.from - 1]
      const minimum = minimumMihomoVersion(location.path, value)
      options.push({
        label,
        type: typeof value === 'boolean' ? 'keyword' : 'enum',
        detail: minimum ? `Mihomo ≥ ${minimum}` : undefined,
        apply:
          quote === '"' || quote === "'"
            ? label
            : typeof value === 'string' && /^(?:true|false|null|\d+|)$/.test(value)
              ? JSON.stringify(value)
              : label
      })
    }
  }
  return {
    from: location.from,
    to: location.to,
    options,
    snippets: location.key && location.path.length === 0
  }
}

export function hoverMihomoYaml(text: string, position: number) {
  if (text.length > 2 * 1024 * 1024 || text.split('\n').length > 10000) return null
  const { entries, data } = inspectYaml(text)
  const entry = entries.find((item) => item.keyFrom <= position && position <= item.keyTo)
  if (!entry) return null
  const field = schemaAtPath(entry.path, data)
  if (!field) return null
  const minimum = minimumMihomoVersion(entry.path, entry.value)
  return {
    from: entry.keyFrom,
    to: entry.keyTo,
    description: [
      field.title,
      field.description || field.markdownDescription,
      field.enum?.length ? field.enum.map(String).join(' | ') : undefined,
      minimum ? `Mihomo ≥ ${minimum}` : undefined,
      `Schema ${MIHOMO_SCHEMA_VERSION}`
    ]
      .filter(Boolean)
      .join('\n')
  }
}
