// Munchkin 3D Companion: guarda todos os arquivos no aparelho para jogar sem internet.
// Ao publicar uma versão nova do app, troque o número abaixo para os aparelhos baixarem a atualização.
const CACHE = 'munchkin-v14';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'fonts/fonts.css',
  'fonts/cinzel-latin-1.woff2',
  'fonts/cinzel-latin-ext-0.woff2',
  'fonts/fredoka-latin-3.woff2',
  'fonts/fredoka-latin-ext-2.woff2',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  // cache:'reload' pula o cache do navegador: guarda a versão nova de verdade, não uma cópia velha
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// A página do app: tenta a internet primeiro (pega a versão nova na hora) e usa a cópia guardada
// se estiver sem internet ou se a rede demorar mais de 3 segundos.
// O resto (fontes, ícones): primeiro o que está guardado; se faltar, busca na rede e guarda.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(new Promise(resolve => {
      let done = false;
      const fallback = () => caches.match('index.html').then(hit => { if (!done && hit) { done = true; resolve(hit); } });
      const timer = setTimeout(fallback, 3000);
      fetch(req, { cache: 'no-store' }).then(res => {
        clearTimeout(timer);
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); }
        if (!done) { done = true; resolve(res); }
      }).catch(() => { clearTimeout(timer); fallback().then(() => { if (!done) { done = true; resolve(Response.error()); } }); });
    }));
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => Response.error()))
  );
});
