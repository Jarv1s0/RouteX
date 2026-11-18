declare module 'virtual:mihomo-validator' {
  import type { ValidateFunction } from 'ajv'
  const validate: ValidateFunction
  export default validate
}
