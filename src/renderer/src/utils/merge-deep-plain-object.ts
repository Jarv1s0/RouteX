function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function mergeDeepPlainObject<T>(target: T, patch: Partial<T>): T {
  const result = structuredClone(target)

  const mergeInto = (base: Record<string, unknown>, source: Record<string, unknown>) => {
    Object.entries(source).forEach(([key, value]) => {
      if (isPlainObject(value) && isPlainObject(base[key])) {
        mergeInto(base[key] as Record<string, unknown>, value)
        return
      }

      base[key] = value
    })
  }

  mergeInto(result as Record<string, unknown>, patch as Record<string, unknown>)
  return result
}

