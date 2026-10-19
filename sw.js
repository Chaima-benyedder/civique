// =====================================================
//  Service worker : fait marcher l'app sans connexion
// =====================================================

// Change ce numéro à chaque fois que tu ajoutes ou renommes un fichier de la liste
const VERSION = "civique-v1";

// Les fichiers à garder sur le téléphone
// ATTENTION : si un seul de ces fichiers n'existe pas sur GitHub, l'installation échoue
const FICHIERS = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "questions.json",
  "questions-2.json",
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png"
];

// 1. Installation : on télécharge et on range tous les fichiers
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(VERSION).then(cache => cache.addAll(FICHIERS))
  );
  self.skipWaiting(); // la nouvelle version prend la place de l'ancienne tout de suite
});

// 2. Activation : on supprime les anciennes versions du cache
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(noms => Promise.all(
        noms.filter(nom => nom !== VERSION).map(nom => caches.delete(nom))
      ))
      .then(() => self.clients.claim())
  );
});

// 3. À chaque requête : internet d'abord (pour avoir la dernière version),
//    et si on est hors-ligne, on prend la copie rangée dans le cache
self.addEventListener("fetch", event => {
  const requete = event.request;

  // On ne s'occupe que des fichiers de notre propre site
  if (requete.method !== "GET" || new URL(requete.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(requete.url, { cache: "no-cache" })
      .then(reponse => {
        if (reponse.ok) {
          const copie = reponse.clone(); // une réponse ne peut être lue qu'une fois : on en garde une copie
          caches.open(VERSION).then(cache => cache.put(requete, copie));
        }
        return reponse;
      })
      .catch(() => caches.match(requete)) // hors-ligne : on sert le cache
  );
});
