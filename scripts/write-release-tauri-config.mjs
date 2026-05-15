import fs from 'node:fs'
import path from 'node:path'

function requiredEnv(name) {
  const value = process.env[name]?.replace(/\\n/g, '\n').trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function normalizePublicKey(value) {
  const candidates = value
    .split(/\r?\n/)
    .flatMap((line) => {
      const trimmed = line.trim().replace(/^['"]|['"]$/g, '')
      if (!trimmed || /comment/i.test(trimmed)) {
        return []
      }

      const labeled = trimmed.match(/^(?:public\s*key|routex_updater_public_key)\s*[:=]\s*(.+)$/i)
      const source = labeled ? labeled[1].trim() : trimmed
      return source.match(/[A-Za-z0-9+/=]{32,}/g) || []
    })
  const publicKey = candidates.at(-1)

  if (!publicKey) {
    throw new Error(
      'ROUTEX_UPDATER_PUBLIC_KEY must contain the Tauri updater public key value, for example the base64 value after "Public key:"'
    )
  }

  return publicKey
}

const outputPath = process.argv[2] || 'src-tauri/tauri.release.conf.json'
const publicKey = normalizePublicKey(requiredEnv('ROUTEX_UPDATER_PUBLIC_KEY'))

const releaseConfig = {
  bundle: {
    createUpdaterArtifacts: true
  },
  plugins: {
    updater: {
      pubkey: publicKey
    }
  }
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(releaseConfig, null, 2)}\n`)
console.log(`[release-config] wrote ${outputPath}`)
