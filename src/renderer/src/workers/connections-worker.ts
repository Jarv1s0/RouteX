/// <reference lib="webworker" />

export interface ExtendedConnection extends ControllerConnectionDetail {
  isActive: boolean
  downloadSpeed: number
  uploadSpeed: number
  completedAt?: string
}

type ConnectionSpeedSample = {
  upload: number
  download: number
  at: number
}

let speedSamples = new Map<string, ConnectionSpeedSample>()
let prevActiveMap = new Map<string, ExtendedConnection>()
let prevClosed: ExtendedConnection[] = []

function releaseWorkerState(clearClosed: boolean): void {
  speedSamples = new Map()
  prevActiveMap = new Map()
  if (clearClosed) {
    prevClosed = []
  }
}

function updateSpeedSamples(
  connections: ControllerConnectionDetail[],
  activeIds: Set<string>,
  now: number
) {
  connections.forEach((connection) => {
    speedSamples.set(connection.id, {
      upload: Math.max(0, connection.upload || 0),
      download: Math.max(0, connection.download || 0),
      at: now
    })
  })

  speedSamples.forEach((_sample, id) => {
    if (!activeIds.has(id)) {
      speedSamples.delete(id)
    }
  })
}

self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data

  if (type === 'process') {
    const { connections, isPaused, isHidden, isBaseline, now } = payload as {
      connections: ControllerConnectionDetail[]
      isPaused: boolean
      isHidden: boolean
      isBaseline: boolean
      now: number
    }

    if (!connections) return

    const activeIds = new Set<string>()
    for (let i = 0; i < connections.length; i++) {
      activeIds.add(connections[i].id)
    }

    if (isPaused || isHidden) {
      updateSpeedSamples(connections, activeIds, now)
      return
    }

    const newActive: ExtendedConnection[] = connections.map((conn) => {
      const prev = prevActiveMap.get(conn.id)
      const previousSample = speedSamples.get(conn.id)
      const elapsedMs = previousSample ? Math.max(1, now - previousSample.at) : 0

      const downloadSpeed =
        previousSample && !isBaseline
          ? Math.round((Math.max(0, conn.download - previousSample.download) * 1000) / elapsedMs)
          : prev?.downloadSpeed || 0

      const uploadSpeed =
        previousSample && !isBaseline
          ? Math.round((Math.max(0, conn.upload - previousSample.upload) * 1000) / elapsedMs)
          : prev?.uploadSpeed || 0

      // Enhance metadata
      const metadata =
        conn.metadata.type === 'Inner'
          ? { ...conn.metadata, process: 'mihomo', processPath: 'mihomo' }
          : conn.metadata

      const prevMetadata = prev?.metadata
      const metadataChanged =
        !prevMetadata ||
        prevMetadata.process !== metadata.process ||
        prevMetadata.processPath !== metadata.processPath ||
        prevMetadata.host !== metadata.host ||
        prevMetadata.destinationIP !== metadata.destinationIP ||
        prevMetadata.remoteDestination !== metadata.remoteDestination ||
        prevMetadata.sniffHost !== metadata.sniffHost ||
        prevMetadata.sourceIP !== metadata.sourceIP ||
        prevMetadata.sourcePort !== metadata.sourcePort ||
        prevMetadata.destinationPort !== metadata.destinationPort ||
        prevMetadata.type !== metadata.type ||
        prevMetadata.network !== metadata.network ||
        prevMetadata.inboundName !== metadata.inboundName ||
        prevMetadata.inboundUser !== metadata.inboundUser

      if (
        prev &&
        !metadataChanged &&
        prev.upload === conn.upload &&
        prev.download === conn.download &&
        prev.chains?.[0] === conn.chains?.[0] &&
        prev.rule === conn.rule &&
        prev.start === conn.start
      ) {
        if (
          downloadSpeed === 0 &&
          uploadSpeed === 0 &&
          prev.downloadSpeed === 0 &&
          prev.uploadSpeed === 0
        ) {
          return prev
        }
      }

      return {
        ...conn,
        metadata,
        isActive: true,
        downloadSpeed: Math.max(0, downloadSpeed),
        uploadSpeed: Math.max(0, uploadSpeed)
      }
    })

    updateSpeedSamples(connections, activeIds, now)

    const prevActiveList = Array.from(prevActiveMap.values())

    const newlyClosed = prevActiveList
      .filter((c) => !activeIds.has(c.id))
      .map((c) => ({
        ...c,
        isActive: false,
        downloadSpeed: 0,
        uploadSpeed: 0,
        completedAt: new Date(now).toISOString()
      }))

    let nextClosed = prevClosed
    if (newlyClosed.length > 0) {
      nextClosed = [...newlyClosed, ...prevClosed]
      if (nextClosed.length > 500) {
        nextClosed = nextClosed.slice(0, 500)
      }
    }

    prevActiveMap = new Map(newActive.map((c) => [c.id, c]))
    prevClosed = nextClosed

    self.postMessage({
      type: 'process_result',
      payload: {
        activeConnections: newActive,
        closedConnections: nextClosed,
        connectionCount: newActive.length
      }
    })
  } else if (type === 'trashClosedConnection') {
    const { id } = payload
    prevClosed = prevClosed.filter((c) => c.id !== id)
    self.postMessage({ type: 'closed_update', payload: { closedConnections: prevClosed } })
  } else if (type === 'trashAllClosedConnections') {
    prevClosed = []
    self.postMessage({ type: 'closed_update', payload: { closedConnections: prevClosed } })
  } else if (type === 'release') {
    releaseWorkerState(payload?.clearClosed !== false)
  }
}
