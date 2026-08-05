/* Cashbook service worker — network-first HTML shell, cache-first versioned assets */
var V='cb-6.5.0';
/* Multi-file app shell: styles.css/app.js are pre-cached with their exact ?v= URLs
   (index.html references them that way), so each cache version holds a complete,
   consistent build — users can never get a half-old half-new app. */
var ASSETS=['./','./index.html','./styles.css?v=6.5.0','./app.js?v=6.5.0','./manifest.webmanifest','./fonts/Archivo-var.woff2','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',function(e){
  e.waitUntil(caches.open(V).then(function(c){return c.addAll(ASSETS);}).then(function(){return self.skipWaiting();}));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k!==V;}).map(function(k){return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}));
});
function putIn(req,res){
  if(res&&res.status===200){var copy=res.clone();caches.open(V).then(function(c){c.put(req,copy);});}
  return res;
}
self.addEventListener('fetch',function(e){
  var req=e.request;
  if(req.method!=='GET')return;
  var url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  /* The HTML shell is NETWORK-FIRST. It used to be cache-first like everything else, and
     that produced a genuinely confusing failure: an old index.html would survive an update,
     and because it asks for styles.css?v=<old> — a URL the new cache does not contain — those
     requests fell through to the network and returned the CURRENT files. The app then ran new
     CSS and new JS inside stale markup: it looked updated, behaved updated, but any element
     added in the new markup simply did not exist. That is why the version stopped appearing
     in the APK while showing correctly in a browser.
     Fetching the shell first and falling back to cache keeps offline working while making it
     impossible to run a build against someone else's HTML. */
  var isShell=(req.mode==='navigate')||url.pathname==='/'||/\.html$/.test(url.pathname);
  if(isShell){
    e.respondWith(
      fetch(req).then(function(res){return putIn(req,res);}).catch(function(){
        return caches.open(V).then(function(c){
          return c.match(req).then(function(hit){return hit||c.match('./index.html')||caches.match('./index.html');});
        });
      })
    );
    return;
  }

  /* Everything else is cache-first, scoped to THIS build's cache so a leftover entry from an
     older version can never answer for the current one (caches.match with no cache name
     searches every cache in the origin, which is how stale assets used to leak through). */
  e.respondWith(
    caches.open(V).then(function(c){
      return c.match(req).then(function(hit){
        if(hit)return hit;
        return fetch(req).then(function(res){return putIn(req,res);});
      });
    })
  );
});
