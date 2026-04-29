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

let fetchIpInfoPromise: Promise<IpInfoResult> | null = null
let lastFetchIpInfoAt = 0
let lastFetchIpInfoResult: IpInfoResult | null = null

const FETCH_IP_INFO_CACHE_MS = 15 * 1000

export async function fetchIpInfo(): Promise<IpInfoResult> {
  const now = Date.now()
  if (lastFetchIpInfoResult && now - lastFetchIpInfoAt < FETCH_IP_INFO_CACHE_MS) {
    return lastFetchIpInfoResult
  }

  if (fetchIpInfoPromise) {
    return fetchIpInfoPromise
  }

  fetchIpInfoPromise = invokeSafe<IpInfoResult>(C.fetchIpInfo)
    .then((result) => {
      lastFetchIpInfoAt = Date.now()
      lastFetchIpInfoResult = result
      return result
    })
    .finally(() => {
      fetchIpInfoPromise = null
    })

  return fetchIpInfoPromise
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
