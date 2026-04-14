declare module '@tauri-apps/api/core' {
  export type InvokeArgs = Record<string, unknown> | number[] | ArrayBuffer | Uint8Array

  export function invoke<T>(cmd: string, args?: InvokeArgs): Promise<T>
}
