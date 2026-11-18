import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import Ajv from 'ajv'
import standaloneCode from 'ajv/dist/standalone/index.js'
import type { Plugin } from 'vite'

const require = createRequire(import.meta.url)
const schema = JSON.parse(
  readFileSync(require.resolve('meta-json-schema/schemas/meta-json-schema.json'), 'utf8')
)
let compiled: string | undefined

// Compile at build/test time: the production CSP deliberately forbids unsafe-eval.
export function mihomoSchemaPlugin(): Plugin {
  return {
    name: 'routex-mihomo-schema',
    resolveId(id) {
      if (id === 'virtual:mihomo-validator') return '\0' + id
    },
    load(id) {
      if (id !== '\0virtual:mihomo-validator') return
      if (!compiled) {
        const ajv = new Ajv({
          strict: false,
          validateFormats: false,
          allErrors: true,
          code: { source: true, esm: true }
        })
        compiled = standaloneCode(ajv, ajv.compile(schema)).replace(
          /const (\w+) = require\("([^"]+)"\)\.default;/g,
          'import $1 from "$2.js";'
        )
      }
      return compiled
    }
  }
}
