import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import { App } from './App'
import { applyTheme, getStoredTheme } from './hooks/useTheme'

// Register the PWA service worker (vite-plugin-pwa) so registration.showNotification
// and the push-sw.js handlers exist. registerType 'autoUpdate' reloads on updates.
registerSW({ immediate: true })

// Apply stored/system theme before first paint to avoid a flash.
applyTheme(getStoredTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)