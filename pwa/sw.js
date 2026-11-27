const scope=self.registration.scope;
const prefix='wartable:'+scope+':';
const release='0.1.95';
const cacheName=prefix+'shell-'+release;
const atlasRevision='d045665337249e6073797c2026edd27d40f1e96bf1998c86d982f435d4a7de5f';
// 0.1.55 already cached this exact atlas. Adopt its cache under the original
// name so an installed phone can update the menu without copying map tiles.
const previousAtlas='d045665337249e6073797c2026edd27d40f1e96bf1998c86d982f435d4a7de5f';
const previousCache=prefix+'main-menu-56';
const atlasName=atlasRevision===previousAtlas?previousCache:prefix+'atlas-'+atlasRevision;
const shell=['LICENSE.txt','index.html','menu.js','lan.js','lan-game.js','preferences.js','app.js','global-game.js','politics.js','occupation.js','neutral-rules.js','movement.js','assault.js','scramble.js','raids.js','noncombat.js','mobilize.js','income.js','rules.js','research.js','research-moves.js','victory.js','formation-names.js','front-layout.js','map.js','style.css','manifest.webmanifest'];
const assets=['wartable-mark.svg','staff-map.svg','staff-overview.webp','territories.json','fronts.json','control-washes.json','menu-staff-table.webp','global-setup.json','world-sectors.json','world-staff.webp','world-engraving.svg','world-terrain.json','sea-zones.json','icon-192.png','icon-512.png'];
const fresh=path=>new Request(new URL(path,scope),{cache:'reload'});

async function cacheAtlas(){
  const cache=await caches.open(atlasName);
  const layoutPath='assets/world-terrain.json';
  if(!await cache.match(layoutPath))await cache.add(fresh(layoutPath));
  const layout=await (await cache.match(layoutPath)).json();
  const paths=assets.map(name=>'assets/'+name);
  for(let row=0;row<layout.rows;row++)
    for(let col=0;col<layout.columns;col++)paths.push('assets/world-tiles/'+col+'-'+row+'.webp');
  const stored=new Set((await cache.keys()).map(request=>request.url));
  const missing=paths.filter(path=>!stored.has(new URL(path,scope).href));
  async function fill(){while(missing.length)await cache.add(fresh(missing.pop()));}
  await Promise.all(Array.from({length:4},fill));
}

// A release link can also bring installations predating the update button
// forward. Only that menu window opts in to navigating after activation.
async function releaseWindows(){
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  return clients.filter(client=>{
    const url=new URL(client.url);
    return url.origin+url.pathname===scope&&url.searchParams.get('update')===release&&!url.hash;
  });
}
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const upgradingOldMenu=release==='0.1.56'&&await caches.has(previousCache);
    const cache=await caches.open(cacheName);
    await cache.addAll(shell.map(fresh));
    await cacheAtlas();
    if(upgradingOldMenu||(await releaseWindows()).length)await self.skipWaiting();
  })());
});
self.addEventListener('message',event=>{
  if(event.data==='apply-update')event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const name of await caches.keys()){
      if(name.startsWith(prefix)&&name!==cacheName&&name!==atlasName)await caches.delete(name);
    }
    await self.clients.claim();
    // A controlled navigation can wait for activation to finish.
    // Start it here without making activation wait for that navigation.
    for(const client of await releaseWindows())client.navigate(scope).catch(()=>{});
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||!request.url.startsWith(scope))return;
  if(request.mode==='navigate'){
    event.respondWith(caches.open(cacheName).then(async cache=>await cache.match('index.html')||fetch(request)));
  }else{
    const name=request.url.startsWith(scope+'assets/')?atlasName:cacheName;
    event.respondWith(caches.open(name).then(async cache=>await cache.match(request)||fetch(request)));
  }
});
