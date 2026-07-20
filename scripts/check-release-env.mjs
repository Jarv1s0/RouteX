const requiredEnv = ['ROUTEX_UPDATER_PUBLIC_KEY', 'TAURI_SIGNING_PRIVATE_KEY']
const optionalEnv = [
  'TAURI_SIGNING_PRIVATE_KEY_PASSWORD',
  'ROUTEX_UPDATER_STABLE_ENDPOINT',
  'ROUTEX_UPDATER_AUTOBUILD_ENDPOINT'
]

if (process.env.ROUTEX_SKIP_UPDATER_ENV_CHECK === 'true') {
  console.warn('[release-env] updater environment check skipped')
  process.exit(0)
}

const missing = requiredEnv.filter((name) => !process.env[name]?.trim())

if (missing.length > 0) {
  console.error(`[release-env] missing required environment variables: ${missing.join(', ')}`)
  console.error(
    '[release-env] set ROUTEX_SKIP_UPDATER_ENV_CHECK=true only for local unsigned packages without updater artifacts'
  )
  process.exit(1)
}

function extractUpdaterPublicKey(value) {
  const candidates = value
    .replace(/\\n/g, '\n')
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

  return candidates.at(-1) || ''
}

const publicKey = extractUpdaterPublicKey(process.env.ROUTEX_UPDATER_PUBLIC_KEY)
if (!publicKey) {
  console.error(
    '[release-env] ROUTEX_UPDATER_PUBLIC_KEY must contain the Tauri updater public key value, for example the base64 value after "Public key:"'
  )
  process.exit(1)
}

if (publicKey !== process.env.ROUTEX_UPDATER_PUBLIC_KEY.trim()) {
  console.warn(
    '[release-env] ROUTEX_UPDATER_PUBLIC_KEY contains extra text; release build will use the extracted public key value'
  )
}

for (const name of optionalEnv) {
  if (!process.env[name]?.trim()) {
    if (name === 'TAURI_SIGNING_PRIVATE_KEY_PASSWORD') {
      console.warn(
        '[release-env] TAURI_SIGNING_PRIVATE_KEY_PASSWORD is not set; assuming the signing key has no password'
      )
      continue
    }

    console.warn(`[release-env] ${name} is not set; built-in GitHub release endpoint will be used`)
  }
}

console.log('[release-env] updater environment check passed')
