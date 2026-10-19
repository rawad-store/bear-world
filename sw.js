const V='bear-world-v31';
const CORE=['./','./index.html','./manifest.json','./bear.png','./icon-192.png','./icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(V).then(c=>Promise.all(CORE.map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(r.mode==='navigate'){
    e.respondWith(fetch(r).then(x=>{
      const c=x.clone();caches.open(V).then(h=>h.put('./index.html',c));return x;
    }).catch(()=>caches.match('./index.html').then(x=>x||caches.match('./'))));
    return;
  }
  const font=u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com';
  if(u.origin!==location.origin&&!font)return;
  e.respondWith(caches.match(r).then(hit=>{
    const net=fetch(r).then(x=>{
      if(x&&(x.ok||x.type==='opaque')){const c=x.clone();caches.open(V).then(h=>h.put(r,c))}
      return x;
    }).catch(()=>hit);
    return hit||net;
  }));
});
