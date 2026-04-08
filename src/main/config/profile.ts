import { getControledMihomoConfig } from './controledMihomo'
import {
  mihomoCorePath,
  mihomoProfileWorkDir,
  mihomoWorkDir,
  profileConfigPath,
  profilePath
} from '../utils/dirs'
import { addProfileUpdater, delProfileUpdater } from '../core/profileUpdater'
import { readFile, writeFile, rm, mkdir } from 'fs/promises'
import { restartCore } from '../core/manager'
import { getAppConfig } from './app'
import { existsSync } from 'fs'
import axios, { AxiosResponse } from 'axios'
import https from 'https'
import http from 'http'
import tls from 'tls'
import crypto from 'crypto'
import { URL } from 'url'
import { parseYaml, stringifyYaml } from '../utils/yaml'
import { defaultProfile } from '../utils/template'
import { subStorePort } from '../resolve/server'
import { dirname, join } from 'path'
import { deepMerge } from '../utils/merge'
import { getUserAgent } from '../utils/userAgent'
import iconv from 'iconv-lite'

let profileConfig: ProfileConfig // profile.yaml

export function getCertFingerprint(cert: tls.PeerCertificate) {
  return crypto.createHash('sha256').update(cert.raw).digest('hex').toUpperCase()
}

function dedupeProfileIds(ids: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0))
  )
}

function pickFirstValidProfileId(ids: Array<string | undefined>, validIds: Set<string>): string | undefined {
  return ids.find((id): id is string => Boolean(id && validIds.has(id)))
}

function hasSameProfileSelection(left: ProfileConfig, right: ProfileConfig): boolean {
  const leftActives = getActiveProfileIdsFromConfig(left)
  const rightActives = getActiveProfileIdsFromConfig(right)
  return (
    left.current === right.current &&
    leftActives.length === rightActives.length &&
    leftActives.every((id, index) => id === rightActives[index])
  )
}

export function normalizeProfileConfig(config?: ProfileConfig): ProfileConfig {
  const items = Array.isArray(config?.items) ? config.items : []
  const validIds = new Set(items.map((item) => item.id))
  let current = pickFirstValidProfileId([config?.current], validIds)
  const seedActives = Array.isArray(config?.actives) ? config.actives : current ? [current] : []
  let actives = dedupeProfileIds(seedActives).filter((id) => validIds.has(id))

  if (current && !actives.includes(current)) {
    actives.unshift(current)
  }
  if (!current && actives.length > 0) {
    current = actives[0]
  }

  return {
    ...config,
    current,
    actives,
    items
  }
}

export function getActiveProfileIdsFromConfig(config?: ProfileConfig): string[] {
  return normalizeProfileConfig(config).actives || []
}

export async function getProfileConfig(force = false): Promise<ProfileConfig> {
  if (force || !profileConfig) {
    const data = await readFile(profileConfigPath(), 'utf-8')
    profileConfig = normalizeProfileConfig(parseYaml(data) || { items: [] })
  }
  if (typeof profileConfig !== 'object') profileConfig = normalizeProfileConfig({ items: [] })
  return profileConfig
}

export async function setProfileConfig(config: ProfileConfig): Promise<void> {
  profileConfig = normalizeProfileConfig(config)
  await writeFile(profileConfigPath(), stringifyYaml(profileConfig), 'utf-8')
}

export async function getProfileItem(id: string | undefined): Promise<ProfileItem | undefined> {
  const { items } = await getProfileConfig()
  if (!id || id === 'default') return { id: 'default', type: 'local', name: '空白订阅' }
  return items.find((item) => item.id === id)
}

export async function changeCurrentProfile(id: string): Promise<void> {
  const config = await getProfileConfig()
  const actives = getActiveProfileIdsFromConfig(config)
  const nextActives = actives.includes(id) ? actives : [id, ...actives]
  await setActiveProfiles(nextActives, id)
}

export async function setActiveProfiles(ids: string[], nextCurrent?: string): Promise<void> {
  const config = await getProfileConfig()
  const previousConfig = structuredClone(config)
  const validIds = new Set(config.items.map((item) => item.id))
  let actives = dedupeProfileIds(ids).filter((id) => validIds.has(id))

  if (actives.length === 0) {
    const fallbackId = pickFirstValidProfileId([nextCurrent, config.current, config.items[0]?.id], validIds)
    actives = fallbackId ? [fallbackId] : []
  }

  const current = pickFirstValidProfileId([nextCurrent, actives[0]], validIds)

  const nextConfig = normalizeProfileConfig({
    ...config,
    current,
    actives
  })
  if (hasSameProfileSelection(previousConfig, nextConfig)) {
    return
  }

  await setProfileConfig(nextConfig)
  try {
    await restartCore()
  } catch (error) {
    await setProfileConfig(previousConfig)
    throw error
  }
}

export async function updateProfileItem(item: ProfileItem): Promise<void> {
  const config = await getProfileConfig()
  const index = config.items.findIndex((i) => i.id === item.id)
  if (index === -1) {
    throw new Error('Profile not found')
  }
  config.items[index] = item
  await delProfileUpdater(item.id)
  await setProfileConfig(config)
  if (item.autoUpdate !== false) {
    await addProfileUpdater(item)
  }
}

export async function addProfileItem(item: Partial<ProfileItem>): Promise<void> {
  const newItem = await createProfile(item)
  const config = await getProfileConfig()
  if (await getProfileItem(newItem.id)) {
    await updateProfileItem(newItem)
  } else {
    config.items.push(newItem)
  }
  await setProfileConfig(config)

  if (!config.current) {
    await changeCurrentProfile(newItem.id)
  }
  await addProfileUpdater(newItem)
}

export async function removeProfileItem(id: string): Promise<void> {
  const config = await getProfileConfig()
  const activeIds = getActiveProfileIdsFromConfig(config)
  config.items = config.items?.filter((item) => item.id !== id)
  let shouldRestart = activeIds.includes(id)
  if (config.current === id) {
    config.current = activeIds.find((activeId) => activeId !== id) || config.items[0]?.id
  }
  config.actives = activeIds.filter((activeId) => activeId !== id)
  await setProfileConfig(config)
  if (existsSync(profilePath(id))) {
    await rm(profilePath(id))
  }
  if (shouldRestart) {
    await restartCore()
  }
  if (existsSync(mihomoProfileWorkDir(id))) {
    await rm(mihomoProfileWorkDir(id), { recursive: true })
  }
  await delProfileUpdater(id)
}

export async function removeOverrideReference(id: string): Promise<boolean> {
  const config = await getProfileConfig()
  const activeIds = new Set(getActiveProfileIdsFromConfig(config))
  let currentProfileModified = false
  let anyProfileModified = false

  if (config.items) {
    for (const profile of config.items) {
      if (profile.override?.includes(id)) {
        profile.override = profile.override.filter((oid) => oid !== id)
        anyProfileModified = true
        if (activeIds.has(profile.id)) {
          currentProfileModified = true
        }
      }
    }
  }

  if (anyProfileModified) {
    await setProfileConfig(config)
  }
  return currentProfileModified
}

export async function getCurrentProfileItem(): Promise<ProfileItem> {
  const { current } = await getProfileConfig()
  return (await getProfileItem(current)) || { id: 'default', type: 'local', name: '空白订阅' }
}

export async function createProfile(item: Partial<ProfileItem>): Promise<ProfileItem> {
  const id = item.id || new Date().getTime().toString(16)
  const newItem = {
    id,
    name: item.name || (item.type === 'remote' ? 'Remote File' : 'Local File'),
    type: item.type,
    url: item.url,
    fingerprint: item.fingerprint,
    ua: item.ua,
    verify: item.verify ?? false,
    autoUpdate: item.autoUpdate ?? true,
    substore: item.substore || false,
    interval: item.interval || 0,
    override: item.override || [],
    useProxy: item.useProxy || false,
    resetDay: item.resetDay,
    updated: new Date().getTime()
  } as ProfileItem
  switch (newItem.type) {
    case 'remote': {
      const { 'mixed-port': mixedPort = 7890 } = await getControledMihomoConfig()
      if (!item.url) throw new Error('Empty URL')
      let res: AxiosResponse
      if (newItem.substore) {
        const urlObj = new URL(`http://127.0.0.1:${subStorePort}${item.url}`)
        urlObj.searchParams.set('target', 'ClashMeta')
        urlObj.searchParams.set('noCache', 'true')
        if (newItem.useProxy && mixedPort != 0) {
          urlObj.searchParams.set('proxy', `http://127.0.0.1:${mixedPort}`)
        } else {
          urlObj.searchParams.delete('proxy')
        }
        res = await axios.get(urlObj.toString(), {
          headers: {
            'User-Agent': await getUserAgent()
          },
          responseType: 'text'
        })
      } else {
        try {
          const httpsAgent = new https.Agent({ rejectUnauthorized: !item.fingerprint })

          if (item.fingerprint) {
            const expected = item.fingerprint.replace(/:/g, '').toUpperCase()
            const verify = (s: tls.TLSSocket) => {
              if (getCertFingerprint(s.getPeerCertificate()) !== expected)
                s.destroy(new Error('证书指纹不匹配'))
            }

            if (newItem.useProxy && mixedPort != 0) {
              const urlObj = new URL(item.url)
              const hostname = urlObj.hostname
              const port = urlObj.port || '443'
              httpsAgent.createConnection = (_, cb) => {
                const req = http.request({
                  host: '127.0.0.1',
                  port: mixedPort,
                  method: 'CONNECT',
                  path: `${hostname}:${port}`
                })

                req.on('connect', (res, sock, head) => {
                  if (res.statusCode !== 200) {
                    cb?.(new Error(`代理连接失败，状态码：${res.statusCode}`), null!)
                    return
                  }
                  if (head.length > 0) sock.unshift(head)
                  const tls$ = tls.connect(
                    { socket: sock, servername: hostname, rejectUnauthorized: false },
                    () => verify(tls$)
                  )
                  cb?.(null, tls$)
                })

                req.on('error', (e) => cb?.(e, null!))
                req.end()
                return null!
              }
            } else {
              const conn = httpsAgent.createConnection.bind(httpsAgent)
              httpsAgent.createConnection = (o, c) => {
                const sock = conn(o, c)
                sock?.once('secureConnect', function (this: tls.TLSSocket) {
                  verify(this)
                })
                return sock
              }
            }
          }

          res = await axios.get(item.url, {
            httpsAgent,
            ...(newItem.useProxy &&
              mixedPort &&
              !item.fingerprint && {
                proxy: { protocol: 'http', host: '127.0.0.1', port: mixedPort }
              }),
            headers: { 'User-Agent': newItem.ua || (await getUserAgent()) },
            responseType: 'text'
          })
        } catch (error) {
          if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNRESET' || error.code === 'ECONNABORTED') {
              throw new Error(`网络连接被重置或超时：${item.url}`)
            } else if (error.code === 'CERT_HAS_EXPIRED') {
              throw new Error(`服务器证书已过期：${item.url}`)
            } else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
              throw new Error(`无法验证服务器证书：${item.url}`)
            } else if (error.message.includes('Certificate verification failed')) {
              throw new Error(`证书验证失败：${item.url}`)
            } else {
              throw new Error(`请求失败：${error.message}`)
            }
          }
          throw error
        }
      }

      const data = res.data
      const headers = res.headers
      const contentDispositionKey = Object.keys(headers).find((k) =>
        k.toLowerCase().endsWith('content-disposition')
      )
      if (contentDispositionKey && newItem.name === 'Remote File') {
        newItem.name = parseFilename(headers[contentDispositionKey])
      }
      const homeKey = Object.keys(headers).find((k) =>
        k.toLowerCase().endsWith('profile-web-page-url')
      )
      if (homeKey) {
        newItem.home = headers[homeKey]
      }
      const intervalKey = Object.keys(headers).find((k) =>
        k.toLowerCase().endsWith('profile-update-interval')
      )
      if (intervalKey) {
        newItem.interval = parseInt(headers[intervalKey]) * 60
        if (newItem.interval) {
          newItem.locked = true
        }
      }
      const userinfoKey = Object.keys(headers).find((k) =>
        k.toLowerCase().endsWith('subscription-userinfo')
      )
      if (userinfoKey) {
        newItem.extra = parseSubinfo(headers[userinfoKey])
      }
      if (newItem.verify) {
        try {
          parseYaml<MihomoConfig>(data)
        } catch (error) {
          throw new Error('订阅格式错误，无法解析为有效的配置文件\n' + (error as Error).message)
        }
      }
      await setProfileStr(id, data)
      break
    }
    case 'local': {
      const data = item.file || ''
      await setProfileStr(id, data)
      break
    }
  }
  return newItem
}

export async function getProfileStr(id: string | undefined): Promise<string> {
  if (existsSync(profilePath(id || 'default'))) {
    return await readFile(profilePath(id || 'default'), 'utf-8')
  } else {
    return stringifyYaml(defaultProfile)
  }
}

export async function getProfileParseStr(id: string | undefined): Promise<string> {
  let data: string
  if (existsSync(profilePath(id || 'default'))) {
    data = await readFile(profilePath(id || 'default'), 'utf-8')
  } else {
    data = stringifyYaml(defaultProfile)
  }
  const profile = deepMerge(parseYaml<object>(data), {})
  return stringifyYaml(profile)
}

export async function setProfileStr(id: string, content: string): Promise<void> {
  const config = await getProfileConfig()
  await writeFile(profilePath(id), content, 'utf-8')
  if (getActiveProfileIdsFromConfig(config).includes(id)) await restartCore()
}

export async function getProfile(id: string | undefined): Promise<MihomoConfig> {
  const profile = await getProfileStr(id)
  let result = parseYaml<MihomoConfig>(profile)
  if (typeof result !== 'object') result = {} as MihomoConfig
  return result
}

// attachment;filename=xxx.yaml; filename*=UTF-8''%xx%xx%xx
function parseFilename(str: string): string {
  if (str.match(/filename\*=.*''/)) {
    const filename = decodeURIComponent(str.split(/filename\*=.*''/)[1])
    return filename
  } else {
    const filename = str.split('filename=')[1]
    return filename
  }
}

// subscription-userinfo: upload=1234; download=2234; total=1024000; expire=2218532293
function parseSubinfo(str: string): SubscriptionUserInfo {
  const parts = str.split(';')
  const obj = {} as SubscriptionUserInfo
  parts.forEach((part) => {
    const [key, value] = part.trim().split('=')
    obj[key] = parseInt(value)
  })
  return obj
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[a-zA-Z]:\\/.test(path)
}

export async function getFileStr(path: string): Promise<string> {
  const { diffWorkDir = false } = await getAppConfig()
  const { current } = await getProfileConfig()
  let filePath = path
  if (!isAbsolutePath(path)) {
    filePath = join(diffWorkDir ? mihomoProfileWorkDir(current) : mihomoWorkDir(), path)
  }

  const buffer = await readFile(filePath)
  const str = iconv.decode(buffer, 'utf8')

  if (str.includes('')) {
    const gbkStr = iconv.decode(buffer, 'gbk')
    return gbkStr
  }
  return str
}

export async function setFileStr(path: string, content: string): Promise<void> {
  const { diffWorkDir = false } = await getAppConfig()
  const { current } = await getProfileConfig()
  if (isAbsolutePath(path)) {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, content, 'utf-8')
  } else {
    const target = join(diffWorkDir ? mihomoProfileWorkDir(current) : mihomoWorkDir(), path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content, 'utf-8')
  }
}

export async function convertMrsRuleset(filePath: string, behavior: string): Promise<string> {
  const { exec } = await import('child_process')
  const { promisify } = await import('util')
  const execAsync = promisify(exec)
  const { tmpdir } = await import('os')
  const { randomBytes } = await import('crypto')
  const { unlink } = await import('fs/promises')

  const { core = 'mihomo' } = await getAppConfig()
  const corePath = mihomoCorePath(core)
  const { diffWorkDir = false } = await getAppConfig()
  const { current } = await getProfileConfig()
  let fullPath: string
  if (isAbsolutePath(filePath)) {
    fullPath = filePath
  } else {
    fullPath = join(diffWorkDir ? mihomoProfileWorkDir(current) : mihomoWorkDir(), filePath)
  }

  const tempFileName = `mrs-convert-${randomBytes(8).toString('hex')}.txt`
  const tempFilePath = join(tmpdir(), tempFileName)

  try {
    // 使用 mihomo convert-ruleset 命令转换 MRS 文件为 text 格式
    // 命令格式: mihomo convert-ruleset <behavior> <format> <source> <output>
    await execAsync(`"${corePath}" convert-ruleset ${behavior} mrs "${fullPath}" "${tempFilePath}"`)
    const content = await readFile(tempFilePath, 'utf-8')
    await unlink(tempFilePath)

    return content
  } catch (error) {
    try {
      if (existsSync(tempFilePath)) {
        await unlink(tempFilePath)
      }
    } catch {
      // ignore
    }
    throw error
  }
}
