import React, { useCallback, useMemo } from 'react'
import QuickRuleEditorModal from '@renderer/components/rules/quick-rule-editor-modal'
import { GLOBAL_QUICK_RULES_PROFILE_ID } from '@renderer/utils/quick-rules-ipc'

interface Props {
  connection: ControllerConnectionDetail
  onClose: () => void
}

const getDefaultRuleType = (connection: ControllerConnectionDetail): string => {
  if (connection.metadata.host || connection.metadata.sniffHost) return 'DOMAIN'
  if (connection.metadata.destinationIP) {
    return connection.metadata.destinationIP.includes(':') ? 'IP-CIDR6' : 'IP-CIDR'
  }
  if (connection.metadata.process) return 'PROCESS-NAME'
  return 'DOMAIN'
}

const getConnectionRuleValue = (
  connection: ControllerConnectionDetail,
  selectedRuleType: string
): string => {
  const host = connection.metadata.host || connection.metadata.sniffHost || ''
  const destIP = connection.metadata.destinationIP || ''
  const process = connection.metadata.process || ''
  const processPath = connection.metadata.processPath || ''
  const destPort = connection.metadata.destinationPort || ''
  const srcPort = connection.metadata.sourcePort || ''
  const network = connection.metadata.network || ''

  switch (selectedRuleType) {
    case 'DOMAIN':
      return host
    case 'DOMAIN-SUFFIX': {
      if (!host) return ''
      const parts = host.split('.')
      return parts.length > 2 ? parts.slice(-2).join('.') : host
    }
    case 'DOMAIN-KEYWORD': {
      if (!host) return ''
      const parts = host.split('.')
      return parts.length > 2 ? parts[parts.length - 2] : parts[0]
    }
    case 'DOMAIN-WILDCARD':
      return host ? `*.${host.split('.').slice(-2).join('.')}` : ''
    case 'DOMAIN-REGEX':
      return host ? host.replace(/\./g, '\\.') : ''
    case 'IP-CIDR':
      return destIP && !destIP.includes(':') ? `${destIP}/32` : ''
    case 'IP-CIDR6':
      return destIP.includes(':') ? `${destIP}/128` : ''
    case 'IP-SUFFIX':
      return destIP
    case 'IP-ASN':
      return ''
    case 'GEOIP':
    case 'SRC-GEOIP':
      return 'CN'
    case 'PROCESS-NAME':
      return process
    case 'PROCESS-PATH':
      return processPath
    case 'PROCESS-NAME-REGEX':
      return process ? process.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : ''
    case 'PROCESS-PATH-REGEX':
      return processPath ? processPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : ''
    case 'DST-PORT':
      return destPort
    case 'SRC-PORT':
      return srcPort
    case 'NETWORK':
      return network
    default:
      return ''
  }
}

const CreateRuleModal: React.FC<Props> = ({ connection, onClose }) => {
  const defaultRuleType = useMemo(() => getDefaultRuleType(connection), [connection])
  const suggestRuleValue = useCallback(
    (selectedRuleType: string) => getConnectionRuleValue(connection, selectedRuleType),
    [connection]
  )
  const initialRule = useMemo(
    () => ({
      type: defaultRuleType,
      value: getConnectionRuleValue(connection, defaultRuleType),
      target: 'DIRECT',
      noResolve: false,
      source: 'connection' as const
    }),
    [connection, defaultRuleType]
  )

  return (
    <QuickRuleEditorModal
      profileId={GLOBAL_QUICK_RULES_PROFILE_ID}
      initialRule={initialRule}
      suggestRuleValue={suggestRuleValue}
      onClose={onClose}
      onSaved={() => {}}
    />
  )
}

export default CreateRuleModal
