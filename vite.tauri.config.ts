import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import { DEV_RENDERER_META_CSP, PROD_RENDERER_META_CSP } from './src/shared/csp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const tauriBuildVariant =
  process.env.ROUTEX_TAURI_BUILD_VARIANT ||
  (process.env.ROUTEX_AUTO_BUILD === 'true'
    ? 'autobuild'
    : process.env.NODE_ENV === 'development'
      ? 'dev'
      : 'release')

const routexBuildCommit = (process.env.ROUTEX_BUILD_COMMIT || '').trim()
const routexBuildNumber = (process.env.ROUTEX_BUILD_NUMBER || '').trim()

const routexBuildDefines = {
  __ROUTEX_AUTO_BUILD__: JSON.stringify(process.env.ROUTEX_AUTO_BUILD === 'true'),
  __ROUTEX_BUILD_COMMIT__: JSON.stringify(routexBuildCommit),
  __ROUTEX_BUILD_NUMBER__: JSON.stringify(routexBuildNumber),
  __ROUTEX_BUILD_VARIANT__: JSON.stringify(tauriBuildVariant),
  __ROUTEX_HOST__: JSON.stringify('tauri'),
  __ROUTEX_PLATFORM__: JSON.stringify(process.platform)
}

const rendererCsp =
  process.env.NODE_ENV === 'development' ? DEV_RENDERER_META_CSP : PROD_RENDERER_META_CSP

const manualChunkRules: Array<[string, string[]]> = [
  [
    'vendor-react',
    [
      '/node_modules/react/',
      '/node_modules/react-dom/',
      '/node_modules/scheduler/',
      '/node_modules/next-themes/'
    ]
  ],
  ['vendor-chart', ['/node_modules/echarts/', '/node_modules/zrender/']],
  [
    'vendor-editor',
    ['/node_modules/@codemirror/', '/node_modules/@lezer/', '/node_modules/style-mod/']
  ],
  [
    'vendor-core',
    [
      '/node_modules/react-router-dom/',
      '/node_modules/@remix-run/router/',
      '/node_modules/zustand/',
      '/node_modules/swr/'
    ]
  ]
]

function createManualChunks(id: string): string | undefined {
  const normalizedId = id.split('\\').join('/')

  if (!normalizedId.includes('/node_modules/')) {
    return undefined
  }

  return manualChunkRules.find(([, packagePaths]) =>
    packagePaths.some((packagePath) => normalizedId.includes(packagePath))
  )?.[0]
}

export default defineConfig({
  root: resolve(__dirname, 'src/tauri-web'),
  define: routexBuildDefines,
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'routex-renderer-csp',
      transformIndexHtml() {
        return [
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content: rendererCsp
            },
            injectTo: 'head-prepend'
          }
        ]
      }
    },
    process.env.ANALYZE === 'true' &&
      visualizer({
        filename: 'dist-tauri/stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true
      })
  ],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
    fs: {
      allow: [resolve(__dirname, 'src')]
    }
  },
  preview: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true
  },
  build: {
    modulePreload: false,
    outDir: resolve(__dirname, 'dist-tauri'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 2400,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/tauri-web/index.html'),
        floating: resolve(__dirname, 'src/tauri-web/floating.html'),
        traymenu: resolve(__dirname, 'src/tauri-web/traymenu.html')
      },
      output: {
        manualChunks: createManualChunks
      }
    }
  }
})
