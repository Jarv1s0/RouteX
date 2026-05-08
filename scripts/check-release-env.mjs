const requiredEnv = [
  'ROUTEX_UPDATER_PUBLIC_KEY',
  'TAURI_SIGNING_PRIVATE_KEY',
  'TAURI_SIGNING_PRIVATE_KEY_PASSWORD'
]
const optionalEnv = ['ROUTEX_UPDATER_STABLE_ENDPOINT', 'ROUTEX_UPDATER_BETA_ENDPOINT']

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

for (const name of optionalEnv) {
  if (!process.env[name]?.trim()) {
    console.warn(`[release-env] ${name} is not set; built-in GitHub release endpoint will be used`)
  }
}

console.log('[release-env] updater environment check passed')
