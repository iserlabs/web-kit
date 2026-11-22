/**
 * The Day rail body and its bottom rail, as picked on body board round 2
 * (Jake, 2026-11-19: "C, Day rail", with the shared bottom rail). Rules are
 * carried verbatim from the board (docs/design/guest-guide-v2/body-board/
 * build/d3.mjs and rail.mjs in the Sun Mountain repo); only the board's own
 * screen hooks are left out. Every color and face comes from the brand's
 * custom properties; nothing here names a brand.
 *
 * The rail: Bodhicitta's running-foot PATTERN (a fixed bar naming the section,
 * a progress line on its top edge, Contents in a native modal dialog where one
 * tap jumps, Back and Next), in each guide's own paper, ink, accent, fields and
 * display serif. 44 px or larger targets, safe-area inset, the page end padded
 * clear of the bar, reduced motion jumps instantly. No dim and no soft shadow:
 * both lowered the contrast of the text they fall on (board gate, round 2).
 */

/** The day line and the printed sections (board d3.mjs, CSS then CSS2). */
export const DAY_CSS = `
.gg{font:400 16px/1.42 var(--text)}
.gg .c-wrap{max-width:640px;margin:0 auto;padding:18px 18px 8px}
.gg .c-rail{position:relative;list-style:none;margin:0;padding:0 0 0 34px}
.gg .c-rail::before{content:"";position:absolute;left:8px;top:10px;bottom:14px;width:4px;border-radius:2px;background:linear-gradient(to bottom,var(--f-arrival),var(--f-first) 30%,var(--f-house) 62%,var(--f-out))}
.gg .c-node{position:relative;margin:0 0 6px}
.gg .c-node:not(:first-child){margin-top:10px}
.gg .c-node::before{content:"";position:absolute;left:-34px;top:7px;width:20px;height:20px;border-radius:50%;background:var(--ink);box-shadow:0 0 0 4px var(--paper)}
.gg .c-ch{display:flex;align-items:baseline;gap:9px;margin:0;font:var(--head-w) 26px/1.15 var(--head);font-optical-sizing:auto}
.gg .c-ch .no{font:400 15px/1 var(--fig);font-variant-numeric:var(--fig-num);color:var(--accent-text)}
.gg .c-it{position:relative;margin:0 0 15px}
.gg .c-it::before{content:"";position:absolute;left:-31px;top:5px;width:14px;height:14px;border-radius:50%;background:var(--dot);border:2px solid var(--ink);box-shadow:0 0 0 4px var(--paper)}
.gg .c-k{display:block;margin:0 0 1px;font:var(--strong) 14.5px/1.3 var(--text);color:var(--accent-text)}
.gg .c-v{font:400 18px/1.33 var(--head);font-optical-sizing:auto;color:var(--ink);overflow-wrap:break-word}
.gg .c-v p{margin:0}
.gg .c-time{font-size:34px;line-height:1.05;font-variant-numeric:var(--fig-num)}
.gg .c-steps{list-style:none;margin:6px 0 0;padding:0;font:400 16px/1.4 var(--text)}
.gg .c-steps li{display:grid;grid-template-columns:32px minmax(0,1fr);margin:0 0 5px}
.gg .c-steps .n{font:400 22px/1.1 var(--fig);font-variant-numeric:var(--fig-num);color:var(--accent-text)}
.gg .c-steps .t b{font-weight:var(--strong)}
.gg .c-steps .media{grid-column:2;margin-top:6px}
.gg .c-steps video{width:100%;max-width:230px;height:auto;border-radius:10px;display:block}
.gg .c-fig{margin:9px 0 0}
.gg .c-fig img{width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;border-radius:10px}
.gg .c-rest{max-width:640px;margin:0 auto;padding:6px 18px 14px}
.gg .c-grp{margin:0 0 18px;padding-top:10px;border-top:4px solid var(--field)}
.gg .c-grp>h2{display:flex;align-items:baseline;gap:9px;margin:0 0 8px;font:var(--head-w) 24px/1.1 var(--head);font-optical-sizing:auto}
.gg .c-grp>h2 .no{font:400 15px/1 var(--fig);font-variant-numeric:var(--fig-num);color:var(--accent-text)}
.gg .c-r{margin:0 0 11px}
.gg .c-r>h3{display:block;margin:0;font:var(--strong) 14.5px/1.3 var(--text);color:var(--accent-text)}
.gg .c-r p{margin:0}
.gg .c-sub{margin:14px 0 6px;font:var(--strong) 15px/1.3 var(--text);color:var(--accent-text)}
.gg .c-p{margin:0 0 10px}
.gg .c-sheet{display:grid;grid-template-columns:1fr 1fr;gap:10px 8px;margin:4px 0 14px}
.gg .c-sheet.one{grid-template-columns:1fr}
.gg .c-sheet img{width:100%;height:auto;aspect-ratio:3/2;object-fit:cover;border-radius:8px}
.gg .c-sheet figcaption{padding-top:3px;font:400 14px/1.3 var(--text);color:var(--sec)}
.gg .c-tbl{width:100%;border-collapse:collapse;margin:0 0 4px}
.gg .c-tbl caption{text-align:left;padding:10px 0 3px;font:var(--strong) 14.5px/1.3 var(--text);color:var(--accent-text)}
.gg .c-tbl th,.gg .c-tbl td{text-align:left;vertical-align:baseline;padding:3px 0;font-weight:400;font-size:16px;line-height:1.35}
.gg .c-tbl td{text-align:right;white-space:nowrap;font-family:var(--fig);font-variant-numeric:var(--fig-num);font-size:18px}
.gg .c-tbl .note-cell{display:block;color:var(--sec);font:400 14.5px/1.3 var(--text)}
.gg .c-terms{margin:0 0 6px;color:var(--sec);font-size:15px;line-height:1.35}
.gg .c-pk{border-top:1px solid rgba(28,33,41,.14)}
.gg .c-pk:first-child{border-top:0}
.gg .c-pk>summary{display:flex;align-items:center;gap:9px;min-height:50px;padding:5px 0;list-style:none;cursor:pointer}
.gg .c-pk>summary::-webkit-details-marker{display:none}
.gg .c-pk>summary::before{content:"";flex:none;width:7px;height:7px;border-right:2px solid var(--ink);border-bottom:2px solid var(--ink);rotate:-45deg;transition:rotate .2s}
.gg .c-pk[open]>summary::before{rotate:45deg}
.gg .c-pk .nm{flex:1;min-width:0;font:var(--strong) 16px/1.25 var(--text)}
.gg .c-pk .mt{flex:none;color:var(--sec);font:400 14.5px/1.2 var(--text);text-align:right;max-width:44%}
.gg .c-pk .bd{padding:0 0 9px 16px}
.gg .c-pk .bd p{margin:0 0 4px}
.gg .c-pk .bd .hrs{color:var(--sec);font-size:15px;line-height:1.35}
.gg .c-pk .bd a{display:inline-flex;align-items:center;min-height:44px;font-weight:var(--strong)}
.gg .c-help{max-width:640px;margin:0 auto;padding:6px 18px 26px}
.gg .contact a[href^="sms:"]{display:inline-flex;align-items:center;min-height:44px}
.gg .c-help .contact{margin:0 0 6px;font:var(--strong) 17px/1.35 var(--text)}
.gg .c-help .call{margin:0 0 8px;min-height:56px}
.gg .c-help .colophon{margin-top:14px}
@media screen{.gg .c-help .qr{display:none}}
.gg .c-box{margin:0 0 10px}
.gg .c-box video{width:100%;max-width:230px;height:auto;border-radius:10px;display:block}
@media (min-width:700px){
  .gg .c-wrap,.gg .c-rest,.gg .c-help{padding-left:28px;padding-right:28px}
  .gg .c-wrap{padding-top:28px}
  .gg .c-sheet{grid-template-columns:repeat(4,1fr)}
  .gg .c-sheet.one{grid-template-columns:1fr}
}
@media (min-width:1000px){
  .gg .c-sheet{grid-template-columns:repeat(2,1fr)}
}
@media (prefers-reduced-motion:reduce){.gg *{transition:none !important}}

.gg .c-more{margin:0 0 12px}
.gg .c-vs{font:400 16px/1.42 var(--text)}
.gg .c-node{scroll-margin-top:8px}
.gg .c-help>h2{display:flex;align-items:baseline;gap:9px;margin:0 0 8px;padding-top:10px;border-top:4px solid var(--f-arrival);font:var(--head-w) 24px/1.1 var(--head);font-optical-sizing:auto}
.gg .c-help>h2 .no{font:400 15px/1 var(--fig);font-variant-numeric:var(--fig-num);color:var(--accent-text)}
`;

/** The bottom rail (board rail.mjs, RAIL_CSS with RAIL_H = 58). */
export const RAIL_CSS = `
.gg main{padding-bottom:calc(58px + env(safe-area-inset-bottom))}
html{scroll-padding-top:8px;scroll-padding-bottom:calc(70px + env(safe-area-inset-bottom))}
.gg .rl{position:fixed;left:0;right:0;bottom:0;z-index:20;padding-bottom:env(safe-area-inset-bottom);
  background:var(--paper);
  border-top:1px solid color-mix(in srgb,var(--ink) 22%,var(--paper));
  visibility:hidden;opacity:0;transform:translateY(110%)}
.gg .rl[data-on="true"]{visibility:visible;opacity:1;transform:none}
@media (prefers-reduced-motion:no-preference){.gg .rl{transition:transform .22s ease-out,opacity .22s ease-out,visibility .22s}}
.gg .rl-line{position:absolute;left:0;right:0;top:-1px;height:3px;background:color-mix(in srgb,var(--ink) 8%,transparent)}
.gg .rl-line i{display:block;height:100%;background:var(--accent);transform:scaleX(0);transform-origin:0 50%}
.gg .rl-in{display:flex;align-items:center;gap:6px;max-width:1120px;min-height:58px;margin:0 auto;
  padding:0 max(8px,env(safe-area-inset-right)) 0 max(10px,env(safe-area-inset-left))}
.gg .rl-where{display:flex;flex:1;align-items:center;gap:10px;min-width:0;min-height:48px;padding:0 4px 0 2px;border:0;background:none;
  color:var(--ink);font:inherit;text-align:left;cursor:pointer}
.gg .rl-n{flex:none;min-width:14px;font:400 17px/1 var(--fig);font-variant-numeric:var(--fig-num);color:var(--accent-text)}
.gg .rl-name{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font:var(--head-w) 20px/1.15 var(--head);font-optical-sizing:auto}
.gg .rl-open{flex:none;display:inline-flex;align-items:center;gap:8px;margin-left:auto;min-height:44px;padding:0 12px;
  background:var(--btn);color:var(--btn-ink);font:var(--strong) 15px/1 var(--text)}
.gg .rl-open svg{width:16px;height:12px}
.gg .rl-step{display:flex;flex:none}
.gg .rl-step button{display:grid;place-items:center;width:44px;height:48px;padding:0;border:0;background:none;color:var(--ink);cursor:pointer}
.gg .rl-step svg{width:11px;height:18px}
.gg .rl-step button[aria-disabled="true"]{color:color-mix(in srgb,var(--ink) 30%,transparent);cursor:default}
.gg .rl button:focus-visible{outline:3px solid var(--ink);outline-offset:-3px}
@media (hover:hover){.gg .rl-step button:not([aria-disabled="true"]):hover{background:color-mix(in srgb,var(--ink) 7%,transparent)}.gg .rl-where:hover .rl-open{filter:brightness(.96)}}
@media (max-width:359px){.gg .rl-open .w{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.gg .rl-open{padding:0 14px}}

.gg .rl-sheet{box-sizing:border-box;width:min(560px,100% - 24px);max-width:none;max-height:calc(100dvh - 96px);
  margin:auto auto calc(66px + env(safe-area-inset-bottom));padding:6px 0 10px;overflow:auto;overscroll-behavior:contain;
  border:0;border-top:2px solid var(--ink);background:var(--paper);color:var(--ink);
  box-shadow:none}
.gg .rl-sheet:focus{outline:none}
/* No dimming and no soft shadows: a dim or a shadow lowers the contrast of the text it falls on. The ink rule on top
   sets the panel off the page; a tap anywhere outside it still closes it (light dismiss). */
.gg .rl-sheet::backdrop{overflow:hidden;overscroll-behavior:contain;background:transparent}
.gg .rl-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 6px 0 18px}
.gg .rl-title{margin:0;font:var(--strong) 15px/1.2 var(--text);color:var(--sec)}
.gg .rl-x{display:grid;place-items:center;width:48px;height:48px;padding:0;border:0;background:none;color:var(--ink);cursor:pointer}
.gg .rl-x svg{width:16px;height:16px}
.gg .rl-list{list-style:none;margin:0;padding:0}
.gg .rl-list a{display:flex;align-items:center;gap:12px;min-height:52px;padding:4px 18px;border-top:1px solid color-mix(in srgb,var(--ink) 11%,transparent);
  color:var(--ink);text-decoration:none}
.gg .rl-sw{flex:none;width:12px;height:30px;background:var(--sw)}
.gg .rl-list .n{flex:none;width:18px;font:400 17px/1 var(--fig);font-variant-numeric:var(--fig-num);color:var(--accent-text)}
.gg .rl-list .t{font:var(--head-w) 21px/1.2 var(--head);font-optical-sizing:auto}
.gg .rl-list a[aria-current]{background:color-mix(in srgb,var(--sw) 55%,var(--paper))}
.gg .rl-list a[aria-current] .t{font-weight:600}
.gg .rl-list a:focus-visible,.gg .rl-x:focus-visible{outline:3px solid var(--ink);outline-offset:-3px}
@media (max-width:599px){.gg .rl-sheet{width:100%;border-inline:0}}
@media print{.gg .rl,.gg .rl-sheet{display:none !important}}
[data-rl-target]:focus{outline:none}
`;

/**
 * The rail's script: plain, no framework. Positions are read once per
 * animation frame; only the progress line's transform and, when it changes,
 * the shown section are written. A jump is a real #anchor link, so the
 * Contents list works with scripting off.
 */
export const RAIL_JS = `(function(){
var nav=document.querySelector('.rl');if(!nav)return;
var dlg=document.getElementById('rl-sheet'),line=nav.querySelector('.rl-line i'),nm=nav.querySelector('.rl-name'),no=nav.querySelector('.rl-n');
var prev=nav.querySelector('.rl-prev'),nextB=nav.querySelector('.rl-next');
var links=[].slice.call(dlg.querySelectorAll('a[data-stop]'));
var stops=links.map(function(a){var el=document.getElementById(a.dataset.stop);if(el){el.setAttribute('tabindex','-1');el.setAttribute('data-rl-target','');}return{id:a.dataset.stop,el:el,name:a.querySelector('.t').textContent,n:a.querySelector('.n').textContent};}).filter(function(s){return s.el;});
var cover=document.querySelector('.gg .cover'),main=document.getElementById('main');
var cur=-1,frame=0,last=null;
function rm(){return matchMedia('(prefers-reduced-motion: reduce)').matches;}
function setCur(i){if(i===cur)return;cur=i;var s=stops[i];nm.textContent=s.name;no.textContent=s.n;
 prev.setAttribute('aria-disabled',i<=0?'true':'false');nextB.setAttribute('aria-disabled',i>=stops.length-1?'true':'false');}
function measure(){frame=0;var vh=innerHeight,y=scrollY,max=document.documentElement.scrollHeight-vh;
 line.style.transform='scaleX('+(max>0?Math.min(1,Math.max(0,y/max)):0)+')';
 var on=!cover||main.getBoundingClientRect().top<=vh*0.55;
 if(String(on)!==nav.dataset.on){nav.dataset.on=String(on);if(on)nav.removeAttribute('inert');else nav.setAttribute('inert','');}
 var mark=vh*0.32,i=0;for(var k=0;k<stops.length;k++){if(stops[k].el.getBoundingClientRect().top<=mark)i=k;}
 if(y>=max-2)i=stops.length-1;setCur(i);}
function sched(){if(!frame)frame=requestAnimationFrame(measure);}
function go(i){var s=stops[i];if(!s)return;last={i:i,at:performance.now()};
 s.el.scrollIntoView({block:'start',behavior:rm()?'instant':'smooth'});s.el.focus({preventScroll:true});
 history.replaceState(history.state,'','#'+s.id);setCur(i);}
function step(d){var from=last&&performance.now()-last.at<900?last.i:cur;var to=from+d;if(to<0||to>=stops.length)return;go(to);}
prev.addEventListener('click',function(){step(-1);});nextB.addEventListener('click',function(){step(1);});
nav.querySelector('.rl-where').addEventListener('click',function(){links.forEach(function(a,i){if(stops[cur]&&a.dataset.stop===stops[cur].id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
 dlg.showModal();dlg.focus();var c=dlg.querySelector('a[aria-current]');if(c)c.scrollIntoView({block:'nearest'});});
dlg.querySelector('.rl-x').addEventListener('click',function(){dlg.close();});
dlg.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-stop]');
 if(a){e.preventDefault();dlg.close();var i=stops.findIndex(function(s){return s.id===a.dataset.stop;});go(i);return;}
 if(!('closedBy' in HTMLDialogElement.prototype)&&e.target===dlg){var r=dlg.getBoundingClientRect();
  if(e.clientY<r.top||e.clientY>r.bottom||e.clientX<r.left||e.clientX>r.right)dlg.close();}});
addEventListener('scroll',sched,{passive:true});addEventListener('resize',sched);
measure();
})();`;
