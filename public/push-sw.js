/**
 * Web Push service worker handlers for Habit Tracker.
 * Imported into the main Workbox service worker via importScripts('push-sw.js').
 * Handles:
 *  - 'push': receives push messages from the push service and displays notifications
 *  - 'notificationclick': focuses or opens the app window when a notification is tapped
 *  - 'notificationclose': cleanup / logging when dismissed
 */

/* eslint-disable no-restricted-globals */

self.addEventListener('push', (event) => {
  if (!event.data) {
    // Our sender always sends JSON, so a dataless push means the payload
    // FAILED TO DECRYPT (or the sender is broken) — surface it instead of
    // silently disappearing, which made sender-side crypto bugs invisible.
    console.warn('[push-sw] push arrived with no decryptable data — decryption failed or empty payload')
    const options = {
      body: 'A reminder arrived but this device could not decrypt its payload. Check Settings → Daily Reminders.',
      icon: '/icon-192.png',
      badge: '/pwa-64x64.png',
      tag: 'habit-reminder-undecryptable',
      data: { url: '/' },
    }
    event.waitUntil(self.registration.showNotification('Habit Tracker', options))
    return
  }

  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    payload = {
      title: 'Habit Tracker',
      body: event.data.text() || 'Time to check in on your daily habits!',
    }
  }

  const title = payload.title || 'Habit Tracker'
  const options = {
    body: payload.body || 'Time to check in on your daily habits!',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/pwa-64x64.png',
    tag: payload.tag || 'habit-reminder',
    renotify: payload.renotify !== false,
    data: {
      url: payload.url || '/',
      date: payload.date || null,
      ...payload.data,
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetPath = (event.notification.data && event.notification.data.url) || '/'
  const targetUrl = new URL(targetPath, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. If a tab with the exact URL is open, focus it
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus()
        }
      }

      // 2. If any app tab on this origin is open, navigate and focus it
      for (const client of clientList) {
        if ('focus' in client && 'navigate' in client) {
          return client.navigate(targetUrl).then((navigatedClient) => {
            if (navigatedClient && 'focus' in navigatedClient) {
              return navigatedClient.focus()
            }
            return client.focus()
          })
        }
      }

      // 3. Otherwise open a fresh window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})

self.addEventListener('notificationclose', (_event) => {
  // Reserved for optional client event or badge cleanup
})
