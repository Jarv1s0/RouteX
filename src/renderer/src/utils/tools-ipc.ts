import { C, invokeRaw, invokeSafe } from './ipc-core'

interface IpInfoQuery {
  query: string
  lang?: string
}

export interface IpInfoResult {
  status: string
  message?: string
  query?: string
  country?: string
  countryCode?: string
  region?: string
  regionName?: string
  city?: string
  zip?: string
  lat?: number
  lon?: number
  timezone?: string
  isp?: string
  org?: string
  as?: string
}

export async function fetchIpInfo(): Promise<IpInfoResult> {
  return invokeSafe(C.fetchIpInfo)
}

export async function fetchBatchIpInfo(queries: IpInfoQuery[]): Promise<IpInfoResult[]> {
  return invokeSafe(C.fetchBatchIpInfo, queries)
}

export async function fetchIpInfoQuery(query: string): Promise<IpInfoResult> {
  return invokeSafe(C.fetchIpInfoQuery, query)
}

export async function testRuleMatch(
  domain: string
): Promise<{ rule: string; rulePayload: string; proxy: string } | null> {
  return invokeSafe(C.testRuleMatch, domain)
}

export async function testConnectivity(
  url: string,
  timeout?: number
): Promise<{ success: boolean; latency: number; status?: number; error?: string }> {
  return invokeRaw(C.testConnectivity, url, timeout)
}

export async function checkStreamingUnlock(service: string): Promise<{
  status: 'unlocked' | 'locked' | 'error'
  region?: string
  error?: string
}> {
  return invokeRaw(C.checkStreamingUnlock, service)
}

export async function httpGet(
  url: string,
  timeout?: number
): Promise<{ status: number; data: string; headers: Record<string, string>; error?: string }> {
  return invokeRaw(C.httpGet, url, timeout)
}
