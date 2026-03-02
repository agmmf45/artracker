const CACHE = 'masari-v3';
const ASSETS = ['./index.html'];

self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e=>{
  // Network first for API calls, cache first for app shell
  if(e.request.url.includes('supabase.co')){
    return; // don't cache API calls
  }
  e.respondWith(
    caches.match(e.request).then(cached=>{
      return cached || fetch(e.request).then(res=>{
        if(res.ok){
          const clone = res.clone();
          caches.open(CACHE).then(cache=>cache.put(e.request, clone));
        }
        return res;
      });
    }).catch(()=> caches.match('./index.html'))
  );
});
