export type ConfigPatch<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: ConfigPatch<T[K]> | null }
    : T

export interface ConfigChange {
  app?: Partial<AppConfig>
  core?: ConfigPatch<MihomoConfig>
  restart?: boolean
}

export interface TrafficStats {
  hourly: { hour: string; upload: number; download: number }[]
  daily: { date: string; upload: number; download: number }[]
  lastUpdate: number
  sessionUpload: number
  sessionDownload: number
}

// Extend this map as domain wrappers migrate from caller-supplied return types.
export interface IpcInvokeContract {
  getAppConfig: { args: [force?: boolean]; result: Partial<AppConfig> }
  patchAppConfig: { args: [patch: Partial<AppConfig>]; result: void }
  getControledMihomoConfig: { args: [force?: boolean]; result: Partial<MihomoConfig> }
  patchControledMihomoConfig: { args: [patch: Partial<MihomoConfig>]; result: void }
  applyConfig: { args: [change: ConfigChange]; result: { controller?: string } }
  getRuntimeConfig: { args: []; result: Partial<MihomoConfig> }
  getRuntimeConfigStr: { args: []; result: string }
  mihomoConnections: { args: []; result: ControllerConnections }
  mihomoCloseConnection: { args: [id: string]; result: void }
  mihomoCloseAllConnections: { args: [group?: string]; result: void }
  getTrafficStats: { args: []; result: TrafficStats }
  clearTrafficStats: { args: []; result: void }
}
