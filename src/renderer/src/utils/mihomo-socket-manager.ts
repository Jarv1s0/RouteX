import { C, invokeSafe, invokeTyped } from './ipc-core'
import { desktop, emitDesktopEvent } from '@renderer/api/desktop'
import { IPC_ON_CHANNELS } from '../../../shared/ipc'

type TauriSocketKey = 'memory' | 'logs' | 'connections'

type MihomoSocketManagerOptions = {
  getRuntimeConfig: () => Promise<MihomoConfig>
  readTauriControledMihomoConfig: () => Partial<MihomoConfig>
  invalidateRuntimeConfigCache: () => void
}

export class MihomoSocketManager {
  private tauriSockets: Partial<Record<TauriSocketKey, WebSocket>> = {}
  private tauriBridgeReadyListeners = new Set<() => void>()
  private tauriSocketRetryTimer: number | null = null
  private tauriConnectionsBridgeRefCount = 0
  private tauriMemoryBridgeRefCount = 0
  private tauriLogsBridgeRefCount = 0
  private tauriControllerUrl: string | null = null
  private tauriControllerSecret: string | null = null
  private tauriControllerSecretRevision = 0
  private tauriControllerUrlPromise: Promise<string | null> | null = null
  private tauriRuntimeSecretPromise: Promise<void> | null = null
  private tauriBridgeLifecycleInstalled = false
  private tauriBridgeStartVersion = 0
  private tauriBridgeActiveControllerUrl: string | null = null
  private tauriBridgeReconnectReason = ''
  private connectionSocketRequest = 0
  private readonly MIN_TAURI_CONNECTION_INTERVAL = 500

  constructor(private options: MihomoSocketManagerOptions) {}

  private isTauriHost(): boolean {
    return __ROUTEX_HOST__ === 'tauri'
  }

  private readTauriControllerUrl(): string | null {
    return this.tauriControllerUrl
  }

  public writeTauriControllerUrl(url: string): void {
    this.tauriControllerUrl = url
  }

  public writeTauriControllerSecret(secret?: string | null): void {
    this.tauriControllerSecret = typeof secret === 'string' ? secret : null
    this.tauriControllerSecretRevision += 1
  }

  private readEffectiveTauriControllerSecret(): string {
    if (this.tauriControllerSecret !== null) {
      return this.tauriControllerSecret
    }

    const fallback = this.options.readTauriControledMihomoConfig().secret
    return typeof fallback === 'string' ? fallback : ''
  }

  private markNextTauriBridgeStart(reason: string): number {
    this.tauriBridgeReconnectReason = reason
    this.tauriBridgeStartVersion += 1
    return this.tauriBridgeStartVersion
  }

  private isStaleTauriBridgeStart(version: number): boolean {
    return version !== this.tauriBridgeStartVersion
  }

  private normalizeTauriControllerUrl(value: string): string {
    return /^https?:\/\//i.test(value) ? value : `http://${value}`
  }

  public syncTauriControllerUrlFromRuntime(config?: Partial<MihomoConfig> | null): string | null {
    if (config) {
      this.writeTauriControllerSecret(typeof config.secret === 'string' ? config.secret : '')
    }

    const controller = config?.['external-controller']
    const rawController = typeof controller === 'string' ? controller.trim() : ''

    if (!rawController) {
      return this.readTauriControllerUrl()
    }

    const nextControllerUrl = this.normalizeTauriControllerUrl(rawController)
    this.writeTauriControllerUrl(nextControllerUrl)
    return nextControllerUrl
  }

  private async readTauriConnectionIntervalMs(): Promise<number> {
    try {
      const appConfig = await invokeTyped(C.getAppConfig)
      const rawInterval = Number.parseInt(
        String(appConfig.connectionInterval ?? this.MIN_TAURI_CONNECTION_INTERVAL),
        10
      )

      if (!Number.isFinite(rawInterval)) {
        return this.MIN_TAURI_CONNECTION_INTERVAL
      }

      return Math.max(this.MIN_TAURI_CONNECTION_INTERVAL, rawInterval)
    } catch {
      return this.MIN_TAURI_CONNECTION_INTERVAL
    }
  }

  private async ensureTauriControllerUrl(): Promise<string | null> {
    const existing = this.readTauriControllerUrl()
    if (existing) {
      return existing
    }

    if (!this.tauriControllerUrlPromise) {
      this.tauriControllerUrlPromise = (async (): Promise<string | null> => {
        try {
          const controllerUrl = await invokeSafe<string | null>(C.getControllerUrl)
          if (controllerUrl) {
            this.writeTauriControllerUrl(controllerUrl)
            return controllerUrl
          }
        } catch {
          // Fallback to runtime config below.
        }

        try {
          const config = await this.options.getRuntimeConfig()
          return this.syncTauriControllerUrlFromRuntime(config)
        } catch {
          return null
        }
      })()
        .catch((): null => null)
        .finally(() => {
          this.tauriControllerUrlPromise = null
        })
    }

    return this.tauriControllerUrlPromise
  }

  private closeTauriSocket(key: TauriSocketKey): void {
    const socket = this.tauriSockets[key]
    if (!socket) return
    socket.onopen = null
    socket.onmessage = null
    socket.onerror = null
    socket.onclose = null
    socket.close()
    delete this.tauriSockets[key]
  }

  public stopTauriMihomoEventBridge(): void {
    this.connectionSocketRequest += 1
    this.closeTauriSocket('memory')
    this.closeTauriSocket('logs')
    this.closeTauriSocket('connections')
    this.tauriBridgeActiveControllerUrl = null

    if (this.tauriSocketRetryTimer !== null) {
      window.clearTimeout(this.tauriSocketRetryTimer)
      this.tauriSocketRetryTimer = null
    }
  }

  public onTauriBridgeConnectionsReady(listener: () => void): () => void {
    this.tauriBridgeReadyListeners.add(listener)
    return () => {
      this.tauriBridgeReadyListeners.delete(listener)
    }
  }

  private retainTauriBridge(opts: {
    key: TauriSocketKey
    retainReason: string
    getRefCount: () => number
    setRefCount: (value: number) => void
    startSocket: (controllerUrl: string, version: number) => void
    shouldStartSocket?: () => boolean
  }): () => void {
    if (!this.isTauriHost()) {
      return () => undefined
    }

    opts.setRefCount(opts.getRefCount() + 1)
    if (this.tauriBridgeActiveControllerUrl) {
      if (!opts.shouldStartSocket || opts.shouldStartSocket()) {
        opts.startSocket(this.tauriBridgeActiveControllerUrl, this.tauriBridgeStartVersion)
      }
    } else {
      this.startTauriMihomoEventBridge(opts.retainReason)
    }

    let released = false
    return () => {
      if (released) {
        return
      }

      released = true
      const nextRefCount = Math.max(0, opts.getRefCount() - 1)
      opts.setRefCount(nextRefCount)
      if (nextRefCount === 0) {
        this.closeTauriSocket(opts.key)
      }
    }
  }

  public retainTauriConnectionsBridge(): () => void {
    return this.retainTauriBridge({
      key: 'connections',
      retainReason: 'connections-retain',
      getRefCount: () => this.tauriConnectionsBridgeRefCount,
      setRefCount: (value) => {
        this.tauriConnectionsBridgeRefCount = value
      },
      startSocket: this.startTauriConnectionsSocket.bind(this)
    })
  }

  public retainTauriMemoryBridge(): () => void {
    return this.retainTauriBridge({
      key: 'memory',
      retainReason: 'memory-retain',
      getRefCount: () => this.tauriMemoryBridgeRefCount,
      setRefCount: (value) => {
        this.tauriMemoryBridgeRefCount = value
      },
      startSocket: this.startTauriMemorySocket.bind(this),
      shouldStartSocket: () => !this.tauriSockets.memory
    })
  }

  public retainTauriLogsBridge(): () => void {
    return this.retainTauriBridge({
      key: 'logs',
      retainReason: 'logs-retain',
      getRefCount: () => this.tauriLogsBridgeRefCount,
      setRefCount: (value) => {
        this.tauriLogsBridgeRefCount = value
      },
      startSocket: this.startTauriLogsSocket.bind(this),
      shouldStartSocket: () => !this.tauriSockets.logs
    })
  }

  public refreshTauriLogsSocket(): void {
    if (this.tauriBridgeActiveControllerUrl) {
      this.startTauriLogsSocket(this.tauriBridgeActiveControllerUrl, this.tauriBridgeStartVersion)
    }
  }

  private emitTauriBridgeConnectionsReady(): void {
    this.tauriBridgeReadyListeners.forEach((listener) => {
      try {
        listener()
      } catch {
        // ignore
      }
    })
    this.tauriBridgeReadyListeners.clear()
  }

  public installTauriBridgeLifecycle(): void {
    if (!this.isTauriHost() || this.tauriBridgeLifecycleInstalled) {
      return
    }

    this.tauriBridgeLifecycleInstalled = true

    desktop.on<[unknown]>(IPC_ON_CHANNELS.coreStarted, (_event, payload) => {
      this.options.invalidateRuntimeConfigCache()
      const record =
        payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null
      if (record && 'secret' in record && typeof record.secret === 'string') {
        this.writeTauriControllerSecret(record.secret)
      } else {
        this.writeTauriControllerSecret(null)
      }
      if (record && 'controller' in record && typeof record.controller === 'string') {
        this.writeTauriControllerUrl(`http://${record.controller}`)
        this.startTauriMihomoEventBridge('core-started-with-controller')
      } else {
        this.tauriControllerUrl = null
        this.tauriControllerUrlPromise = null
        this.startTauriMihomoEventBridge('core-started-no-controller')
      }
    })

    desktop.on(IPC_ON_CHANNELS.controledMihomoConfigUpdated, () => {
      this.options.invalidateRuntimeConfigCache()
      this.writeTauriControllerSecret(null)
      this.startTauriMihomoEventBridge()
    })

    desktop.on(IPC_ON_CHANNELS.appConfigUpdated, () => {
      if (this.tauriBridgeActiveControllerUrl) {
        this.startTauriConnectionsSocket(
          this.tauriBridgeActiveControllerUrl,
          this.tauriBridgeStartVersion
        )
      }
    })

    for (const channel of [
      IPC_ON_CHANNELS.profileConfigUpdated,
      IPC_ON_CHANNELS.overrideConfigUpdated,
      IPC_ON_CHANNELS.quickRulesConfigUpdated,
      IPC_ON_CHANNELS.rulesUpdated
    ] as const) {
      desktop.on(channel, () => {
        this.options.invalidateRuntimeConfigCache()
      })
    }
  }

  private scheduleTauriBridgeReconnect(reason = this.tauriBridgeReconnectReason || 'retry'): void {
    if (this.tauriSocketRetryTimer !== null) {
      return
    }

    this.tauriSocketRetryTimer = window.setTimeout(() => {
      this.tauriSocketRetryTimer = null
      this.startTauriMihomoEventBridge(reason)
    }, 1200)
  }

  private emitParsedDesktopEvent<T>(
    channel: (typeof IPC_ON_CHANNELS)[keyof typeof IPC_ON_CHANNELS],
    payload: string
  ): void {
    try {
      emitDesktopEvent(channel, JSON.parse(payload) as T)
    } catch {
      // ignore malformed payload
    }
  }

  private toWebSocketUrl(controllerUrl: string, path: string): string {
    const url = new URL(controllerUrl.replace(/^http/i, 'ws'))
    const [pathname, rawQuery = ''] = path.split('?')
    url.pathname = pathname
    url.search = rawQuery ? `?${rawQuery}` : ''
    const secret = this.readEffectiveTauriControllerSecret()
    if (secret) {
      url.searchParams.set('token', secret)
    }
    return url.toString()
  }

  private startTauriConnectionsSocket(controllerUrl: string, version: number): void {
    const request = ++this.connectionSocketRequest
    if (this.tauriConnectionsBridgeRefCount <= 0) {
      this.closeTauriSocket('connections')
      return
    }

    void this.readTauriConnectionIntervalMs().then((connectionInterval) => {
      if (
        this.tauriConnectionsBridgeRefCount <= 0 ||
        request !== this.connectionSocketRequest ||
        this.isStaleTauriBridgeStart(version) ||
        this.tauriBridgeActiveControllerUrl !== controllerUrl
      ) {
        return
      }

      let bridgeReadyEmitted = false
      this.startTauriSocket(
        'connections',
        this.toWebSocketUrl(controllerUrl, `/connections?interval=${connectionInterval}`),
        version,
        (payload) => {
          if (!bridgeReadyEmitted) {
            bridgeReadyEmitted = true
            this.emitTauriBridgeConnectionsReady()
          }
          this.emitParsedDesktopEvent<ControllerConnections>(
            IPC_ON_CHANNELS.mihomoConnections,
            payload
          )
        }
      )
    })
  }

  private startTauriMemorySocket(controllerUrl: string, version: number): void {
    if (this.tauriMemoryBridgeRefCount <= 0) {
      this.closeTauriSocket('memory')
      return
    }

    this.startTauriSocket(
      'memory',
      this.toWebSocketUrl(controllerUrl, '/memory'),
      version,
      (payload) => {
        if (document.hidden) return
        this.emitParsedDesktopEvent<ControllerMemory>(IPC_ON_CHANNELS.mihomoMemory, payload)
      }
    )
  }

  private startTauriLogsSocket(controllerUrl: string, version: number): void {
    if (this.tauriLogsBridgeRefCount <= 0) {
      this.closeTauriSocket('logs')
      return
    }

    const { 'log-level': logLevel = 'info' } = this.options.readTauriControledMihomoConfig()
    this.startTauriSocket(
      'logs',
      this.toWebSocketUrl(controllerUrl, `/logs?level=${logLevel}`),
      version,
      (payload) => {
        this.emitParsedDesktopEvent<ControllerLog>(IPC_ON_CHANNELS.mihomoLogs, payload)
      }
    )
  }

  private startTauriSocket(
    key: TauriSocketKey,
    url: string,
    version: number,
    onMessage: (payload: string) => void
  ): void {
    const existing = this.tauriSockets[key]
    if (existing?.url === url && (existing.readyState === 0 || existing.readyState === 1)) {
      return
    }
    this.closeTauriSocket(key)

    try {
      const socket = new WebSocket(url)
      this.tauriSockets[key] = socket
      const handleDisconnect = () => {
        if (this.tauriSockets[key] !== socket) {
          return
        }
        this.closeTauriSocket(key)
        this.scheduleTauriBridgeReconnect(`socket:${key}:disconnect`)
      }
      socket.onopen = () => {
        if (this.isStaleTauriBridgeStart(version) || this.tauriBridgeActiveControllerUrl === null) {
          this.closeTauriSocket(key)
        }
      }
      socket.onmessage = (event) => {
        if (this.tauriSockets[key] !== socket || this.isStaleTauriBridgeStart(version)) {
          return
        }
        if (typeof event.data === 'string') {
          onMessage(event.data)
        }
      }
      socket.onerror = handleDisconnect
      socket.onclose = handleDisconnect
    } catch {
      this.scheduleTauriBridgeReconnect(`socket:${key}:create_failed`)
    }
  }

  public startTauriMihomoEventBridge(reason = 'manual'): void {
    if (!this.isTauriHost()) {
      return
    }

    const controllerUrl = this.readTauriControllerUrl()
    const restart =
      this.tauriBridgeActiveControllerUrl !== controllerUrl || reason.startsWith('core-started')
    if (restart) {
      this.stopTauriMihomoEventBridge()
    }
    const version =
      restart || !controllerUrl
        ? this.markNextTauriBridgeStart(reason)
        : this.tauriBridgeStartVersion
    if (!controllerUrl) {
      this.stopTauriMihomoEventBridge()
      void this.ensureTauriControllerUrl().then((resolvedControllerUrl) => {
        if (this.isStaleTauriBridgeStart(version)) {
          return
        }

        if (resolvedControllerUrl) {
          this.startTauriMihomoEventBridge('controller-resolved')
          return
        }

        this.scheduleTauriBridgeReconnect('controller-missing')
      })
      return
    }

    this.tauriBridgeActiveControllerUrl = controllerUrl

    if (this.tauriControllerSecret === null && !this.tauriRuntimeSecretPromise) {
      const previousSecret = this.readEffectiveTauriControllerSecret()
      const secretRevision = this.tauriControllerSecretRevision
      this.tauriRuntimeSecretPromise = this.options
        .getRuntimeConfig()
        .then((config) => {
          const controlledSecret = this.options.readTauriControledMihomoConfig().secret
          const resolvedSecret =
            typeof config?.secret === 'string'
              ? config.secret
              : typeof controlledSecret === 'string'
                ? controlledSecret
                : ''
          if (secretRevision === this.tauriControllerSecretRevision) {
            this.writeTauriControllerSecret(resolvedSecret)
          }
          if (
            this.readEffectiveTauriControllerSecret() !== previousSecret &&
            this.tauriBridgeActiveControllerUrl === controllerUrl &&
            !this.isStaleTauriBridgeStart(version)
          ) {
            this.startTauriMihomoEventBridge('runtime-secret-resolved')
          }
        })
        .catch(() => undefined)
        .finally(() => {
          this.tauriRuntimeSecretPromise = null
        })
    }

    this.startTauriMemorySocket(controllerUrl, version)
    this.startTauriLogsSocket(controllerUrl, version)
    this.startTauriConnectionsSocket(controllerUrl, version)
  }
}
