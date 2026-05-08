import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, type IndexHtmlTransformContext, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import monacoEditorPluginModule from 'vite-plugin-monaco-editor'
import { DEV_RENDERER_META_CSP, PROD_RENDERER_META_CSP } from './src/shared/csp'

const isObjectWithDefaultFunction = (
  module: unknown
): module is { default: typeof monacoEditorPluginModule } =>
  module != null &&
  typeof module === 'object' &&
  'default' in module &&
  typeof module.default === 'function'

const monacoEditorPlugin = isObjectWithDefaultFunction(monacoEditorPluginModule)
  ? monacoEditorPluginModule.default
  : monacoEditorPluginModule

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const tauriBuildVariant =
  process.env.ROUTEX_TAURI_BUILD_VARIANT ||
  (process.env.ROUTEX_AUTO_BUILD === 'true' ? 'autobuild' : process.env.NODE_ENV === 'development' ? 'dev' : 'release')

const routexBuildDefines = {
  __ROUTEX_AUTO_BUILD__: JSON.stringify(process.env.ROUTEX_AUTO_BUILD === 'true'),
  __ROUTEX_BUILD_VARIANT__: JSON.stringify(tauriBuildVariant),
  __ROUTEX_HOST__: JSON.stringify('tauri'),
  __ROUTEX_PLATFORM__: JSON.stringify(process.platform)
}

const rendererCsp = process.env.NODE_ENV === 'development' ? DEV_RENDERER_META_CSP : PROD_RENDERER_META_CSP

function createMonacoPlugin(): Plugin {
  const plugin = monacoEditorPlugin({
    languageWorkers: ['editorWorkerService'],
    // @ts-expect-error - vite-plugin-monaco-editor type mismatch
    languages: ['yaml', 'json'],
    customDistPath: (_root, outDir) => `${outDir}/monacoeditorwork`,
    customWorkers: [
      {
        label: 'yaml',
        entry: 'monaco-yaml/yaml.worker'
      }
    ]
  }) as Plugin

  const transformIndexHtml = plugin.transformIndexHtml
  plugin.transformIndexHtml = function transformMonacoIndexHtml(html, ctx?: IndexHtmlTransformContext) {
    if (ctx && !ctx.filename.endsWith('index.html')) {
      return html
    }

    if (typeof transformIndexHtml === 'function') {
      return transformIndexHtml.call(this, html, ctx)
    }

    return transformIndexHtml
  }

  return plugin
}

function createManualChunks(id: string): string | undefined {
  const normalizedId = id.split('\\').join('/')

  if (!normalizedId.includes('/node_modules/')) {
    return undefined
  }

  if (
    normalizedId.includes('/node_modules/react/') ||
    normalizedId.includes('/node_modules/react-dom/') ||
    normalizedId.includes('/node_modules/scheduler/') ||
    normalizedId.includes('/node_modules/next-themes/')
  ) {
    return 'vendor-react'
  }

  if (normalizedId.includes('/node_modules/framer-motion/')) {
    return 'vendor-motion'
  }

  if (
    normalizedId.includes('/node_modules/@heroui/') ||
    normalizedId.includes('/node_modules/@react-aria/') ||
    normalizedId.includes('/node_modules/@react-stately/') ||
    normalizedId.includes('/node_modules/@react-types/') ||
    normalizedId.includes('/node_modules/@internationalized/')
  ) {
    return 'vendor-ui'
  }

  if (
    normalizedId.includes('/node_modules/echarts/') ||
    normalizedId.includes('/node_modules/zrender/')
  ) {
    return 'vendor-chart'
  }

  if (
    normalizedId.includes('/node_modules/monaco-editor/') ||
    normalizedId.includes('/node_modules/react-monaco-editor/')
  ) {
    return 'vendor-editor'
  }

  if (normalizedId.includes('/node_modules/monaco-yaml/')) {
    return 'vendor-editor-yaml'
  }

  if (
    normalizedId.includes('/node_modules/react-router-dom/') ||
    normalizedId.includes('/node_modules/@remix-run/router/') ||
    normalizedId.includes('/node_modules/zustand/') ||
    normalizedId.includes('/node_modules/swr/')
  ) {
    return 'vendor-core'
  }

  return undefined
}

export default defineConfig({
  root: resolve(__dirname, 'src/tauri-web'),
  define: routexBuildDefines,
  plugins: [
    react(),
    tailwindcss(),
    createMonacoPlugin(),
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
    }
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
