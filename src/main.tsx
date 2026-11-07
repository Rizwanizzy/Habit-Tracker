import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import { App } from './App'

// Register the PWA service worker (vite-plugin-pwa) so registration.showNotification
// and the push-sw.js handlers exist. registerType 'autoUpdate' reloads on updates.
registerSW({ immediate: true })

// Apply stored/system theme before first paint to avoid a flash.
const stored = localStorage.getItem('theme')
const dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
document.documentElement.classList.toggle('dark', dark)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)