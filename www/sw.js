/* Cashbook service worker — cache-first offline shell */
var V='cb-6.0.0';
/* Multi-file app shell: styles.css/app.js are pre-cached with their exact ?v= URLs
   (index.html references them that way), so each cache version holds a complete,
   consistent build — users can never get a half-old half-new app. */
var ASSETS=['./','./index.html','./styles.css?v=6.0.0','./app.js?v=6.0.0','./manifest.webmanifest','./fonts/Archivo-var.woff2','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',function(e){
  e.waitUntil(caches.open(V).then(function(c){return c.addAll(ASSETS);}).then(function(){return self.skipWaiting();}));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k!==V;}).map(function(k){return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}));
});
self.addEventListener('fetch',function(e){
  var req=e.request;
  if(req.method!=='GET')return;
  var url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  e.respondWith(
    caches.match(req).then(function(hit){
      if(hit)return hit;
      return fetch(req).then(function(res){
        if(res&&res.status===200){
          var copy=res.clone();
          caches.open(V).then(function(c){c.put(req,copy);});
        }
        return res;
      }).catch(function(){
        if(req.mode==='navigate')return caches.match('./index.html');
      });
    })
  );
});
