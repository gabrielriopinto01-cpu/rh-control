const CACHE_NAME = 'rh-control-v1'

// Arquivos estáticos para cache offline
const STATIC_ASSETS = [
  '/meu-ponto',
  '/meu-perfil',
  '/minhas-ferias',
  '/meus-holerites',
  '/meus-documentos',
  '/banco-horas',
  '/offline',
]

// Install — pré-cача das rotas principais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Ignora erros de pré-cache (rotas dinâmicas podem não existir ainda)
      })
    })
  )
  self.skipWaiting()
})

// Activate — limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// Fetch — estratégia Network First com fallback para cache
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Ignora requisições não-GET e chamadas de API/Supabase
  if (request.method !== 'GET') return
  if (request.url.includes('supabase.co')) return
  if (request.url.includes('_next/webpack-hmr')) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Guarda no cache se for resposta válida
        if (response && response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => {
        // Offline: tenta servir do cache
        return caches.match(request).then((cached) => {
          if (cached) return cached
          // Fallback para a página offline se for navegação
          if (request.mode === 'navigate') {
            return caches.match('/offline') || new Response(
              '<html><body style="font-family:sans-serif;text-align:center;padding:64px"><h1>Sem conexão</h1><p>Você está offline. Reconecte para continuar.</p></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            )
          }
        })
      })
  )
})

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title || 'RH Control', {
      body:  data.body  || '',
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data:  data.url ? { url: data.url } : {},
      vibrate: [200, 100, 200],
    })
  )
})

// Clique na notificação — abre a URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/meu-ponto'
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
