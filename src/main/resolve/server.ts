import { getAppConfig, getControledMihomoConfig } from '../config'
import { Worker } from 'worker_threads'
import { mihomoWorkDir, subStoreDir, substoreLogPath } from '../utils/dirs'
import subStoreIcon from '../../../resources/subStoreIcon.png?asset'
import { createWriteStream, existsSync, mkdirSync, readFile } from 'fs'
import { writeFile, rm, cp } from 'fs/promises'
import http from 'http'
import net from 'net'
import path from 'path'
import { nativeImage } from 'electron'
import express from 'express'
import axios from 'axios'
import AdmZip from 'adm-zip'

export let pacPort: number
export let subStorePort: number
export let subStoreFrontendPort: number
let subStoreFrontendServer: http.Server
let subStoreBackendWorker: Worker

const defaultPacScript = `
function FindProxyForURL(url, host) {
  return "PROXY 127.0.0.1:%mixed-port%; SOCKS5 127.0.0.1:%mixed-port%; DIRECT;";
}
`

export function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.on('error', (err) => {
      if (startPort <= 65535) {
        resolve(findAvailablePort(startPort + 1))
      } else {
        reject(err)
      }
    })
    server.on('listening', () => {
      server.close(() => {
        resolve(startPort)
      })
    })
    server.listen(startPort, '127.0.0.1')
  })
}

let pacServer: http.Server

export async function startPacServer(): Promise<void> {
  await stopPacServer()
  const { sysProxy } = await getAppConfig()
  const { mode = 'manual', host: cHost, pacScript } = sysProxy
  if (mode !== 'auto') {
    return
  }
  const host = cHost || '127.0.0.1'
  let script = pacScript || defaultPacScript
  const { 'mixed-port': port = 7890 } = await getControledMihomoConfig()
  script = script.replaceAll('%mixed-port%', port.toString())
  pacPort = await findAvailablePort(10000)
  pacServer = http
    .createServer(async (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/x-ns-proxy-autoconfig' })
      res.end(script)
    })
    .listen(pacPort, host)
}

export async function stopPacServer(): Promise<void> {
  if (pacServer) {
    pacServer.close()
  }
}

export async function startSubStoreFrontendServer(): Promise<void> {
  const { useSubStore = true, subStoreHost = '127.0.0.1' } = await getAppConfig()
  if (!useSubStore) return
  await stopSubStoreFrontendServer()
  subStoreFrontendPort = await findAvailablePort(14122)
  const app = express()
  const frontendDir = path.join(mihomoWorkDir(), 'sub-store-frontend')
  
  // 注入 CSS 修复弹窗位置
  const injectScript = `
    <style>
      /* 强制居中弹窗 */
      .van-popup--bottom {
        top: 50% !important;
        left: 50% !important;
        bottom: auto !important;
        transform: translate(-50%, -50%) !important;
        width: 90% !important;
        max-width: 480px !important;
        border-radius: 16px !important;
        padding-bottom: 20px !important; /* 增加底部内边距，避免紧凑感 */
      }
      /* 适配深色模式背景 */
      .van-popup {
        background: var(--bg-body, #fff) !important;
      }
    </style>
  `

  app.get('/', (_req, res) => {
    const indexPath = path.join(frontendDir, 'index.html')
    readFile(indexPath, 'utf8', (err, data) => {
      if (err) {
        res.status(500).send('Error loading Sub-Store')
        return
      }
      // 在 </head> 前插入样式
      const injectedHtml = data.replace('</head>', `${injectScript}</head>`)
      res.send(injectedHtml)
    })
  })

  app.use(express.static(frontendDir))
  app.use((_req, res) => {
    // Fallback for SPA routing
    const indexPath = path.join(frontendDir, 'index.html')
    readFile(indexPath, 'utf8', (err, data) => {
      if (err) {
        res.status(500).send('Error loading Sub-Store')
        return
      }
      const injectedHtml = data.replace('</head>', `${injectScript}</head>`)
      res.send(injectedHtml)
    })
  })
  subStoreFrontendServer = app.listen(subStoreFrontendPort, subStoreHost)
}

export async function stopSubStoreFrontendServer(): Promise<void> {
  if (subStoreFrontendServer) {
    subStoreFrontendServer.close()
  }
}

export async function startSubStoreBackendServer(): Promise<void> {
  const {
    useSubStore = true,
    useCustomSubStore = false,
    useProxyInSubStore = false,
    subStoreHost = '127.0.0.1',
    subStoreBackendSyncCron = '',
    subStoreBackendDownloadCron = '',
    subStoreBackendUploadCron = ''
  } = await getAppConfig()
  const { 'mixed-port': port = 7890 } = await getControledMihomoConfig()
  if (!useSubStore) return
  if (!useCustomSubStore) {
    await stopSubStoreBackendServer()
    subStorePort = await findAvailablePort(38324)
    const icon = nativeImage.createFromPath(subStoreIcon)
    icon.toDataURL()
    const stdout = createWriteStream(substoreLogPath(), { flags: 'a' })
    const stderr = createWriteStream(substoreLogPath(), { flags: 'a' })
    const env = {
      SUB_STORE_BACKEND_API_PORT: subStorePort.toString(),
      SUB_STORE_BACKEND_API_HOST: subStoreHost,
      SUB_STORE_DATA_BASE_PATH: subStoreDir(),
      SUB_STORE_BACKEND_CUSTOM_ICON: icon.toDataURL(),
      SUB_STORE_BACKEND_CUSTOM_NAME: 'RouteX',
      SUB_STORE_BACKEND_SYNC_CRON: subStoreBackendSyncCron,
      SUB_STORE_BACKEND_DOWNLOAD_CRON: subStoreBackendDownloadCron,
      SUB_STORE_BACKEND_UPLOAD_CRON: subStoreBackendUploadCron,
      SUB_STORE_MMDB_COUNTRY_PATH: path.join(mihomoWorkDir(), 'country.mmdb'),
      SUB_STORE_MMDB_ASN_PATH: path.join(mihomoWorkDir(), 'ASN.mmdb')
    }
    subStoreBackendWorker = new Worker(path.join(mihomoWorkDir(), 'sub-store.bundle.js'), {
      env: useProxyInSubStore
        ? {
            ...env,
            HTTP_PROXY: `http://127.0.0.1:${port}`,
            HTTPS_PROXY: `http://127.0.0.1:${port}`,
            ALL_PROXY: `http://127.0.0.1:${port}`
          }
        : env
    })
    subStoreBackendWorker.stdout.pipe(stdout)
    subStoreBackendWorker.stderr.pipe(stderr)
  }
}

export async function stopSubStoreBackendServer(): Promise<void> {
  if (subStoreBackendWorker) {
    subStoreBackendWorker.terminate()
  }
}

export async function downloadSubStore(): Promise<void> {
  const { 'mixed-port': mixedPort = 7890 } = await getControledMihomoConfig()
  const frontendDir = path.join(mihomoWorkDir(), 'sub-store-frontend')
  const backendPath = path.join(mihomoWorkDir(), 'sub-store.bundle.js')
  const tempDir = path.join(mihomoWorkDir(), 'temp')

  try {
    // 下载后端文件
    const backendRes = await axios.get(
      'https://github.com/sub-store-org/Sub-Store/releases/latest/download/sub-store.bundle.js',
      {
        responseType: 'arraybuffer',
        headers: { 'Content-Type': 'application/octet-stream' },
        ...(mixedPort != 0 && {
          proxy: {
            protocol: 'http',
            host: '127.0.0.1',
            port: mixedPort
          }
        })
      }
    )
    await writeFile(backendPath, Buffer.from(backendRes.data))

    // 下载前端文件
    const frontendRes = await axios.get(
      'https://github.com/sub-store-org/Sub-Store-Front-End/releases/latest/download/dist.zip',
      {
        responseType: 'arraybuffer',
        headers: { 'Content-Type': 'application/octet-stream' },
        ...(mixedPort != 0 && {
          proxy: {
            protocol: 'http',
            host: '127.0.0.1',
            port: mixedPort
          }
        })
      }
    )

    // 创建临时目录
    if (existsSync(tempDir)) {
      await rm(tempDir, { recursive: true })
    }
    mkdirSync(tempDir, { recursive: true })

    // 先解压到临时目录
    const zip = new AdmZip(Buffer.from(frontendRes.data))
    zip.extractAllTo(tempDir, true)

    // 确保目标目录存在并清空
    if (existsSync(frontendDir)) {
      await rm(frontendDir, { recursive: true })
    }
    mkdirSync(frontendDir, { recursive: true })

    // 将 dist 目录中的内容移动到目标目录
    await cp(path.join(tempDir, 'dist'), frontendDir, { recursive: true })

    // 清理临时目录
    await rm(tempDir, { recursive: true })
  } catch (error) {
    console.error('下载 Sub-Store 文件失败：', error)
    throw error
  }
}
