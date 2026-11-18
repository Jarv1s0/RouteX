import net from 'node:net'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)

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
  const hasRouteXEntry =
    /<script\s+type="module"\s+src="\.\/main\.tsx(?:\?[^"]*)?"><\/script>/.test(html)

  return html.includes('<title>RouteX</title>') && html.includes('/@vite/client') && hasRouteXEntry
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

  const viteCli = resolve(dirname(require.resolve('vite/package.json')), 'bin/vite.js')
  const child = spawn(
    process.execPath,
    [viteCli, '--configLoader', 'runner', '--config', 'vite.tauri.config.ts'],
    { stdio: 'inherit' }
  )

  let childExited = false
  const childResult = new Promise((resolve) => {
    child.once('exit', (code, signal) => {
      childExited = true
      resolve({ code, signal })
    })
    child.once('error', (error) => {
      childExited = true
      resolve({ error })
    })
  })

  let shutdownSignal = null

  const stopChild = (signal) => {
    shutdownSignal ??= signal

    if (!childExited && !child.killed) {
      child.kill(signal)
    }
  }

  process.once('SIGINT', () => stopChild('SIGINT'))
  process.once('SIGTERM', () => stopChild('SIGTERM'))

  const ready = await waitForRouteXViteServer(40, () => shutdownSignal !== null || childExited)
  if (shutdownSignal) {
    return
  }

  if (!ready && !childExited) {
    stopChild('SIGTERM')
    console.error(`[RouteX] failed to bring up the Vite dev server at ${DEV_URL}`)
    process.exit(1)
  }

  const { code, signal, error } = await childResult
  if (shutdownSignal) {
    return
  }
  if (error) {
    throw error
  }
  if (signal) {
    throw new Error(`dev:tauri-web exited with signal ${signal}`)
  }
  if (code !== 0 || !ready) {
    throw new Error(
      `dev:tauri-web exited with code ${code ?? 'unknown'}${!ready ? ' before becoming ready' : ''}`
    )
  }
}

await main()
