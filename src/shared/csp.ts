const DEV_LOOPBACK_ORIGINS = [
  'http://127.0.0.1:*',
  'ws://127.0.0.1:*',
  'http://localhost:*',
  'ws://localhost:*'
]
const IP_CHECK_ORIGINS = [
  'https://ping0.cc',
  'https://ip.sb',
  'https://whoer.net',
  'https://www.ip138.com'
]

function buildRendererCsp(options: { isDev: boolean }): string {
  const { isDev } = options
  const scriptSrc = isDev ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'"
  const connectSrc = ["'self'", ...DEV_LOOPBACK_ORIGINS].join(' ')
  const frameSrc = ["'self'", 'http://127.0.0.1:*', ...IP_CHECK_ORIGINS].join(' ')

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    scriptSrc,
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: http: https:",
    `connect-src ${connectSrc}`,
    `frame-src ${frameSrc}`,
    `child-src ${frameSrc}`
  ]

  return directives.join('; ')
}

export const DEV_RENDERER_META_CSP = buildRendererCsp({ isDev: true })
export const PROD_RENDERER_META_CSP = buildRendererCsp({ isDev: false })
