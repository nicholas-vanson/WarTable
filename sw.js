const prefix='wartable:'+self.registration.scope+':';
const cacheName=prefix+'world-staff-23';
const files=['./','./index.html','./menu.js','./app.js','./global-game.js','./rules.js','./formation-names.js','./map.js','./style.css','./manifest.webmanifest','./assets/staff-map.svg','./assets/staff-overview.webp','./assets/territories.json','./assets/fronts.json','./assets/world-chart.webp','./assets/global-setup.json','./assets/world-sectors.json','./assets/world-staff.webp','./assets/world-engraving.svg','./assets/sea-zones.json','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(files)));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const name of await caches.keys())if(name.startsWith(prefix)&&name!==cacheName)await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||!event.request.url.startsWith(self.registration.scope))return;
  event.respondWith((async()=>{
    const cache=await caches.open(cacheName);
    if(event.request.mode==='navigate')return await cache.match(new URL('./index.html',self.registration.scope))||fetch(event.request);
    return await cache.match(event.request)||fetch(event.request);
  })());
});
