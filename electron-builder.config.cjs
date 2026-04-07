const fs = require('fs')
const path = require('path')
const YAML = require('yaml')

const isAutoBuild = process.env.ROUTEX_AUTO_BUILD === 'true'
const configPath = path.join(__dirname, 'electron-builder.yml')
const baseConfig = YAML.parse(fs.readFileSync(configPath, 'utf8'))
function injectArtifactName(pattern) {
  if (!isAutoBuild || typeof pattern !== 'string') {
    return pattern
  }

  return pattern.replace('RouteX-${version}', 'RouteX-Autobuild-${version}')
}

function injectArtifactNameIntoConfig(config) {
  if (!config) {
    return undefined
  }

  return {
    ...config,
    artifactName: injectArtifactName(config.artifactName)
  }
}

function resolveElectronDist() {
  if (process.env.ROUTEX_USE_LOCAL_ELECTRON_DIST !== 'true') {
    return undefined
  }

  const electronPackageDir = path.dirname(require.resolve('electron/package.json'))
  const electronDist = path.join(electronPackageDir, 'dist')

  return fs.existsSync(electronDist) ? electronDist : undefined
}

module.exports = {
  ...baseConfig,
  // Only opt into the installed Electron distribution when CI explicitly asks
  // for it. This keeps macOS/Linux on the default electron-builder flow while
  // allowing Windows jobs to bypass flaky Electron zip downloads.
  electronDist: resolveElectronDist(),
  artifactName: injectArtifactName(baseConfig.artifactName),
  win: injectArtifactNameIntoConfig(baseConfig.win),
  nsis: injectArtifactNameIntoConfig(baseConfig.nsis),
  mac: injectArtifactNameIntoConfig(baseConfig.mac),
  linux: injectArtifactNameIntoConfig(baseConfig.linux)
}
