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
  const candidates = value.split(/\r?\n/).flatMap((line) => {
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

const rpmBundle = process.argv.includes('--rpm')
const outputPath =
  process.argv.slice(2).find((arg) => arg !== '--rpm') || 'src-tauri/tauri.release.conf.json'
const publicKey = normalizePublicKey(requiredEnv('ROUTEX_UPDATER_PUBLIC_KEY'))
const buildVersion = process.env.ROUTEX_BUILD_VERSION?.trim()
let rpmVersion
let rpmRelease

if (rpmBundle) {
  const version = buildVersion || JSON.parse(fs.readFileSync('package.json', 'utf8')).version
  const match = version.match(/^(\d+\.\d+\.\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/)
  if (!match) {
    throw new Error(`Invalid RPM source version: ${version}`)
  }
  // RPM Version rejects SemVer's prerelease separator. Keep the app's compiled
  // version intact and move the prerelease to Release, below stable Release 1.
  rpmVersion = match[1]
  rpmRelease = match[2] ? `0.${match[2].replaceAll('-', '.')}` : '1'
}

const releaseConfig = {
  ...(rpmBundle ? { version: rpmVersion } : buildVersion ? { version: buildVersion } : {}),
  bundle: {
    createUpdaterArtifacts: true,
    ...(rpmBundle ? { linux: { rpm: { release: rpmRelease } } } : {})
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
