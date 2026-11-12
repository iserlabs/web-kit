/**
 * The guide's only script, inlined so it runs offline from the HTML alone.
 * Two jobs: the Copy button, and asking the service worker to save this page.
 * It adds no content except the "saved" line, whose space is reserved.
 *
 * Copy: the visible label is the button's name; "Copied" shows for 2 s and a
 * polite live region speaks. A blocked clipboard is never silent: the button
 * shows the password itself, selected for a long-press copy (the v1 rule).
 *
 * Save: after load, on idle, never with Save-Data on. The page posts exactly
 * the URL list the plan made; the worker caches those and answers, and only
 * then does the saved line show.
 */
export const BEHAVIOR_JS = String.raw`(function(){
var d=document,root=d.querySelector('.gg');if(!root)return;
var ds=root.dataset,status=d.getElementById('gg-status'),last='',timers=new WeakMap();
function say(m){if(!status)return;if(m===last)m+=' ';last=m;status.textContent='';requestAnimationFrame(function(){status.textContent=m;});}
function legacy(t){var f=d.createElement('textarea');f.value=t;f.setAttribute('readonly','');f.style.cssText='position:fixed;top:0;opacity:0';d.body.appendChild(f);f.select();f.setSelectionRange(0,t.length);var ok=false;try{ok=d.execCommand('copy');}catch(e){}f.remove();return ok;}
function report(b,ok,t){var label=b.getAttribute('data-label')||b.textContent;clearTimeout(timers.get(b));
if(ok){b.textContent=ds.copied||'Copied';b.setAttribute('data-done','');say(ds.saidCopied||'');
timers.set(b,setTimeout(function(){b.textContent=label;b.removeAttribute('data-done');},2000));}
else{b.textContent=t;var r=d.createRange();r.selectNodeContents(b);var s=getSelection();if(s){s.removeAllRanges();s.addRange(r);}say((ds.saidBlocked||'').replace('{password}',t));}}
d.addEventListener('click',function(e){var b=e.target&&e.target.closest?e.target.closest('[data-copy]'):null;if(!b)return;var t=b.getAttribute('data-copy')||'';if(!t)return;
if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(t).then(function(){report(b,true,t);},function(){report(b,legacy(t),t);});}else{report(b,legacy(t),t);}});
var sw=ds.sw;if(!sw||!('serviceWorker' in navigator)||!('caches' in window))return;
if(navigator.connection&&navigator.connection.saveData)return;
var page=ds.page||location.pathname,urls=[];try{urls=JSON.parse(ds.offline||'[]');}catch(e){console.warn('guide: offline list unreadable',e);return;}
navigator.serviceWorker.addEventListener('message',function(e){var m=e.data;if(m&&m.type==='guide-saved'&&m.page===page){var s=d.querySelector('[data-saved]');if(s)s.setAttribute('data-on','');}});
function save(){navigator.serviceWorker.register(sw,{scope:ds.swScope||'./'}).then(function(){return navigator.serviceWorker.ready;}).then(function(reg){if(reg.active)reg.active.postMessage({type:'save-guide',page:page,urls:urls});}).catch(function(e){console.warn('guide: offline save unavailable',e&&e.message);});}
function idle(){(window.requestIdleCallback||function(f){setTimeout(f,200);})(save);}
if(d.readyState==='complete')idle();else window.addEventListener('load',idle,{once:true});
})();`;
