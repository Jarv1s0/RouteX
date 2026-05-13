import * as isIp from 'is-ip'
import isCidr from 'is-cidr'
import { translate } from '@renderer/i18n'

export type ValidationResult = { ok: boolean; error?: string }

export const isIPv4 = (ip: string): ValidationResult => {
  if (!ip) return { ok: false, error: translate('validate.ipRequired') }
  try {
    return isIp.isIPv4(ip) ? { ok: true } : { ok: false, error: translate('validate.ipv4Invalid') }
  } catch {
    return { ok: false, error: translate('validate.ipParseFailed') }
  }
}

export const isIPv6 = (ip: string): ValidationResult => {
  if (!ip) return { ok: false, error: translate('validate.ipRequired') }
  try {
    return isIp.isIPv6(ip) ? { ok: true } : { ok: false, error: translate('validate.ipv6Invalid') }
  } catch {
    return { ok: false, error: translate('validate.ipParseFailed') }
  }
}

export const isValidIPv4Cidr = (s: string | undefined): ValidationResult => {
  if (!s || s.trim() === '') return { ok: true }
  const v = s.trim()
  try {
    const r = isCidr(v)
    if (r === 4) return { ok: true }
    if (r === 6) return { ok: false, error: translate('validate.cidrExpectedIpv4') }
    return { ok: false, error: translate('validate.cidrInvalidIpv4') }
  } catch {
    return { ok: false, error: translate('validate.cidrParseFailed') }
  }
}

export const isValidIPv6Cidr = (s: string | undefined): ValidationResult => {
  if (!s || s.trim() === '') return { ok: true }
  const v = s.trim()
  try {
    const r = isCidr(v)
    if (r === 6) return { ok: true }
    if (r === 4) return { ok: false, error: translate('validate.cidrExpectedIpv6') }
    return { ok: false, error: translate('validate.cidrInvalidIpv6') }
  } catch {
    return { ok: false, error: translate('validate.cidrParseFailed') }
  }
}

export const isValidPort = (s: string): ValidationResult => {
  if (!/^\d+$/.test(s)) return { ok: false, error: translate('validate.portNumber') }
  const p = Number(s)
  return p >= 1 && p <= 65535 ? { ok: true } : { ok: false, error: translate('validate.portRange') }
}

export const isValidListenAddress = (s: string | undefined): ValidationResult => {
  if (!s || s.trim() === '') return { ok: true }
  const v = s.trim()
  if (v.startsWith(':')) {
    return isValidPort(v.slice(1))
  }
  const idx = v.lastIndexOf(':')
  if (idx === -1) return { ok: false, error: translate('validate.portRequired') }
  const host = v.slice(0, idx)
  const port = v.slice(idx + 1)
  if (!isValidPort(port).ok) return { ok: false, error: translate('validate.portInvalid') }
  if (host.startsWith('[') && host.endsWith(']')) {
    const inner = host.slice(1, -1)
    return isIPv6(inner)
  }
  if (/^[0-9a-zA-Z-.]+$/.test(host)) {
    if (/^[0-9.]+$/.test(host)) {
      return isIPv4(host)
    }
    return /^[a-zA-Z0-9-.]+$/.test(host) ? { ok: true } : { ok: false, error: translate('validate.hostnameInvalidChars') }
  }
  return { ok: false, error: translate('validate.hostnameInvalidChars') }
}

export const isValidDomainWildcard = (s: string | undefined): ValidationResult => {
  if (!s || s.trim() === '') return { ok: false, error: translate('validate.required') }
  const v = s.trim()
  if (v.startsWith('rule-set:') || v.startsWith('geosite:')) {
    const rest = v.split(':')[1]
    if (!!rest && rest.length > 0) return { ok: true }
    return { ok: false, error: translate('validate.ruleSetRequired') }
  }
  if (v === '*') return { ok: true }

  if (v.startsWith('+.')) {
    const domain = v.slice(2)
    if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$/.test(domain)) return { ok: true }
    return { ok: false, error: translate('validate.plusDomainInvalid') }
  }

  if (v.startsWith('.')) {
    const domain = v.slice(1)
    if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$/.test(domain)) return { ok: true }
    return { ok: false, error: translate('validate.dotDomainInvalid') }
  }

  if (v.includes('*')) {
    const labels = v.split('.')
    if (labels.every((lab) => lab === '*' || /^[a-zA-Z0-9-]+$/.test(lab))) return { ok: true }
    return { ok: false, error: translate('validate.wildcardInvalid') }
  }

  if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$/.test(v)) return { ok: true }
  return { ok: false, error: translate('validate.domainWildcardInvalid') }
}

export const isValidPortRange = (s: string | undefined): boolean => {
  if (!s || s.trim() === '') return false
  const parts = s
    .split(/[,/]/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return false
  for (const p of parts) {
    if (p.includes('-')) {
      const [a, b] = p.split('-')
      if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) return false
      const na = Number(a)
      const nb = Number(b)
      if (na < 1 || nb > 65535 || na > nb) return false
    } else {
      if (!/^\d+$/.test(p)) return false
      const np = Number(p)
      if (np < 1 || np > 65535) return false
    }
  }
  return true
}

export const isValidDnsServer = (s: string | undefined, ipOnly = false): ValidationResult => {
  if (!s || s.trim() === '') return { ok: false, error: translate('validate.required') }
  const v = s.trim()
  const hashIndex = v.indexOf('#')
  const serverPart = hashIndex === -1 ? v : v.slice(0, hashIndex)
  const paramsPart = hashIndex === -1 ? '' : v.slice(hashIndex + 1)

  if (!serverPart) return { ok: false, error: translate('validate.serverRequired') }
  if (hashIndex !== -1) {
    if (!paramsPart || paramsPart.trim() === '') {
      return { ok: false, error: translate('validate.dnsParamsRequired') }
    }
    const boolParams = ['ecs-override', 'h3', 'skip-cert-verify', 'disable-ipv4', 'disable-ipv6']
    const allowedParams = ['ecs', ...boolParams]

    const params = paramsPart
      .split('&')
      .map((p) => p.trim())
      .filter(Boolean)
    for (const param of params) {
      if (param.includes('=')) {
        const [key, value] = param.split('=')
        if (!key || !value) {
          return { ok: false, error: translate('validate.dnsParamKeyValueRequired') }
        }
        if (!/^[a-zA-Z0-9-_]+$/.test(key)) {
          return { ok: false, error: translate('validate.dnsParamNameInvalid', { key }) }
        }
        if (!allowedParams.includes(key)) {
          return {
            ok: false,
            error: translate('validate.dnsParamUnsupported', { key, allowed: allowedParams.join(', ') })
          }
        }
        if (boolParams.includes(key) && value !== 'true' && value !== 'false') {
          return { ok: false, error: translate('validate.dnsParamBool', { key }) }
        }
        if (key === 'ecs' && !/^[a-zA-Z0-9-_./:]+$/.test(value)) {
          return { ok: false, error: translate('validate.dnsParamValueInvalid', { value }) }
        }
      } else {
        if (!param || param.trim() === '') {
          return { ok: false, error: translate('validate.dnsParamRequired') }
        }
        if (!/^[a-zA-Z0-9\u4e00-\u9fa5\s-_]+$/.test(param)) {
          return {
            ok: false,
            error: translate('validate.dnsParamInvalidWithDnsOverrideHint', { param })
          }
        }
      }
    }
  }

  const lower = serverPart.toLowerCase()

  if (lower === 'system' || lower === 'system://') return { ok: true }

  if (lower.startsWith('dhcp://')) {
    const rest = serverPart.slice('dhcp://'.length)
    if (!rest) return { ok: false, error: translate('validate.dhcpTargetRequired') }
    if (rest.toLowerCase() === 'system') return { ok: true }
    if (/^[a-zA-Z0-9_.-]+$/.test(rest)) return { ok: true }
    return { ok: false, error: translate('validate.dhcpInterfaceInvalid') }
  }

  if (lower.startsWith('rcode://')) {
    const code = lower.slice('rcode://'.length)
    const allowed = new Set([
      'success',
      'format_error',
      'server_failure',
      'name_error',
      'not_implemented',
      'refused'
    ])
    return allowed.has(code) ? { ok: true } : { ok: false, error: translate('validate.rcodeInvalid') }
  }

  if (/^https?:\/\//i.test(serverPart)) {
    try {
      const u = new URL(serverPart)
      if (!u.hostname) return { ok: false, error: translate('validate.urlHostnameInvalid') }
      if (ipOnly) {
        const hostname = u.hostname
        if (/^[0-9.]+$/.test(hostname)) {
          const r = isIPv4(hostname)
          if (!r.ok) return { ok: false, error: translate('validate.ipv4Invalid') }
          return { ok: true }
        }
        if (hostname.includes(':')) {
          const r = isIPv6(hostname)
          if (!r.ok) return { ok: false, error: translate('validate.ipv6Invalid') }
          return { ok: true }
        }
        return { ok: false, error: translate('validate.hostMustBeIp') }
      }
      return { ok: true }
    } catch {
      return { ok: false, error: translate('validate.urlInvalid') }
    }
  }

  const schemeMatch = serverPart.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.+)$/)
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase()
    const rest = schemeMatch[2]
    if (!['udp', 'tcp', 'tls', 'quic'].includes(scheme)) {
      return { ok: false, error: translate('validate.unsupportedScheme', { scheme }) }
    }
    const hostPort = rest.split('/')[0]
    const hpIdx = hostPort.lastIndexOf(':')
    let host = hostPort
    let portStr: string | undefined
    if (
      hpIdx !== -1 &&
      !(hostPort.startsWith('[') && hostPort.includes(']') && hpIdx > hostPort.indexOf(']'))
    ) {
      host = hostPort.slice(0, hpIdx)
      portStr = hostPort.slice(hpIdx + 1)
    }
    if (!host) return { ok: false, error: translate('validate.schemeHostRequired', { scheme }) }
    if (/^[0-9.]+$/.test(host)) {
      const r = isIPv4(host)
      if (!r.ok) return { ok: false, error: translate('validate.ipv4Invalid') }
    } else if (host.startsWith('[') && host.endsWith(']')) {
      const inner = host.slice(1, -1)
      const r = isIPv6(inner)
      if (!r.ok) return { ok: false, error: translate('validate.ipv6Invalid') }
    } else {
      if (ipOnly) {
        return { ok: false, error: translate('validate.hostMustBeIp') }
      }
      if (!/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$/.test(host)) {
        return { ok: false, error: translate('validate.hostnameInvalid') }
      }
    }
    if (portStr) {
      if (!/^[0-9]+$/.test(portStr)) return { ok: false, error: translate('validate.portFormat') }
      const p = Number(portStr)
      if (p < 1 || p > 65535) return { ok: false, error: translate('validate.portOutOfRange') }
    }
    return { ok: true }
  }

  const idx = serverPart.lastIndexOf(':')
  if (idx !== -1 && serverPart.includes(']') === false) {
    const host = serverPart.slice(0, idx)
    const port = serverPart.slice(idx + 1)
    if (!/^[0-9]+$/.test(port)) return { ok: false, error: translate('validate.portFormat') }
    if (!host) return { ok: false, error: translate('validate.hostRequired') }
    if (/^[0-9.]+$/.test(host)) {
      const r = isIPv4(host)
      return r.ok ? { ok: true } : { ok: false, error: translate('validate.ipv4Invalid') }
    }
    if (host.startsWith('[') && host.endsWith(']')) {
      const inner = host.slice(1, -1)
      const r = isIPv6(inner)
      return r.ok ? { ok: true } : { ok: false, error: translate('validate.ipv6Invalid') }
    }
    if (ipOnly) {
      return { ok: false, error: translate('validate.hostMustBeIp') }
    }
    return /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$/.test(host)
      ? { ok: true }
      : { ok: false, error: translate('validate.hostnameInvalid') }
  }

  if (serverPart.startsWith('[') && serverPart.endsWith(']')) {
    const inner = serverPart.slice(1, -1)
    const r = isIPv6(inner)
    return r.ok ? { ok: true } : { ok: false, error: translate('validate.ipv6Invalid') }
  }
  if (/^[0-9.]+$/.test(serverPart)) {
    const r = isIPv4(serverPart)
    return r.ok ? { ok: true } : { ok: false, error: translate('validate.ipv4Invalid') }
  }
  if (ipOnly) {
    return { ok: false, error: translate('validate.hostMustBeIp') }
  }
  if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$/.test(serverPart)) return { ok: true }
  return { ok: false, error: translate('validate.dnsServerInvalid') }
}
