function isLegacyWindowsBuild(osRelease?: string): boolean {
  if (!osRelease) {
    return false
  }

  const build = parseInt(osRelease.split('.')[2] || '', 10)
  return Number.isFinite(build) && build <= 20000
}

export function createDefaultAppConfig(
  platform: NodeJS.Platform,
  osRelease?: string
): AppConfig {
  return {
    core: 'mihomo',
    updateChannel: 'stable',
    silentStart: false,
    appTheme: 'system',
    useWindowFrame: false,
    proxyInTray: true,
    useCustomTrayMenu: false,
    maxLogDays: 7,
    proxyCols: 'auto',
    connectionDirection: 'asc',
    connectionOrderBy: 'time',
    connectionInterval: 250,
    proxyDisplayOrder: 'default',
    autoCheckUpdate: false,
    autoCloseConnection: true,
    autoDelayTestOnShow: false,
    customTheme: 'CoolApk.css',
    controlDns: true,
    controlSniff: true,
    delayTestConcurrency: 8,
    delayTestTimeout: 5000,
    hosts: [],
    siderOrder: [
      'sysproxy',
      'tun',
      'dns',
      'sniff',
      'proxy',
      'connection',
      'profile',
      'mihomo',
      'rule',
      'override',
      'log',
      'stats',
      'tools'
    ],
    siderWidth: 250,
    sysProxy: { enable: false, mode: 'manual' },
    disableLoopbackDetector: false,
    disableEmbedCA: false,
    disableSystemCA: false,
    disableNftables: false,
    safePaths: [],
    disableGPU: platform === 'win32' && isLegacyWindowsBuild(osRelease),
    proxyDisplayLayout: 'double',
    groupDisplayLayout: 'double',
    mapCardStatus: 'col-span-1',
    autoLightweightMode: 'core'
  }
}
