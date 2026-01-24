import React from 'react'
import ReactDOM from 'react-dom/client'
import { init, platform } from '@renderer/utils/init'
import '@renderer/assets/main.css'
import App from '@renderer/App'
import { openDevTools, quitApp } from './utils/ipc'
import Providers from './components/providers'

let F12Count = 0

init().then(() => {
  document.addEventListener('keydown', (e) => {
    if (platform !== 'darwin' && e.ctrlKey && e.key === 'q') {
      e.preventDefault()
      quitApp()
    }
    if (platform === 'darwin' && e.metaKey && e.key === 'q') {
      e.preventDefault()
      quitApp()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      window.close()
    }
    if (e.key === 'F12') {
      e.preventDefault()
      F12Count++
      if (F12Count >= 5) {
        openDevTools()
        F12Count = 0
      }
    }
  })
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>
)
