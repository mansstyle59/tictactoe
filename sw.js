// ClubManager — service worker (appli installable + hors connexion)
const V = 'cm-v2';
const SHELL = ['./', './index.html', './styles.css', './js/core.js','./js/app.js','./js/views.js','./js/views2.js',
  './vendor/supabase.js', './manifest.webmanifest', './icons/logo.svg', './icons/icon-192.png', './icons/icon-512.png', './favicon.svg'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL))); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // données Supabase : toujours en direct
  // réseau d'abord (toujours la dernière version), cache en secours hors connexion
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(V).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const link = e.notification.data?.link || '#/';
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => {
    const c = cs[0];
    if (c) { c.focus(); return c.navigate(new URL('./' + link, self.registration.scope).href); }
    return self.clients.openWindow('./' + link);
  }));
});

self.addEventListener('message', (e) => { if (e.data === 'skip') self.skipWaiting(); });
