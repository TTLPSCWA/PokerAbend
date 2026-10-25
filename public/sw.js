// Service Worker nur, damit Handys die Seite als App installieren – er speichert nichts zwischen.
// Ohne Netz geht es nicht (gewollt: gespielt wird immer live mit dem Server).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
// Leerer Abruf-Handler: alles geht ganz normal ans Netz
self.addEventListener('fetch', () => {});
