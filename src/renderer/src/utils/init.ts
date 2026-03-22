import { getVersion } from './ipc'
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

const platformFromBridge = window.api?.platform ?? window.electron?.process?.platform

if (!platformFromBridge) {
  throw new Error('Preload bridge is unavailable: window.api.platform is missing')
}

export const platform: NodeJS.Platform = platformFromBridge
export let version: string = ''

export async function init(): Promise<void> {
  version = await getVersion()
}
