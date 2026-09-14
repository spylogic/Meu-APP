// Cache só o "casco" do app (HTML/CSS/JS/ícones). Os dados dos projetos
// vêm sempre direto do Firebase — nunca ficam presos em cache do service
// worker (o cache dos últimos valores é feito à parte, via localStorage).

const CACHE_NAME = "meus-projetos-v1";
const ARQUIVOS_CASCO = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./config.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARQUIVOS_CASCO))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(
        chaves.filter((chave) => chave !== CACHE_NAME).map((chave) => caches.delete(chave))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);

  // Nunca interceptar chamadas ao Firebase (nem GET nem PUT) — sempre rede.
  if (url.hostname.endsWith("firebaseio.com")) {
    return;
  }

  // Casco do app: cache-first, com atualização em segundo plano.
  evento.respondWith(
    caches.match(evento.request).then((respostaCache) => {
      const buscaRede = fetch(evento.request)
        .then((respostaRede) => {
          if (respostaRede && respostaRede.ok) {
            const clone = respostaRede.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(evento.request, clone));
          }
          return respostaRede;
        })
        .catch(() => respostaCache);
      return respostaCache || buscaRede;
    })
  );
});
