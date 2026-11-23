const prefix='wartable:'+self.registration.scope+':';
const cacheName=prefix+'staff-survey-37';
const files=['./','./index.html','./menu.js','./app.js','./global-game.js','./neutral-rules.js','./rules.js','./formation-names.js','./map.js','./style.css','./manifest.webmanifest','./assets/wartable-mark.svg','./assets/staff-map.svg','./assets/staff-overview.webp','./assets/territories.json','./assets/fronts.json','./assets/control-washes.json','./assets/world-chart.webp','./assets/global-setup.json','./assets/world-sectors.json','./assets/world-staff.webp','./assets/world-engraving.svg','./assets/world-terrain.json','./assets/sea-zones.json','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(cacheName);
    await cache.addAll(files);
    const layout=await (await cache.match('./assets/world-terrain.json')).json();
    // Bound simultaneous requests on phones. A newly installed build is
    // ready for offline panning even in a previously unvisited theater.
    const sheets=[];
    for(let row=0;row<layout.rows;row++)
      for(let col=0;col<layout.columns;col++)sheets.push('./assets/world-tiles/'+col+'-'+row+'.webp');
    const worker=async()=>{while(sheets.length)await cache.add(sheets.pop());};
    await Promise.all(Array.from({length:4},worker));
  })());
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
