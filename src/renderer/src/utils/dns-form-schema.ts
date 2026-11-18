import { z } from 'zod'
import {
  isValidDnsServer,
  isValidDomainWildcard,
  isValidIPv4Cidr,
  isValidIPv6Cidr,
  isValidListenAddress,
  type ValidationResult
} from './validate'

export const dnsFormSchema = z
  .object({
    listen: z.string(),
    ipv6: z.boolean(),
    ipv6Timeout: z.string(),
    preferH3: z.boolean(),
    useHosts: z.boolean(),
    enhancedMode: z.enum(['normal', 'fake-ip', 'redir-host']),
    fakeIPRange: z.string(),
    fakeIPRange6: z.string(),
    fakeIPFilter: z.array(z.string()),
    fakeIPFilterMode: z.enum(['blacklist', 'whitelist', 'rule']),
    useSystemHosts: z.boolean(),
    respectRules: z.boolean(),
    defaultNameserver: z.array(z.string()),
    nameserver: z.array(z.string()),
    fallback: z.array(z.string()),
    fallbackFilter: z.record(z.string(), z.union([z.boolean(), z.string(), z.array(z.string())])),
    proxyServerNameserver: z.array(z.string()),
    directNameserver: z.array(z.string()),
    directNameserverFollowPolicy: z.boolean(),
    nameserverPolicy: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
    cacheAlgorithm: z.string(),
    hosts: z
      .array(z.object({ domain: z.string(), value: z.union([z.string(), z.array(z.string())]) }))
      .optional(),
    controlDns: z.boolean()
  })
  .superRefine((values, context) => {
    if (!values.controlDns) return
    const check = (path: (string | number)[], result: ValidationResult): void => {
      if (!result.ok)
        context.addIssue({ code: 'custom', path, message: result.error || '格式错误' })
    }
    if (values.listen.trim()) check(['listen'], isValidListenAddress(values.listen))
    if (values.ipv6Timeout.trim()) {
      check(['ipv6Timeout'], {
        ok:
          /^[1-9]\d*$/.test(values.ipv6Timeout.trim()) &&
          Number.isSafeInteger(Number(values.ipv6Timeout))
      })
    }
    if (values.enhancedMode === 'fake-ip') {
      check(['fakeIPRange'], isValidIPv4Cidr(values.fakeIPRange))
      if (values.ipv6) check(['fakeIPRange6'], isValidIPv6Cidr(values.fakeIPRange6))
      values.fakeIPFilter.forEach((item, index) =>
        check(['fakeIPFilter', index], isValidDomainWildcard(item))
      )
    }
    for (const key of [
      'defaultNameserver',
      'nameserver',
      'fallback',
      'proxyServerNameserver',
      'directNameserver'
    ] as const) {
      values[key].forEach((item, index) =>
        check([key, index], isValidDnsServer(item, key === 'defaultNameserver'))
      )
    }
    for (const [domain, servers] of Object.entries(values.nameserverPolicy)) {
      check(['nameserverPolicy', domain], isValidDomainWildcard(domain))
      const list = Array.isArray(servers)
        ? servers
        : servers
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
      check(['nameserverPolicy', domain], { ok: list.length > 0 })
      list.forEach((server) => check(['nameserverPolicy', domain], isValidDnsServer(server)))
    }
    for (const key of ['ipcidr', 'domain', 'geosite'] as const) {
      const entries = values.fallbackFilter[key]
      if (entries === undefined) continue
      if (!Array.isArray(entries)) {
        check(['fallbackFilter', key], { ok: false })
        continue
      }
      entries.forEach((entry, index) =>
        check(
          ['fallbackFilter', key, index],
          key === 'ipcidr'
            ? {
                ok:
                  Boolean(entry.trim()) && (isValidIPv4Cidr(entry).ok || isValidIPv6Cidr(entry).ok)
              }
            : key === 'domain'
              ? isValidDomainWildcard(entry)
              : { ok: Boolean(entry.trim()) }
        )
      )
    }
    if (values.useHosts)
      values.hosts?.forEach((host, index) =>
        check(['hosts', index, 'domain'], isValidDomainWildcard(host.domain))
      )
  })
