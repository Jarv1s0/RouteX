declare module '@tauri-apps/plugin-deep-link' {
  export function getCurrent(): Promise<string[]>
  export function onOpenUrl(
    callback: (urls: string[]) => void | Promise<void>
  ): Promise<() => void> | (() => void)
}
