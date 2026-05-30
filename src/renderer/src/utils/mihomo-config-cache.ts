class MihomoConfigCache {
  private tauriControlledConfigCache: Partial<MihomoConfig> | null = null
  private tauriRuntimeConfigCache: MihomoConfig | null = null
  private tauriRuntimeConfigStrCache: string | null = null

  public tauriRuntimeConfigPromise: Promise<MihomoConfig> | null = null
  public tauriRuntimeConfigStrPromise: Promise<string> | null = null
  public tauriRuntimeConfigRevision = 0

  private latestVersionCache = new Map<boolean, { value: string | null; at: number }>()
  private latestVersionPromiseCache = new Map<boolean, Promise<string | null>>()
  private inFlightMihomoRequests = new Map<string, Promise<unknown>>()

  private readonly CHECK_LATEST_VERSION_CACHE_MS = 3 * 60 * 1000

  // Controlled Config
  public getControlledConfig(): Partial<MihomoConfig> | null {
    return this.tauriControlledConfigCache
  }

  public setControlledConfig(config: Partial<MihomoConfig> | null): void {
    this.tauriControlledConfigCache = config
  }

  public patchControlledConfig(patch: Partial<MihomoConfig>): void {
    this.tauriControlledConfigCache = {
      ...(this.tauriControlledConfigCache || {}),
      ...patch
    }
  }

  // Runtime Config
  public getRuntimeConfig(): MihomoConfig | null {
    return this.tauriRuntimeConfigCache
  }

  public setRuntimeConfig(config: MihomoConfig | null): void {
    this.tauriRuntimeConfigCache = config
  }

  public getRuntimeConfigStr(): string | null {
    return this.tauriRuntimeConfigStrCache
  }

  public setRuntimeConfigStr(configStr: string | null): void {
    this.tauriRuntimeConfigStrCache = configStr
  }

  public invalidateRuntimeConfigCache(): void {
    this.tauriRuntimeConfigCache = null
    this.tauriRuntimeConfigStrCache = null
    this.tauriRuntimeConfigPromise = null
    this.tauriRuntimeConfigStrPromise = null
    this.tauriRuntimeConfigRevision += 1
  }

  // Version Cache
  public getCachedLatestVersion(isAlpha: boolean): string | null | undefined {
    const cached = this.latestVersionCache.get(isAlpha)
    if (cached && Date.now() - cached.at < this.CHECK_LATEST_VERSION_CACHE_MS) {
      return cached.value
    }
    return undefined // undefined means cache miss
  }

  public setCachedLatestVersion(isAlpha: boolean, value: string | null): void {
    this.latestVersionCache.set(isAlpha, { value, at: Date.now() })
  }

  public getVersionPromise(isAlpha: boolean): Promise<string | null> | undefined {
    return this.latestVersionPromiseCache.get(isAlpha)
  }

  public setVersionPromise(isAlpha: boolean, promise: Promise<string | null>): void {
    this.latestVersionPromiseCache.set(isAlpha, promise)
  }

  public deleteVersionPromise(isAlpha: boolean): void {
    this.latestVersionPromiseCache.delete(isAlpha)
  }

  // Deduplication
  public dedupeRequest<T>(key: string, requestFactory: () => Promise<T>): Promise<T> {
    const existing = this.inFlightMihomoRequests.get(key) as Promise<T> | undefined
    if (existing) {
      return existing
    }

    let request: Promise<T>
    request = requestFactory().finally(() => {
      if (this.inFlightMihomoRequests.get(key) === request) {
        this.inFlightMihomoRequests.delete(key)
      }
    })
    this.inFlightMihomoRequests.set(key, request)
    return request
  }

  public createRequestKey(channel: string, ...args: Array<string | undefined>): string {
    return JSON.stringify([channel, ...args.map((arg) => arg ?? '')])
  }

  public clearInFlightRequests(...keys: string[]): void {
    keys.forEach((key) => this.inFlightMihomoRequests.delete(key))
  }
}

export const mihomoConfigCache = new MihomoConfigCache()
