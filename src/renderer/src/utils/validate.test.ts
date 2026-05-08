import { describe, expect, it } from 'vitest'
import {
  isValidDnsServer,
  isValidDomainWildcard,
  isValidListenAddress,
  isValidPort,
  isValidPortRange
} from './validate'

describe('isValidPort', () => {
  it('accepts valid TCP/UDP ports', () => {
    expect(isValidPort('1').ok).toBe(true)
    expect(isValidPort('65535').ok).toBe(true)
  })

  it('rejects malformed and out-of-range ports', () => {
    expect(isValidPort('0').ok).toBe(false)
    expect(isValidPort('65536').ok).toBe(false)
    expect(isValidPort('abc').ok).toBe(false)
  })
})

describe('isValidListenAddress', () => {
  it('accepts host:port and bare :port listen addresses', () => {
    expect(isValidListenAddress(':7890').ok).toBe(true)
    expect(isValidListenAddress('127.0.0.1:7890').ok).toBe(true)
    expect(isValidListenAddress('[::1]:7890').ok).toBe(true)
  })

  it('rejects listen addresses without valid ports', () => {
    expect(isValidListenAddress('127.0.0.1').ok).toBe(false)
    expect(isValidListenAddress('127.0.0.1:abc').ok).toBe(false)
  })
})

describe('isValidDomainWildcard', () => {
  it('accepts mihomo domain wildcard forms', () => {
    expect(isValidDomainWildcard('+.example.com').ok).toBe(true)
    expect(isValidDomainWildcard('*.example.com').ok).toBe(true)
    expect(isValidDomainWildcard('geosite:cn').ok).toBe(true)
  })

  it('rejects empty and malformed wildcard expressions', () => {
    expect(isValidDomainWildcard('').ok).toBe(false)
    expect(isValidDomainWildcard('*.bad_domain').ok).toBe(false)
    expect(isValidDomainWildcard('geosite:').ok).toBe(false)
  })
})

describe('isValidPortRange', () => {
  it('accepts comma-separated ports and ranges', () => {
    expect(isValidPortRange('80,443,1000-2000')).toBe(true)
  })

  it('rejects empty, reversed, and out-of-range values', () => {
    expect(isValidPortRange('')).toBe(false)
    expect(isValidPortRange('2000-1000')).toBe(false)
    expect(isValidPortRange('65536')).toBe(false)
  })
})

describe('isValidDnsServer', () => {
  it('accepts supported DNS server forms', () => {
    expect(isValidDnsServer('system').ok).toBe(true)
    expect(isValidDnsServer('https://dns.example.com/dns-query').ok).toBe(true)
    expect(isValidDnsServer('tls://1.1.1.1:853').ok).toBe(true)
  })

  it('rejects domains when ipOnly is enabled', () => {
    expect(isValidDnsServer('https://dns.example.com/dns-query', true).ok).toBe(false)
    expect(isValidDnsServer('1.1.1.1', true).ok).toBe(true)
  })
})
