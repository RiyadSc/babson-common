const CACHE='common-shell-v1';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/offline','/icon-192.png'])));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
// Never cache authenticated pages, student data, API responses, or mutations.
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate'&&event.request.method==='GET')event.respondWith(fetch(event.request).catch(()=>caches.match('/offline')))});
