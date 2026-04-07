const fs = require('fs')
const path = require('path')
const YAML = require('yaml')

const isAutoBuild = process.env.ROUTEX_AUTO_BUILD === 'true'
const configPath = path.join(__dirname, 'electron-builder.yml')
const baseConfig = YAML.parse(fs.readFileSync(configPath, 'utf8'))
const electronPackageDir = path.dirname(require.resolve('electron/package.json'))
const electronDist = path.join(electronPackageDir, 'dist')

function injectArtifactName(pattern) {
  if (!isAutoBuild || typeof pattern !== 'string') {
    return pattern
  }

  return pattern.replace('RouteX-${version}', 'RouteX-Autobuild-${version}')
}

module.exports = {
  ...baseConfig,
  // Reuse the installed Electron package so CI packaging doesn't depend on
  // downloading release zips from GitHub again.
  electronDist: fs.existsSync(electronDist) ? electronDist : undefined,
  artifactName: injectArtifactName(baseConfig.artifactName),
  win: baseConfig.win
    ? {
        ...baseConfig.win,
        artifactName: injectArtifactName(baseConfig.win.artifactName)
      }
    : undefined,
  nsis: baseConfig.nsis
    ? {
        ...baseConfig.nsis,
        artifactName: injectArtifactName(baseConfig.nsis.artifactName)
      }
    : undefined,
  mac: baseConfig.mac
    ? {
        ...baseConfig.mac,
        artifactName: injectArtifactName(baseConfig.mac.artifactName)
      }
    : undefined,
  linux: baseConfig.linux
    ? {
        ...baseConfig.linux,
        artifactName: injectArtifactName(baseConfig.linux.artifactName)
      }
    : undefined
}
