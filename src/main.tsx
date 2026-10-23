import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'

// Apply stored/system theme before first paint to avoid a flash.
const stored = localStorage.getItem('theme')
const dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
document.documentElement.classList.toggle('dark', dark)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)