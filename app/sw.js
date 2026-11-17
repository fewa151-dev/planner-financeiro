/* Service worker do Planner Financeiro: guarda o app no aparelho para abrir rápido e funcionar sem internet.
   - Página (index.html): busca a versão nova primeiro; sem internet, usa a guardada.
   - Ícones e manifesto: usa o guardado e atualiza em segundo plano.
   - Fontes do Google: guardadas na primeira vez.
   - Cotações, juros e Google Drive: sempre direto da internet (nunca guardados aqui). */
const VERSAO = 'planner-v1';
const BASE = ['./', './index.html', './manifest.webmanifest', './icons/icone.svg',
              './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const fontes = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !fontes) return;        // cotações, BCB, Google: direto da rede
  if (url.pathname.includes('/api/')) return;                         // servidor local de cotações

  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VERSAO).then(x => x.put(req, c)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  if (fontes) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const c = res.clone(); caches.open(VERSAO).then(x => x.put(req, c)); return res; })));
    return;
  }
  e.respondWith(caches.match(req).then(guardado => {
    const rede = fetch(req).then(res => { if (res.ok) { const c = res.clone(); caches.open(VERSAO).then(x => x.put(req, c)); } return res; }).catch(() => guardado);
    return guardado || rede;
  }));
});
