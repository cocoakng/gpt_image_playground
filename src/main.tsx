import 'core-js/actual/array/at'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import 'streamdown/styles.css'
import './index.css'
import { installMobileViewportGuards } from './lib/viewport'

installMobileViewportGuards()

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
        console.error('Service worker registration failed:', error)
      })
    })

    // 监听 Service Worker 更新事件，自动刷新
    let updateActivated = false
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_ACTIVATED' && !updateActivated) {
        updateActivated = true
        // 避免短时间重复刷新：如果 3 秒内已经收到过则跳过
        const lastRefresh = sessionStorage.getItem('sw-last-refresh')
        const now = Date.now()
        if (!lastRefresh || now - Number(lastRefresh) > 3000) {
          sessionStorage.setItem('sw-last-refresh', String(now))
          window.location.reload()
        }
      }
    })
  } else {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister())
    })
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
