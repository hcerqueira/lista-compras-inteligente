const CACHE_NAME = 'lista-compras-v1';
// Arquivos principais do App
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/assets/icon-192.png',
    '/assets/icon-512.png'
];

// 1. Instalação: Salva os arquivos no Cache
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache aberto');
                return cache.addAll(urlsToCache);
            })
    );
});

// 2. Fetch: Intercepta as requisições
self.addEventListener('fetch', event => {
    event.respondWith(
        // Tenta encontrar o recurso no Cache
        caches.match(event.request)
            .then(response => {
                // Se encontrou no cache, retorna ele
                if (response) {
                    return response;
                }
                
                // Se não encontrou, faz a requisição à rede
                return fetch(event.request);
            }
        )
    );
});

// 3. Ativação: (Opcional) Limpa caches antigos se o nome do cache mudar
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});