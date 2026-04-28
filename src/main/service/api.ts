import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import crypto from 'crypto'
import { KeyManager } from './key'
import { serviceIpcPath } from '../utils/dirs'

const AUTH_SCHEME = 'ROUTEX-AUTH-V2'

let serviceAxios: AxiosInstance | null = null
let keyManager: KeyManager | null = null

export class ServiceAPIError extends Error {
  status?: number
  responseData?: unknown

  constructor(message: string, options?: { status?: number; responseData?: unknown }) {
    super(message)
    this.name = 'ServiceAPIError'
    this.status = options?.status
    this.responseData = options?.responseData
  }
}

function getHeaderValue(config: AxiosRequestConfig, name: string): string {
  const headers = config.headers as
    | Record<string, unknown>
    | { get?: (headerName: string) => string | undefined | null }
    | undefined

  if (!headers) {
    return ''
  }

  if ('get' in headers && typeof headers.get === 'function') {
    return String(headers.get(name) || headers.get(name.toLowerCase()) || '')
  }

  return String(headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || '')
}

function shouldUseJsonEncoding(config: AxiosRequestConfig): boolean {
  const contentType = getHeaderValue(config, 'Content-Type').toLowerCase()
  return contentType === '' || contentType.includes('application/json')
}

function getRequestBodyBytes(config: AxiosRequestConfig): Buffer {
  const data = config.data

  if (data == null) {
    return Buffer.alloc(0)
  }

  if (Buffer.isBuffer(data)) {
    return data
  }

  if (data instanceof Uint8Array) {
    return Buffer.from(data)
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data)
  }

  if (typeof data === 'string') {
    return Buffer.from(shouldUseJsonEncoding(config) ? JSON.stringify(data) : data)
  }

  if (data instanceof URLSearchParams) {
    return Buffer.from(data.toString())
  }

  if (typeof data === 'object') {
    return Buffer.from(JSON.stringify(data))
  }

  return Buffer.from(String(data))
}

function canonicalizeQuery(urlObj: URL): string {
  const source = new URLSearchParams(urlObj.search)
  const keys = Array.from(new Set(source.keys())).sort()
  const target = new URLSearchParams()

  for (const key of keys) {
    const values = source.getAll(key).sort()
    for (const value of values) {
      target.append(key, value)
    }
  }

  return target.toString()
}

function resolveRequestUrl(instance: AxiosInstance, config: AxiosRequestConfig): URL {
  return new URL(instance.getUri(config))
}

function buildCanonicalRequest(
  method: string,
  path: string,
  query: string,
  timestamp: string,
  nonce: string,
  keyId: string,
  bodyHash: string
): string {
  return [AUTH_SCHEME, timestamp, nonce, keyId, method.toUpperCase(), path, query, bodyHash].join(
    '\n'
  )
}

function buildServiceAuthHeaders(
  method: string,
  pathWithQuery: string,
  body: Buffer = Buffer.alloc(0)
): Record<string, string> {
  if (!keyManager?.isInitialized()) {
    throw new Error('服务 API 未初始化')
  }

  const bodyHash = crypto.createHash('sha256').update(body).digest('hex')
  const timestamp = Date.now().toString()
  const nonce = crypto.randomBytes(16).toString('base64url')
  const keyId = keyManager.getKeyID()
  const urlObj = new URL(pathWithQuery, 'http://localhost')
  const canonical = buildCanonicalRequest(
    method,
    urlObj.pathname || '/',
    canonicalizeQuery(urlObj),
    timestamp,
    nonce,
    keyId,
    bodyHash
  )
  const signature = keyManager.signData(canonical)

  return {
    'X-Auth-Version': '2',
    'X-Key-Id': keyId,
    'X-Nonce': nonce,
    'X-Content-SHA256': bodyHash,
    'X-Timestamp': timestamp,
    'X-Signature': signature
  }
}

function signServiceRequest(
  instance: AxiosInstance,
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig {
  if (!keyManager?.isInitialized()) return config

  const resolvedUrl = resolveRequestUrl(instance, config)
  const pathWithQuery = `${resolvedUrl.pathname || '/'}${resolvedUrl.search}`
  Object.assign(
    config.headers,
    buildServiceAuthHeaders(config.method || 'GET', pathWithQuery, getRequestBodyBytes(config))
  )
  return config
}

function normalizeServiceError(error: unknown): Promise<never> {
  if (axios.isAxiosError(error)) {
    if (error.response?.data) {
      const data = error.response.data as { message?: unknown; error?: unknown }
      const message = data.message || data.error || error.message || '请求失败'
      return Promise.reject(
        new ServiceAPIError(String(message), {
          status: error.response.status,
          responseData: error.response.data
        })
      )
    }
    return Promise.reject(new ServiceAPIError(error.message))
  }

  if (error instanceof Error) {
    return Promise.reject(new ServiceAPIError(error.message))
  }

  return Promise.reject(error)
}

function createServiceAxios(baseURL = 'http://localhost'): AxiosInstance {
  const instance = axios.create({
    baseURL,
    socketPath: serviceIpcPath(),
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json'
    }
  })

  instance.interceptors.request.use((config) => signServiceRequest(instance, config))
  instance.interceptors.response.use((response) => response.data, normalizeServiceError)
  return instance
}

export const initServiceAPI = (km: KeyManager): void => {
  keyManager = km
  serviceAxios = createServiceAxios()
}

export const createSignedServiceAxios = (baseURL = 'http://localhost'): AxiosInstance => {
  return createServiceAxios(baseURL)
}

export const getServiceAuthHeaders = (
  method: string,
  pathWithQuery: string,
  body: Buffer = Buffer.alloc(0)
): Record<string, string> => {
  return buildServiceAuthHeaders(method, pathWithQuery, body)
}

export const getServiceAxios = (): AxiosInstance => {
  if (!serviceAxios) {
    throw new Error('服务 API 未初始化')
  }
  return serviceAxios
}

export const getKeyManager = (): KeyManager => {
  if (!keyManager) {
    throw new Error('密钥管理器未初始化')
  }
  return keyManager
}

export const ping = async (): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.get('/ping')
}

export const test = async (): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.get('/test')
}

export const getCoreStatus = async (): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.get('/core')
}

export interface ServiceCoreLaunchProfile {
  core_path?: string
  args?: string[]
  safe_paths?: string[]
  env?: Record<string, string | undefined>
  mihomo_cpu_priority?: Priority
  log_path?: string
  save_logs?: boolean
  max_log_file_size_mb?: number
}

export const startCore = async (
  profile?: ServiceCoreLaunchProfile
): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.post('/core/start', profile)
}

export const stopCore = async (): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.post('/core/stop')
}

export const restartCore = async (
  profile?: ServiceCoreLaunchProfile
): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.post('/core/restart', profile)
}

export const patchCoreProfile = async (
  profile: Partial<ServiceCoreLaunchProfile>
): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.patch('/core/profile', profile)
}

export const getProxyStatus = async (): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.get('/sysproxy/status')
}

export const stopServiceApi = async (): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.post('/service/stop')
}

export const restartServiceApi = async (): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.post('/service/restart')
}

export const setPac = async (
  url: string,
  device?: string,
  onlyActiveDevice?: boolean,
  useRegistry?: boolean,
  guard?: boolean
): Promise<void> => {
  const instance = getServiceAxios()
  return await instance.post('/sysproxy/pac', {
    url,
    device,
    only_active_device: onlyActiveDevice,
    use_registry: useRegistry,
    guard
  })
}

export const setProxy = async (
  server: string,
  bypass?: string,
  device?: string,
  onlyActiveDevice?: boolean,
  useRegistry?: boolean,
  guard?: boolean
): Promise<void> => {
  const instance = getServiceAxios()
  return await instance.post('/sysproxy/proxy', {
    server,
    bypass,
    device,
    only_active_device: onlyActiveDevice,
    use_registry: useRegistry,
    guard
  })
}

export const disableProxy = async (
  device?: string,
  onlyActiveDevice?: boolean,
  useRegistry?: boolean
): Promise<void> => {
  const instance = getServiceAxios()
  return await instance.post('/sysproxy/disable', {
    device,
    only_active_device: onlyActiveDevice,
    use_registry: useRegistry
  })
}

export const setSysDns = async (device?: string, servers?: string[]): Promise<void> => {
  const instance = getServiceAxios()
  return await instance.post('/sys/dns/set', { servers, device })
}
