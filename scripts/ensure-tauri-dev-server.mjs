import net from 'node:net'
import { spawn } from 'node:child_process'

const DEV_HOST = '127.0.0.1'
const DEV_PORT = 1420
const DEV_URL = `http://${DEV_HOST}:${DEV_PORT}/`
const PROBE_TIMEOUT_MS = 1500

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function isRouteXViteHtml(html) {
  return (
    html.includes('<title>RouteX</title>') &&
    html.includes('/@vite/client') &&
    html.includes('src="./main.tsx"')
  )
}

async function probeDevServer() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)

  try {
    const response = await fetch(DEV_URL, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html'
      }
    })

    return {
      ok: response.ok,
      html: await response.text()
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function isPortInUse(port, host) {
  return await new Promise((resolve) => {
    const socket = net.createConnection({ port, host })

    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })

    socket.once('error', () => {
      resolve(false)
    })
  })
}

async function waitForRouteXViteServer(maxAttempts = 40, shouldStop = () => false) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (shouldStop()) {
      return false
    }

    const probe = await probeDevServer()
    if (probe?.ok && isRouteXViteHtml(probe.html)) {
      return true
    }

    if (shouldStop()) {
      return false
    }

    await delay(500)
  }

  return false
}

async function main() {
  const existing = await probeDevServer()
  if (existing?.ok && isRouteXViteHtml(existing.html)) {
    console.log(`[RouteX] dev server already available at ${DEV_URL}`)
    return
  }

  if (await isPortInUse(DEV_PORT, DEV_HOST)) {
    console.error(
      `[RouteX] port ${DEV_PORT} is already in use, but it is not serving the RouteX Vite app.`
    )
    console.error(
      `[RouteX] stop the process occupying ${DEV_HOST}:${DEV_PORT}, then rerun "pnpm dev".`
    )
    process.exit(1)
  }

  const child = spawn('corepack', ['pnpm', 'run', 'dev:tauri-web'], {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })

  let shutdownSignal = null

  const stopChild = (signal) => {
    shutdownSignal ??= signal

    if (!child.killed) {
      child.kill(signal)
    }
  }

  process.once('SIGINT', () => stopChild('SIGINT'))
  process.once('SIGTERM', () => stopChild('SIGTERM'))

  const ready = await waitForRouteXViteServer(40, () => shutdownSignal !== null)
  if (shutdownSignal) {
    return
  }

  if (!ready) {
    stopChild('SIGTERM')
    console.error(`[RouteX] failed to bring up the Vite dev server at ${DEV_URL}`)
    process.exit(1)
  }

  await new Promise((resolve, reject) => {
    child.once('exit', (code, signal) => {
      if (shutdownSignal) {
        resolve()
        return
      }

      if (signal) {
        reject(new Error(`dev:tauri-web exited with signal ${signal}`))
        return
      }

      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`dev:tauri-web exited with code ${code ?? 'unknown'}`))
    })

    child.once('error', reject)
  })
}

await main()
