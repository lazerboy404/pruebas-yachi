const CACHE_NAME = 'gestion-camaras-v5';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './gestion.html',
  './evidencias.html',
  './styles.css',
  './responsive-safe.css',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap'
];

// Instalación: Cachear archivos estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activación: Limpiar cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Interceptación de peticiones: Estrategia Network First con fallback a Cache
// Para archivos estáticos usamos Cache First, para datos Network First
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignorar peticiones que no sean GET
  if (event.request.method !== 'GET') return;

  // Estrategia Cache First para imágenes de Firebase Storage
  if (url.hostname.includes('firebasestorage.googleapis.com')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).then((networkResponse) => {
          // Cachear respuesta válida (status 200 y tipo cors/basic)
          if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        }).catch(() => {
            // Si falla la red y no está en caché, no podemos hacer mucho para imágenes nuevas,
            // pero si es una imagen que ya estaba, el match inicial la habría devuelto.
            // Podríamos devolver una imagen placeholder aquí si quisiéramos.
            return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
    );
    return;
  }

  // Estrategia Cache First para archivos estáticos y fuentes
  if (
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.ttf') ||
    url.href.includes('fonts.googleapis.com') ||
    url.href.includes('fonts.gstatic.com') ||
    url.href.includes('cdnjs.cloudflare.com')
  ) {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).then((networkResponse) => {
          // Si la respuesta es válida, la guardamos en caché para la próxima
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        });
      })
    );
    return;
  }

  // Estrategia Network First para HTML y navegación (para tener siempre la última versión si hay red)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la red responde bien, guardamos una copia en caché para el futuro
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Si falla la red, intentamos servir desde caché
        return caches.match(event.request);
      })
  );
});
