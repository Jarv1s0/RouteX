export const RULE_TYPES = [
  { key: 'DOMAIN', label: 'DOMAIN', descKey: 'rules.desc.domain', category: 'domain' },
  {
    key: 'DOMAIN-SUFFIX',
    label: 'DOMAIN-SUFFIX',
    descKey: 'rules.desc.domainSuffix',
    category: 'domain'
  },
  {
    key: 'DOMAIN-KEYWORD',
    label: 'DOMAIN-KEYWORD',
    descKey: 'rules.desc.domainKeyword',
    category: 'domain'
  },
  {
    key: 'DOMAIN-WILDCARD',
    label: 'DOMAIN-WILDCARD',
    descKey: 'rules.desc.domainWildcard',
    category: 'domain'
  },
  {
    key: 'DOMAIN-REGEX',
    label: 'DOMAIN-REGEX',
    descKey: 'rules.desc.domainRegex',
    category: 'domain'
  },
  { key: 'IP-CIDR', label: 'IP-CIDR', descKey: 'rules.desc.ipCidr4', category: 'ip' },
  { key: 'IP-CIDR6', label: 'IP-CIDR6', descKey: 'rules.desc.ipCidr6', category: 'ip' },
  { key: 'IP-SUFFIX', label: 'IP-SUFFIX', descKey: 'rules.desc.ipSuffix', category: 'ip' },
  { key: 'IP-ASN', label: 'IP-ASN', descKey: 'rules.desc.ipAsn', category: 'ip' },
  { key: 'GEOIP', label: 'GEOIP', descKey: 'rules.desc.geoip', category: 'ip' },
  { key: 'SRC-GEOIP', label: 'SRC-GEOIP', descKey: 'rules.desc.srcGeoip', category: 'ip' },
  {
    key: 'PROCESS-NAME',
    label: 'PROCESS-NAME',
    descKey: 'rules.desc.processName',
    category: 'process'
  },
  {
    key: 'PROCESS-PATH',
    label: 'PROCESS-PATH',
    descKey: 'rules.desc.processPath',
    category: 'process'
  },
  {
    key: 'PROCESS-NAME-REGEX',
    label: 'PROCESS-NAME-REGEX',
    descKey: 'rules.desc.processNameRegex',
    category: 'process'
  },
  {
    key: 'PROCESS-PATH-REGEX',
    label: 'PROCESS-PATH-REGEX',
    descKey: 'rules.desc.processPathRegex',
    category: 'process'
  },
  { key: 'DST-PORT', label: 'DST-PORT', descKey: 'rules.desc.dstPort', category: 'port' },
  { key: 'SRC-PORT', label: 'SRC-PORT', descKey: 'rules.desc.srcPort', category: 'port' },
  { key: 'NETWORK', label: 'NETWORK', descKey: 'rules.desc.network', category: 'port' },
  {
    key: 'REMATCH-NAME',
    label: 'REMATCH-NAME',
    descKey: 'rules.desc.rematchName',
    category: 'proxy'
  },
  { key: 'GEOSITE', label: 'GEOSITE', descKey: 'rules.desc.geosite', category: 'geo' }
] as const

const NO_RESOLVE_RULE_TYPES = new Set([
  'IP-CIDR',
  'IP-CIDR6',
  'IP-SUFFIX',
  'IP-ASN',
  'GEOIP',
  'SRC-GEOIP'
])

export function supportsNoResolveForRuleType(ruleType: string): boolean {
  return NO_RESOLVE_RULE_TYPES.has(ruleType)
}

export function getSuggestedRuleValue(ruleType: string): string {
  switch (ruleType) {
    case 'GEOIP':
    case 'SRC-GEOIP':
      return 'CN'
    case 'NETWORK':
      return 'tcp'
    default:
      return ''
  }
}
