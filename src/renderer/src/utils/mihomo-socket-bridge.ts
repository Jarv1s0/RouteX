export type TauriSocketKey = 'traffic' | 'memory' | 'logs' | 'connections'

export class MihomoSocketBridge {
  private sockets: Partial<Record<TauriSocketKey, WebSocket>> = {}
  private bridgeReadyListeners = new Set<() => void>()
  private socketRetryTimer: number | null = null
  private connectionsBridgeRefCount = 0
  private memoryBridgeRefCount = 0
  private logsBridgeRefCount = 0

  private bridgeLifecycleInstalled = false
  private bridgeStartVersion = 0
  private bridgeActiveControllerUrl: string | null = null
  private bridgeReconnectReason = ''

  public isExpectedMihomoUnavailableError(error: unknown): boolean {
    const message = `${error ?? ''}`
    return (
      message.includes('connect ENOENT \\\\.\\pipe\\RouteX\\mihomo') ||
      message.includes('socket hang up') ||
      message.includes('Mihomo controller is not available') ||
      message.includes('503 Service Unavailable') ||
      message.includes('504 Gateway Timeout')
    )
  }

  public getActiveControllerUrl(): string | null {
    return this.bridgeActiveControllerUrl
  }

  public setActiveControllerUrl(url: string | null) {
    this.bridgeActiveControllerUrl = url
  }

  public markNextStart(reason: string): number {
    this.bridgeReconnectReason = reason
    this.bridgeStartVersion += 1
    return this.bridgeStartVersion
  }

  public isStaleStart(version: number): boolean {
    return version !== this.bridgeStartVersion
  }

  public closeSocket(key: TauriSocketKey): void {
    const socket = this.sockets[key]
    if (!socket) return
    socket.onopen = null
    socket.onmessage = null
    socket.onerror = null
    socket.onclose = null
    socket.close()
    delete this.sockets[key]
  }

  public stopBridge(): void {
    this.closeSocket('traffic')
    this.closeSocket('memory')
    this.closeSocket('logs')
    this.closeSocket('connections')
    this.bridgeActiveControllerUrl = null

    if (this.socketRetryTimer !== null) {
      window.clearTimeout(this.socketRetryTimer)
      this.socketRetryTimer = null
    }
  }

  public onConnectionsReady(listener: () => void): () => void {
    this.bridgeReadyListeners.add(listener)
    return () => {
      this.bridgeReadyListeners.delete(listener)
    }
  }

  public emitConnectionsReady(): void {
    this.bridgeReadyListeners.forEach((listener) => {
      try {
        listener()
      } catch {
        // ignore
      }
    })
    this.bridgeReadyListeners.clear()
  }

  public setSocket(key: TauriSocketKey, socket: WebSocket): void {
    this.sockets[key] = socket
  }

  public getSocket(key: TauriSocketKey): WebSocket | undefined {
    return this.sockets[key]
  }

  public hasSocket(key: TauriSocketKey): boolean {
    return !!this.sockets[key]
  }

  public scheduleReconnect(reason: string, reconnectFn: (reason: string) => void): void {
    if (this.socketRetryTimer !== null) {
      return
    }
    this.socketRetryTimer = window.setTimeout(() => {
      this.socketRetryTimer = null
      reconnectFn(reason)
    }, 1200)
  }

  // Ref counting
  public getRefCount(key: 'connections' | 'memory' | 'logs'): number {
    if (key === 'connections') return this.connectionsBridgeRefCount
    if (key === 'memory') return this.memoryBridgeRefCount
    return this.logsBridgeRefCount
  }

  public setRefCount(key: 'connections' | 'memory' | 'logs', value: number): void {
    if (key === 'connections') this.connectionsBridgeRefCount = value
    else if (key === 'memory') this.memoryBridgeRefCount = value
    else this.logsBridgeRefCount = value
  }

  public retainBridge(
    key: TauriSocketKey,
    startSocket: (controllerUrl: string, version: number) => void,
    startBridge: (reason: string) => void,
    shouldStartSocket = () => true
  ): () => void {
    if (key === 'traffic') return () => {}

    this.setRefCount(key, this.getRefCount(key) + 1)
    if (this.bridgeActiveControllerUrl) {
      if (shouldStartSocket()) {
        startSocket(this.bridgeActiveControllerUrl, this.bridgeStartVersion)
      }
    } else {
      startBridge(`${key}-retain`)
    }

    let released = false
    return () => {
      if (released) return
      released = true
      const nextRefCount = Math.max(0, this.getRefCount(key) - 1)
      this.setRefCount(key, nextRefCount)
      if (nextRefCount === 0) {
        this.closeSocket(key)
      }
    }
  }

  public installLifecycle(onInstall: () => void): void {
    if (this.bridgeLifecycleInstalled) return
    this.bridgeLifecycleInstalled = true
    onInstall()
  }
}

export const socketBridge = new MihomoSocketBridge()
