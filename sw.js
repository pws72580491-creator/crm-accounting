/* ═══════════════════════════════════════════════════════════════════════════
   거래처·회계 관리 시스템 — Service Worker  v1.1.0
   전략: Cache-First (앱 셸) + Network-First (Firebase SDK)
   ═══════════════════════════════════════════════════════════════════════════ */

const CACHE_NAME    = 'crm-app-v1.1.0';
const RUNTIME_CACHE = 'crm-runtime-v1.1.0';

// 설치 시 즉시 캐싱할 앱 셸 파일
const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// 캐시하지 않을 도메인 패턴 (Firebase RTDB 실시간 연결 등)
const NETWORK_ONLY_PATTERNS = [
  /firebasedatabase\.app/,
  /googleapis\.com\/v1\//,
];

// 런타임 캐시 대상 (Firebase SDK CDN 등 정적 리소스)
const CACHE_PATTERNS = [
  /gstatic\.com\/firebasejs\//,
  /fonts\.googleapis\.com\//,
  /fonts\.gstatic\.com\//,
];

/* ── Install ──────────────────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())   // 즉시 활성화
  );
});

/* ── Activate ─────────────────────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map(name => {
            console.log('[SW] 구 캐시 삭제:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())   // 즉시 클라이언트 제어
  );
});

/* ── Fetch ────────────────────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = request.url;

  // 1) Network-only: Firebase RTDB 실시간 연결 (캐시 금지)
  if (NETWORK_ONLY_PATTERNS.some(p => p.test(url))) {
    event.respondWith(fetch(request));
    return;
  }

  // 2) Cache-first: Firebase SDK CDN 등 정적 리소스
  if (CACHE_PATTERNS.some(p => p.test(url))) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // 3) 앱 셸(index.html, manifest, icons): Cache-first → Network fallback
  if (
    request.mode === 'navigate' ||
    PRECACHE_URLS.some(u => url.endsWith(u.replace('./', '')))
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          // 백그라운드에서 캐시 갱신 (Stale-While-Revalidate)
          fetch(request)
            .then(response => {
              if (response.ok) {
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(request, response));
              }
            })
            .catch(() => {/* 오프라인 시 무시 */});
          return cached;
        }
        // 캐시 없으면 네트워크
        return fetch(request).then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME)
              .then(cache => cache.put(request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }

  // 4) 나머지: Network-first → Cache fallback
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          caches.open(RUNTIME_CACHE)
            .then(cache => cache.put(request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

/* ── Message (버전 체크 등) ───────────────────────────────────────────────── */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
