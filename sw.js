'use strict';
const CACHE='asean-empire-v1.1-20261124-2';
const ASSETS=['./','./index.html','./styles.css','./app.js','./leaderboard.js','./config.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('asean-empire-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 // Never cache a leaderboard response or intercept external API calls.
 if(event.request.method!=='GET'||url.origin!==self.location.origin||!ASSETS.some(path=>new URL(path,self.registration.scope).href===url.href))return;
 event.respondWith(fetch(event.request).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)))}
  return response;
 }).catch(()=>caches.match(event.request).then(cached=>cached||Response.error())));
});
