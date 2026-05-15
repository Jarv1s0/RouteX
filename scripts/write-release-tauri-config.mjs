import fs from 'node:fs'
import path from 'node:path'

function requiredEnv(name) {
  const value = process.env[name]?.replace(/\\n/g, '\n').trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function normalizePublicKey(publicKey) {
  const lines = publicKey.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length > 1 && !/comment/i.test(lines[0])) {
    throw new Error(
      'ROUTEX_UPDATER_PUBLIC_KEY has multiple lines but is missing the public key comment line'
    )
  }

  if (lines.length === 1) {
    return `untrusted comment: tauri public key\n${lines[0]}`
  }

  return lines.join('\n')
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
