/**
 * The Alpenglow stylesheet, one string inlined in a <style> tag so the guide
 * needs no extra request and works offline from the HTML alone (the
 * owner-portal pattern). Every color and face comes from the brand's custom
 * properties (`brandCss`); nothing here names a brand.
 *
 * Rules carried from the approved board (d2-s1, d2-s2, d2-s3), with the build
 * corrections: the field shift animates opacity on a decorative layer, never
 * background-color on the section; nothing under 15 px but the wordmark.
 */
export const ALPENGLOW_CSS = String.raw`
.gg{--ease:cubic-bezier(0.25,1,0.5,1);--gut:24px;color-scheme:light only;background:var(--paper);color:var(--ink);font:var(--text-w) 18px/1.6 var(--text);-webkit-text-size-adjust:100%;text-size-adjust:100%}
.gg *,.gg *::before,.gg *::after{box-sizing:border-box}
.gg img{display:block;max-width:100%}
.gg a{color:inherit;text-underline-offset:0.18em;text-decoration-thickness:1px}
.gg :focus-visible{outline:3px solid var(--ink);outline-offset:3px}
.gg h1,.gg h2,.gg h3,.gg p,.gg ol,.gg ul,.gg dl,.gg dd,.gg figure{margin:0}
.gg .vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
.gg .skip{position:absolute;left:12px;top:-80px;z-index:10;background:var(--paper);color:var(--ink);padding:12px 16px;min-height:44px;display:inline-flex;align-items:center}
.gg .skip:focus{top:12px}
.gg .fig{font-family:var(--fig);font-weight:var(--fig-w);font-variant-numeric:tabular-nums}

/* Cover: the photograph is the page */
.gg .cover{position:relative;isolation:isolate;overflow:hidden;min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;justify-content:space-between;gap:32px}
.gg .cover__photo,.gg .cover__photo img{position:absolute;inset:0;width:100%;height:100%;z-index:-2}
.gg .cover__photo img{object-fit:cover;object-position:var(--focus,50% 50%)}
.gg .cover__shade{position:absolute;inset:0;z-index:-1;pointer-events:none;background:var(--shade,none)}
.gg .cover__sky{padding:18px var(--gut) 0;color:var(--ink)}
.gg .cover--low .cover__ground{background:var(--ground-shade,none);padding-top:96px;margin-top:-96px}
.gg .cover[data-name-ink=onPhoto] .cover__sky{color:var(--on-photo)}
.gg .brand{display:flex;align-items:center;gap:10px;font:var(--wordmark-w) 13px/1 var(--wordmark);letter-spacing:0.06em}
.gg .brand img{width:28px;height:28px}
.gg .brand--display{font:var(--display-w) 17px/1.2 var(--display);letter-spacing:0}
.gg .lockup{width:auto;height:40px}
.gg .notice{margin-top:14px;font:var(--strong) 16px/1.4 var(--text)}
.gg .notice:empty{display:none}
.gg .cover__name{--k:1;margin:22px 0 0;font-family:var(--display);font-weight:var(--display-w);font-optical-sizing:auto;font-size:min(calc(var(--name) * var(--k) * 1px),calc(var(--name) * var(--k) * 0.2564vw));line-height:0.95;letter-spacing:-0.015em;text-wrap:balance}
.gg .cover__name span{display:block}
.gg .cover__ground{padding:0 var(--gut) max(14px,env(safe-area-inset-bottom));color:var(--on-photo)}
.gg .cover[data-facts-ink=ink] .cover__ground{color:var(--ink)}
.gg .cover[data-facts-ink=onPhoto] .cover__ground,.gg .cover[data-name-ink=onPhoto] .cover__name{text-shadow:0 1px 2px rgba(0,0,0,0.6),0 0 6px rgba(0,0,0,0.45),0 0 16px rgba(0,0,0,0.3)}
.gg .cover__addr{font:var(--strong) 17px/1.3 var(--text);max-width:22em}
.gg .cover__link{display:inline-flex;align-items:center;min-height:44px;min-width:44px;font:var(--text-w) 16px/1.2 var(--text)}
.gg .tt{margin:2px 0 0;display:grid;grid-template-columns:minmax(0,1fr);row-gap:10px}
.gg .tt__row{display:grid;grid-template-columns:var(--lab,60px) minmax(0,1fr);align-items:baseline}
.gg .tt dt{font:var(--strong) 15px/1.35 var(--text)}
.gg .tt dd{font:var(--text-w) 16px/1.38 var(--text);min-width:0}
.gg .tt__times{container-type:inline-size;display:flex;flex-wrap:wrap;align-items:baseline;column-gap:18px;row-gap:2px}
.gg .tt__times .fig{font-size:min(24px,calc((100cqi - 26px - var(--out-ch,3) * 9px) / 9));line-height:1.1;font-weight:var(--fig-w)}
.gg .tt__times .lbl{font:var(--strong) 15px/1 var(--text);margin-right:8px}
.gg .wifi{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 10px}
.gg .wifi__vals{font:400 15px/1.4 var(--fig);overflow-wrap:anywhere;min-width:0}
.gg .copy{flex:none;min-height:44px;min-width:44px;padding:0 12px;border:0;border-radius:0;background:var(--btn);color:var(--btn-ink);font:var(--strong) 15px/1 var(--text);text-shadow:none;cursor:pointer;transition:background-color 300ms var(--ease),color 300ms var(--ease)}
.gg .copy[data-done]{background:var(--btn-done);color:var(--btn-done-ink)}
.gg .cover .copy:focus-visible{outline:3px solid var(--paper);outline-offset:2px;box-shadow:0 0 0 5px var(--ink)}
.gg .cover--high{justify-content:flex-start}
.gg .cover--high .cover__name{--k:0.5;line-height:1.05;margin-top:10px;letter-spacing:-0.01em}
.gg .cover--high .tt{margin-top:10px;row-gap:4px}
.gg .cover--high .tt dd{font-size:15px;line-height:1.36}
.gg .cover--high .tt__times .fig{font-size:20px}
.gg .cover--high .cover__addr{margin-top:6px}
.gg .cover__addr .cover__link{font-weight:var(--text-w)}
.gg .cover__go{display:flex;flex-wrap:wrap;column-gap:24px;width:fit-content}
.gg .cover--high .cover__go{display:inline-flex;margin-left:6px}
.gg .cover--type{background:var(--f-arrival);justify-content:space-between}
.gg .cover--type .cover__name{--k:1;font-weight:var(--display-w)}
.gg .type-title{margin-top:18px;font:var(--display-w) 30px/1.15 var(--display);font-optical-sizing:auto}
.gg .type-title span{display:block}
.gg .type-feature{margin-top:12px;font:var(--text-w) 17px/1.4 var(--text);color:var(--sec)}
.gg .cover--type .cover__ground{color:var(--ink)}
/* Band: the photo shows between the name and the facts, which sit on the arrival field (the fallback for a cover whose zone fails) */
.gg .cover--band .cover__ground{background:var(--f-arrival);color:var(--ink);padding-top:18px;text-shadow:none}
.gg .cover--band .copy{outline:2px solid var(--ink);outline-offset:0}
.gg .cover--band .copy:focus-visible{outline:3px solid var(--ink);outline-offset:3px;box-shadow:none}

/* Quick find: a typographic index on the arrival field */
.gg .find{background:var(--f-arrival);padding:56px var(--gut) 72px}
.gg .find__h{font:var(--head-w) 30px/1.15 var(--head);font-optical-sizing:auto}
.gg .find__list{list-style:none;margin:28px 0 0;padding:0;display:grid;row-gap:24px}
.gg .find__item{display:grid;grid-template-columns:44px minmax(0,1fr)}
.gg .find__n{font:400 15px/1 var(--fig);color:var(--accent-text);padding-top:9px}
.gg .find__q{font:var(--head-w) 22px/1.25 var(--head);font-optical-sizing:auto}
.gg .find__q a{display:inline-flex;align-items:center;min-height:44px;min-width:44px;text-decoration-thickness:1px}
.gg .find__a{margin-top:2px;font:var(--text-w) 16px/1.45 var(--text);color:var(--sec)}
.gg .find__wifi{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin-top:4px}
.gg .find__wifi .find__a{margin:0;overflow-wrap:anywhere;min-width:0}
.gg .find__wifi .fig{font-size:15px;color:var(--ink)}
.gg .find__wifi .copy{outline:2px solid var(--ink);outline-offset:0}
.gg .find__wifi .copy:focus-visible{outline-width:3px;outline-offset:3px}

/* Chapters: a plate, then one loud thing per screen */
.gg .chapter{position:relative;isolation:isolate;background:var(--field)}
.gg .chapter::before{content:"";position:absolute;inset:0;z-index:-1;background:var(--prev);opacity:0;pointer-events:none}
.gg .plate img{width:100%;height:auto;aspect-ratio:4/5;object-fit:cover}
.gg .dip{display:grid;grid-template-columns:1fr 1fr;gap:2px}
.gg .dip img{width:100%;height:auto;aspect-ratio:3/4;object-fit:cover}
.gg .dip figcaption,.gg .room figcaption{padding:10px 12px 0 var(--gut);font:var(--text-w) 15px/1.4 var(--text);color:var(--sec)}
.gg .dip figure+figure figcaption{padding:10px var(--gut) 0 12px}
.gg .chap{padding:40px var(--gut) 80px}
.gg .chap>*{max-width:34rem}
.gg .chap__label{display:flex;align-items:baseline;gap:10px;margin:0 0 12px;font:var(--strong) 15px/1.3 var(--text);color:var(--accent-text)}
.gg .chap__label .fig{font-weight:400}
.gg .q{margin:0 0 20px;font:var(--head-w) 30px/1.15 var(--head);font-optical-sizing:auto;text-wrap:balance}
.gg .chap p,.gg .help p{margin:0 0 18px}
.gg .sub{margin:48px 0 12px;font:var(--strong) 17px/1.35 var(--text)}
.gg .big{margin:4px 0 14px;font:var(--fig-large) 64px/1 var(--fig);letter-spacing:-0.02em;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.gg .steps{list-style:none;margin:8px 0 18px;padding:0}
.gg .steps li{display:grid;grid-template-columns:48px minmax(0,1fr);margin:0 0 18px}
.gg .steps .n{font:var(--fig-large) 36px/1 var(--fig);color:var(--accent)}
.gg .steps .t{padding-top:5px;line-height:1.5;min-width:0}
.gg .steps .t b,.gg .fact__label{display:block;font:var(--strong) 15px/1.3 var(--text)}
.gg .where,.gg .until{display:block;color:var(--sec);font-size:16px}
.gg .note{margin-top:48px}
.gg .note__label{display:block;margin:0 0 6px;font:var(--strong) 15px/1.3 var(--text);color:var(--accent-text)}
.gg .unknown,.gg .sec{color:var(--sec);font-size:16px}
.gg .fact{margin:0 0 22px}
.gg .fact__label{margin-bottom:2px}
.gg .display{margin:0 0 24px}
.gg .display .big{margin:2px 0 0}
.gg .room{margin:12px 0 24px}
.gg .room--two{display:grid;grid-template-columns:1fr 1fr;gap:2px}
.gg .room img{width:100%;height:auto;aspect-ratio:3/4;object-fit:cover}
.gg .video{margin:12px 0 24px}
.gg .video video{display:block;width:auto;height:auto;max-width:100%;max-height:72vh;background:var(--paper)}
.gg .steps .media{grid-column:2;min-width:0}
.gg .room figcaption{padding:8px 0 0}
.gg .wifi-block{margin-top:48px}
.gg .wifi-block .wifi{justify-content:flex-start;margin:0 0 18px}
.gg .wifi-block .wifi__vals{font-size:16px}
.gg .wifi-block .copy{outline:2px solid var(--ink);outline-offset:0}
.gg .price{width:100%;border-collapse:collapse;margin:0 0 12px}
.gg .price caption{text-align:left;font:var(--strong) 17px/1.35 var(--text);margin:40px 0 10px}
.gg .price th,.gg .price td{text-align:left;vertical-align:baseline;padding:6px 16px 6px 0;font-weight:var(--text-w)}
.gg .price td{font-family:var(--fig);font-size:16px;white-space:nowrap}
.gg .price .note-cell{display:block;color:var(--sec);font-size:16px;font-family:var(--text)}
.gg .terms{color:var(--sec);font-size:16px}
.gg .picks{list-style:none;padding:0;margin:0 0 12px}
.gg .picks li{margin:0 0 22px}
.gg .row-link{margin:0 0 6px}
.gg .row-link a{display:inline-flex;align-items:center;min-height:44px;min-width:44px;font-weight:var(--strong)}
.gg .picks a{display:inline-flex;align-items:center;min-height:44px;min-width:44px;font-weight:var(--strong)}
.gg .picks span{display:block;color:var(--sec);font-size:16px}
.gg .picks .pick-note{color:var(--ink);font-size:18px}

/* Help and colophon on paper */
.gg .help{position:relative;isolation:isolate;background:var(--paper);padding:56px var(--gut) 64px}
.gg .help::before{content:"";position:absolute;inset:0;z-index:-1;background:var(--prev);opacity:0;pointer-events:none}
.gg .help>*{max-width:34rem}
.gg .help .q{margin-bottom:12px}
.gg .contact{font-weight:var(--strong)}
.gg .reach a{display:inline-flex;align-items:center;min-height:44px;min-width:44px;margin-right:18px}
.gg .call{display:inline-flex;align-items:baseline;gap:14px;min-height:64px;min-width:44px;text-decoration:none;margin:4px 0 8px}
.gg .call .big{margin:0;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:0.12em}
.gg .call .t{font:var(--strong) 17px/1.3 var(--text)}
.gg .colophon{margin-top:56px;display:grid;gap:6px;font:var(--text-w) 15px/1.45 var(--text);color:var(--sec)}
.gg .colophon .brand{color:var(--ink);margin-bottom:6px}
.gg .colophon .brand img{width:24px;height:24px}
.gg .colophon .lockup{width:auto;height:44px}
.gg .saved{min-height:1.45em;visibility:hidden}
.gg .saved[data-on]{visibility:visible}
.gg .qr{display:none}

/* The light of the stay: each chapter's field shows through as the one before it fades */
@supports ((animation-timeline: view()) and (animation-range: 0% 100%)){
  @media (prefers-reduced-motion: no-preference){
    .gg .chapter::before,.gg .help::before{opacity:1;animation:gg-field linear both;animation-timeline:view();animation-range:entry 45% contain 360px}
    @keyframes gg-field{from{opacity:1}to{opacity:0}}
  }
}
@media (prefers-reduced-motion: reduce){
  .gg *,.gg *::before,.gg *::after{transition:none !important;animation:none !important}
}

/* Tablet and up */
@media (min-width: 700px){
  .gg{--gut:40px}
  .gg .tt{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:40px;max-width:900px}
  .gg .find__list{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:56px;row-gap:28px}
  .gg .dip figcaption,.gg .dip figure+figure figcaption{padding:10px 0 0}
  .gg .cover__photo img{object-position:var(--focus-wide,var(--focus,50% 50%))}
  .gg .cover--high .cover__name{font-size:calc(var(--name) * 0.8px)}
  .gg .cover--high .lockup{height:64px}
  .gg .cover--high .tt{row-gap:10px}
}

/* Desktop: the plate holds the left half while the chapter reads on the right */
@media (min-width: 1000px){
  .gg{--gut:64px}
  .gg .cover__sky{padding-top:32px}
  .gg .cover__name{font-size:clamp(calc(var(--name) * 1.1px),calc(var(--name) * 0.105vw),calc(var(--name) * 1.7px));margin-top:28px}
  .gg .cover--high .cover__name{font-size:clamp(calc(var(--name) * 0.9px),calc(var(--name) * 0.075vw),calc(var(--name) * 1.3px))}
  .gg .cover--high .tt{grid-template-columns:repeat(3,minmax(0,1fr));max-width:1240px;column-gap:36px}
  .gg .cover__ground{padding-bottom:36px}
  .gg .tt{max-width:980px}
  .gg .find{padding:96px var(--gut) 112px}
  .gg .find__h{font-size:36px}
  .gg .find__list{max-width:1180px;margin-top:40px}
  .gg .chapter{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start}
  .gg .plate{position:sticky;top:0;height:100vh;height:100dvh}
  .gg .plate img{height:100%;aspect-ratio:auto}
  .gg .chap{padding:112px var(--gut) 128px}
  .gg .chap--solo{grid-column:1/-1}
  .gg .chap--solo>*{max-width:40rem}
  .gg .help{padding:96px var(--gut)}
}
@media (min-width: 1600px){
  .gg .find__list{grid-template-columns:repeat(3,minmax(0,1fr));max-width:1500px}
  .gg .chap{padding-left:96px}
  .gg .chap>*{max-width:38rem}
}

/* Height ladder */
@media (max-height: 620px) and (min-width: 700px){
  .gg .cover__sky{padding-top:18px}
  .gg .cover__name{font-size:calc(var(--name) * 0.8px);margin-top:14px}
  .gg .cover--high .cover__name{font-size:calc(var(--name) * 0.65px)}
  .gg .cover--high .lockup{height:48px}
  .gg .cover__ground{padding-bottom:14px}
  .gg .tt{row-gap:6px}
}
@media (max-height: 460px) and (min-width: 700px){
  .gg .cover__name{font-size:calc(var(--name) * 0.65px)}
}

/* Short phones, portrait: everything on the first screen steps closer together */
@media (max-width: 699px) and (max-height: 700px){
  .gg .cover{gap:12px}
  .gg .cover__sky{padding-top:12px}
  .gg .cover__name{margin-top:12px;font-size:min(calc(var(--name) * var(--k) * 0.8px),calc(var(--name) * var(--k) * 0.2051vw))}
  .gg .cover__go{display:inline-flex;column-gap:16px}
  .gg .cover .tt{row-gap:4px}
  .gg .cover .tt dd{font-size:15px;line-height:1.3}
  .gg .cover .tt__times .fig{font-size:min(20px,calc((100cqi - 26px - var(--out-ch,3) * 9px) / 9))}
  .gg .cover .wifi__vals{line-height:1.3}
  .gg .cover__ground{padding-bottom:10px}
}

/* Facts high: the sky holds the name; the timetable drops onto the arrival field below it (the band fallback), on
   every upright window (phone or tablet) and on laptops up to 820 px tall, where the facts would otherwise run into
   the busy part of the photo (measured: navy on the trees at 1.74:1 on a phone, 4.29:1 on an iPad) */
@media (orientation: portrait),(min-width: 1001px) and (max-height: 820px){
  .gg .cover--high .cover__sky{flex:1;display:flex;flex-direction:column}
  .gg .cover--high .tt{flex:1;align-content:start;margin:14px calc(-1 * var(--gut)) 0;padding:18px var(--gut) 20px;background:var(--f-arrival)}
}

/* Facts low on a short desktop window (620 px tall or less): the white facts would sit on the bright middle of the
   photo with the shade at its 0.35 cap, so the cover takes the landscape-phone composition instead: the photo and
   the name in its sky on the left, the timetable on the arrival field on the right (the measured last resort) */
@media (min-width: 1001px) and (max-height: 620px){
  .gg .cover--low{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,3fr);gap:0;justify-content:stretch}
  .gg .cover--low .cover__photo{inset:0 60% 0 0;width:auto;height:auto}
  .gg .cover--low .cover__shade{display:none}
  .gg .cover--low .cover__sky{grid-column:1;grid-row:1;padding:24px 32px 0}
  .gg .cover--low[data-facts-ink] .cover__ground{grid-column:2;grid-row:1;display:flex;flex-direction:column;justify-content:center;margin:0;padding:24px var(--gut);background:var(--f-arrival);color:var(--ink);text-shadow:none}
  .gg .cover--low .copy{outline:2px solid var(--ink);outline-offset:0}
  .gg .cover--low .copy:focus-visible{outline:3px solid var(--ink);outline-offset:3px;box-shadow:none}
}

/* Landscape phone: photo left, facts right on the arrival field */
@media (orientation: landscape) and (max-height: 500px) and (max-width: 1000px){
  .gg .cover{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,3fr);grid-template-rows:auto 1fr;gap:0;justify-content:stretch}
  .gg .cover__photo{position:absolute;inset:0 60% 0 0;width:auto;height:auto;min-height:0}
  .gg .cover__shade{display:none}
  .gg .cover__sky,.gg .cover__ground{grid-column:2;background:var(--f-arrival);color:var(--ink);text-shadow:none !important}
  .gg .cover[data-name-ink=onPhoto] .cover__sky{color:var(--ink)}
  .gg .cover .cover__name{text-shadow:none}
  .gg .cover__sky{grid-row:1;padding:14px 24px 0}
  .gg .cover__name,.gg .cover--high .cover__name{font-size:min(44px,calc(var(--name) * 0.5px));margin-top:8px}
  .gg .cover__ground{grid-row:2;padding:8px 24px 14px}
  .gg .cover--high .cover__sky{grid-row:1/-1;padding:14px 24px}
  .gg .cover--low .cover__sky,.gg .cover--band .cover__sky{grid-column:1;grid-row:1;background:none;padding:12px 20px 0}
  .gg .cover--low .cover__ground,.gg .cover--band .cover__ground{grid-column:2;grid-row:1/-1;padding-top:14px;margin-top:0;background:var(--f-arrival)}
  .gg .cover--high .tt{margin:8px 0 0;padding:0;background:none}
  .gg .tt{grid-template-columns:1fr;row-gap:6px}
  .gg .cover .copy{outline:2px solid var(--ink);outline-offset:0}
  .gg .cover .copy:focus-visible{outline:3px solid var(--ink);outline-offset:3px;box-shadow:none}
  .gg .cover--type .cover__sky{grid-column:1;grid-row:1/-1}
  .gg .cover--type .cover__ground{grid-column:2;grid-row:1/-1;padding-top:14px}
  .gg .wifi[data-long]{flex-wrap:nowrap;align-items:flex-start}
  .gg .wifi[data-long] .wifi__vals{flex:1 1 0;line-height:1.3}
}
@media (orientation: landscape) and (max-height: 460px) and (max-width: 1000px){
  .gg .cover__ground,.gg .cover--high .cover__sky{padding:8px 16px}
  .gg .cover__addr{display:inline;font-size:15px}
  .gg .cover__go{display:inline-flex;column-gap:12px}
  .gg .cover .tt{row-gap:2px;margin-top:0}
  .gg .cover .tt dd{font-size:15px;line-height:1.3}
  .gg .cover .tt__times .fig{font-size:20px}
  .gg .cover .tt__times{column-gap:10px}
  .gg .cover .copy{padding:0 8px}
  .gg .cover--high .cover__name,.gg .cover__name{font-size:min(34px,calc(var(--name) * 0.5px))}
  .gg .lockup{height:32px}
}

/* Print: the cover timetable as a one-page door card, with a Wi-Fi QR */
@media print{
  .gg .cover__photo,.gg .cover__shade,.gg .plate,.gg .dip,.gg .find,.gg .chapter,.gg .copy,.gg .skip,.gg .cover__link,.gg .saved{display:none !important}
  .gg,.gg .cover,.gg .help{background:#fff !important;color:#000 !important}
  .gg .cover{min-height:0;display:block}
  .gg .cover__sky,.gg .cover__ground{color:#000 !important;text-shadow:none !important;padding:0 0 12pt;background:none !important}
  .gg .cover__name{font-size:40pt}
  .gg .tt{grid-template-columns:1fr;font-size:12pt}
  .gg .qr{display:block;width:30mm;height:30mm;margin-top:10pt}
  .gg .help{padding:12pt 0}
}
`;
