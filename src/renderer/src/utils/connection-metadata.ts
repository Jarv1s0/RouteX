type ConnectionMetadata = ControllerConnectionDetail['metadata']

const CONNECTION_METADATA_COMPARE_FIELDS = [
  'process',
  'processPath',
  'host',
  'destinationIP',
  'remoteDestination',
  'sniffHost',
  'sourceIP',
  'sourcePort',
  'destinationPort',
  'type',
  'network',
  'inboundName',
  'inboundUser'
] as const satisfies readonly (keyof ConnectionMetadata)[]

export function normalizeConnectionMetadata(metadata: ConnectionMetadata): ConnectionMetadata {
  return metadata.type === 'Inner'
    ? { ...metadata, process: 'mihomo', processPath: 'mihomo' }
    : metadata
}

export function hasConnectionMetadataChanged(
  previous: ConnectionMetadata | undefined,
  next: ConnectionMetadata
): boolean {
  return (
    !previous ||
    CONNECTION_METADATA_COMPARE_FIELDS.some((field) => previous[field] !== next[field])
  )
}
