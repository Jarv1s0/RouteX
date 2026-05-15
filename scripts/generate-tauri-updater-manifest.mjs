import fs from 'node:fs/promises'

const [, , tagArg, outputArg = 'latest.json'] = process.argv
const tag = tagArg || process.env.RELEASE_TAG
const repository = process.env.GITHUB_REPOSITORY || 'Jarv1s0/RouteX'
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN

if (!tag) {
  throw new Error('Missing release tag argument')
}

function releaseVersion(release) {
  if (process.env.VERSION) {
    return process.env.VERSION
  }

  const tagName = release.tag_name || tag
  return tagName.startsWith('v') ? tagName.slice(1) : tagName
}

async function githubFetch(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'RouteX-updater-manifest',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {})
    }
  })

  if (!response.ok) {
    const error = new Error(`GitHub request failed: ${response.status} ${url}`)
    error.status = response.status
    throw error
  }

  return response
}

async function fetchRelease() {
  const url = `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`
  try {
    return await githubFetch(url).then((response) => response.json())
  } catch (error) {
    if (error.status !== 404) {
      throw error
    }
  }

  for (let page = 1; page <= 5; page += 1) {
    const releases = await githubFetch(
      `https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`
    ).then((response) => response.json())
    const release = releases.find((item) => item.tag_name === tag)
    if (release) {
      return release
    }

    if (releases.length < 100) {
      break
    }
  }

  throw new Error(`Release not found: ${tag}`)
}

async function fetchText(url) {
  const response = await githubFetch(url, {
    headers: { Accept: 'application/octet-stream' }
  })
  return (await response.text()).trim()
}

function platformKeysForAsset(name) {
  const lower = name.toLowerCase()

  if (lower.endsWith('.exe') && !lower.includes('portable')) {
    return ['windows-x86_64-nsis', 'windows-x86_64']
  }

  if (lower.endsWith('.msi')) {
    return ['windows-x86_64-msi']
  }

  if (lower.endsWith('.app.tar.gz')) {
    return ['darwin-aarch64-app', 'darwin-aarch64']
  }

  if (lower.endsWith('.appimage') || lower.endsWith('.appimage.tar.gz')) {
    return ['linux-x86_64-appimage', 'linux-x86_64']
  }

  if (lower.endsWith('.deb')) {
    return ['linux-x86_64-deb']
  }

  if (lower.endsWith('.rpm')) {
    return ['linux-x86_64-rpm']
  }

  return []
}

function releaseAssetUrl(assetName) {
  return `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(assetName)}`
}

const release = await fetchRelease()
const assets = release.assets || []
const signatures = new Map()

for (const asset of assets) {
  if (asset.name.endsWith('.sig')) {
    signatures.set(asset.name.slice(0, -4), await fetchText(asset.url))
  }
}

const platforms = {}
for (const asset of assets) {
  if (asset.name.endsWith('.sig')) {
    continue
  }

  const signature = signatures.get(asset.name)
  if (!signature) {
    continue
  }

  for (const key of platformKeysForAsset(asset.name)) {
    platforms[key] = {
      url: releaseAssetUrl(asset.name),
      signature
    }
  }
}

if (Object.keys(platforms).length === 0) {
  throw new Error(`No signed updater platforms found in release ${tag}`)
}

const manifest = {
  version: releaseVersion(release),
  notes: release.body || '',
  pub_date: release.published_at || release.created_at || new Date().toISOString(),
  platforms
}

await fs.writeFile(outputArg, `${JSON.stringify(manifest, null, 2)}\n`)
