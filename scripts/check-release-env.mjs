const requiredEnv = [
  'ROUTEX_UPDATER_PUBLIC_KEY',
  'TAURI_SIGNING_PRIVATE_KEY'
]
const optionalEnv = [
  'TAURI_SIGNING_PRIVATE_KEY_PASSWORD',
  'ROUTEX_UPDATER_STABLE_ENDPOINT',
  'ROUTEX_UPDATER_BETA_ENDPOINT'
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

const publicKey = process.env.ROUTEX_UPDATER_PUBLIC_KEY.replace(/\\n/g, '\n').trim()
const publicKeyLines = publicKey.split(/\r?\n/).filter((line) => line.trim())
if (publicKeyLines.length > 1 && !/comment/i.test(publicKeyLines[0])) {
  console.error(
    '[release-env] ROUTEX_UPDATER_PUBLIC_KEY has multiple lines but is missing the public key comment line'
  )
  process.exit(1)
}

if (publicKeyLines.length === 1) {
  console.warn('[release-env] ROUTEX_UPDATER_PUBLIC_KEY has no comment line; release build will add the default Tauri public key comment')
}

for (const name of optionalEnv) {
  if (!process.env[name]?.trim()) {
    if (name === 'TAURI_SIGNING_PRIVATE_KEY_PASSWORD') {
      console.warn('[release-env] TAURI_SIGNING_PRIVATE_KEY_PASSWORD is not set; assuming the signing key has no password')
      continue
    }

    console.warn(`[release-env] ${name} is not set; built-in GitHub release endpoint will be used`)
  }
}

console.log('[release-env] updater environment check passed')
