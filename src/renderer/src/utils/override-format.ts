export const OVERRIDE_FILE_EXTENSIONS = ['js', 'yml', 'yaml']

export const DEFAULT_JAVASCRIPT_OVERRIDE = 'function main(config) {\n  return config\n}'

export function inferOverrideExt(fileName?: string): 'js' | 'yaml' {
  return fileName?.endsWith('.js') ? 'js' : 'yaml'
}
