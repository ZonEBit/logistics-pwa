const CACHE_NAME = 'parcel-tracker-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './parser.js',
  './db.js',
  './manifest.json',
  './icons/icon.svg'
];

// 安装阶段：预缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('正在预缓存静态资源');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// 激活阶段：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('清理旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 拦截请求：缓存优先策略
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 如果在缓存中找到，直接返回
        if (response) {
          return response;
        }
        
        // 否则发起网络请求
        return fetch(event.request).then((networkResponse) => {
          // 检查响应是否有效
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          // 动态缓存请求到的资源
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        });
      }).catch(() => {
        // 离线且无缓存时的降级处理（可选）
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      })
  );
});
