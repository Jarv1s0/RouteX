import { desktop } from '@renderer/api/desktop'
import { getVersion } from '@renderer/api/app'
// const originError = console.error
// const originWarn = console.warn
// console.error = function (...args: any[]): void {
//   if (typeof args[0] === 'string' && args[0].includes('validateDOMNesting')) {
//     return
//   }
//   originError.call(console, args)
// }
// console.warn = function (...args): void {
//   if (typeof args[0] === 'string' && args[0].includes('aria-label')) {
//     return
//   }
//   originWarn.call(console, args)
// }

export const platform: NodeJS.Platform = desktop.platform
export let version: string = ''

export async function init(): Promise<void> {
  version = await getVersion()
}
