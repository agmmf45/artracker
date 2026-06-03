// v4 - force clear all old caches
const CACHE = 'artrk-v4';

self.addEventListener('install', e=>{
  self.skipWaiting();
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>
      Promise.all(keys.map(k=>caches.delete(k)))
    ).then(()=>self.clients.claim())
  );
});

// Network only - no caching
self.addEventListener('fetch', e=>{
  if(e.request.url.includes('supabase.co')) return;
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
