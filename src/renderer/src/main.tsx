import React from 'react'
import ReactDOM from 'react-dom/client'
import { init, platform } from '@renderer/utils/init'
import '@renderer/utils/install-global-alert'
import '@renderer/assets/main.css'

const App = React.lazy(() => import('@renderer/App'))
const Providers = React.lazy(() => import('./components/providers'))

let F12Count = 0

async function quitAppSafely(): Promise<void> {
  const { quitApp } = await import('./utils/app-ipc')
  await quitApp()
}

async function openDevToolsSafely(): Promise<void> {
  const { openDevTools } = await import('./utils/app-ipc')
  await openDevTools()
}

init().then(() => {
  document.addEventListener('keydown', (e) => {
    if (platform !== 'darwin' && e.ctrlKey && e.key === 'q') {
      e.preventDefault()
      void quitAppSafely()
    }
    if (platform === 'darwin' && e.metaKey && e.key === 'q') {
      e.preventDefault()
      void quitAppSafely()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      window.close()
    }
    if (e.key === 'F12') {
      e.preventDefault()
      F12Count++
      if (F12Count >= 5) {
        void openDevToolsSafely()
        F12Count = 0
      }
    }
  })
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <React.Suspense fallback={null}>
      <Providers>
        <React.Suspense fallback={null}>
          <App />
        </React.Suspense>
      </Providers>
    </React.Suspense>
  </React.StrictMode>
)
