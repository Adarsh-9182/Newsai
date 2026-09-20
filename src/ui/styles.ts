/**
 * The design system, as one stylesheet.
 *
 * Tokens come from typesafe.ai's own CSS rather than guesswork: off-black
 * `#1e1e1e` and off-white `#fefefe` (never pure), Host Grotesk for words and
 * JetBrains Mono for anything that is data, and a few saturated accents on a
 * quiet ground. Dark is the default; light is a toggle, not a media query, so
 * the site looks the same to everyone unless they choose otherwise.
 *
 * Two rules stop it turning into decoration. Colour carries meaning — green is
 * research, teal is agents, pink is policy and funding, and nothing else gets
 * one. And every effect is CSS or a few lines of pointer tracking: the page
 * paints before any script runs, and it is complete with scripts off.
 */

export const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@300..800&family=JetBrains+Mono:wght@400;500;700&display=swap";

export const CSS = String.raw`
:root {
  --bg:#141414; --bg-2:#191919; --panel:#1e1e1e; --panel-2:#252525; --glass:rgba(30,30,30,.62);
  --line:#2c2c2c; --line-2:#3c3c3c;
  --ink:#fefefe; --ink-2:#d2d2d2; --dim:#8a8a8a; --dim-2:#5f5f5f;
  --green:#03aa5c; --teal:#09aea1; --pink:#d45bb6; --rose:#f386a1;
  --glow-a:rgba(3,170,92,.34); --glow-b:rgba(9,174,161,.30); --glow-c:rgba(212,91,182,.22);
  --grain:.055;
  --sans:"Host Grotesk",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  --mono:"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace;
  --r:12px; --ease:cubic-bezier(.2,.7,.2,1);
  color-scheme:dark;
}
:root[data-theme="light"] {
  --bg:#fefefe; --bg-2:#f6f6f4; --panel:#fff; --panel-2:#f2f2f0; --glass:rgba(255,255,255,.7);
  --line:#e6e6e3; --line-2:#d2d2ce;
  --ink:#1e1e1e; --ink-2:#3a3a38; --dim:#6b6b68; --dim-2:#9a9a96;
  --green:#028a4a; --teal:#077f76; --pink:#b8399a; --rose:#d4587a;
  --glow-a:rgba(3,170,92,.20); --glow-b:rgba(9,174,161,.18); --glow-c:rgba(212,91,182,.14);
  --grain:.035;
  color-scheme:light;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  margin:0;background:var(--bg);color:var(--ink);
  font:16px/1.6 var(--sans);-webkit-font-smoothing:antialiased;
  font-feature-settings:"ss01","cv11";min-height:100vh;overflow-x:hidden;
}
a{color:inherit;text-decoration:none}
button{font:inherit;color:inherit;cursor:pointer}
::selection{background:var(--teal);color:#000}
:focus-visible{outline:2px solid var(--teal);outline-offset:2px;border-radius:6px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

/* — atmosphere: a grid that fades, three drifting blooms, and grain — */
.bg{position:fixed;inset:0;z-index:-2;pointer-events:none;overflow:hidden}
.bg::before{
  content:"";position:absolute;inset:0;
  background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);
  background-size:56px 56px;
  -webkit-mask-image:radial-gradient(ellipse 75% 60% at 50% 0%,#000 0%,transparent 78%);
          mask-image:radial-gradient(ellipse 75% 60% at 50% 0%,#000 0%,transparent 78%);
  opacity:.6;
}
.bg i{position:absolute;border-radius:50%;filter:blur(90px);will-change:transform}
.bg i:nth-child(1){width:560px;height:420px;left:8%;top:-160px;background:var(--glow-a)}
.bg i:nth-child(2){width:520px;height:400px;right:6%;top:-140px;background:var(--glow-b)}
.bg i:nth-child(3){width:420px;height:320px;left:42%;top:120px;background:var(--glow-c)}
body::after{
  content:"";position:fixed;inset:0;z-index:100;pointer-events:none;opacity:var(--grain);mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}

.wrap{max-width:1120px;margin:0 auto;padding:0 22px}
.narrow{max-width:720px;margin:0 auto;padding:0 22px}

/* — nav — */
nav.top{
  position:sticky;top:0;z-index:30;
  backdrop-filter:blur(16px) saturate(150%);-webkit-backdrop-filter:blur(16px) saturate(150%);
  background:color-mix(in srgb,var(--bg) 72%,transparent);border-bottom:1px solid var(--line);
}
nav.top .in{display:flex;align-items:center;gap:22px;height:60px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:-.02em;font-size:17px}
.brand i{
  width:24px;height:24px;border-radius:7px;display:block;
  background:conic-gradient(from 210deg,var(--green),var(--teal),var(--pink),var(--green));
  box-shadow:0 0 22px var(--glow-a);animation:spin 14s linear infinite;
}
@keyframes spin{to{transform:rotate(360deg)}}
.brand small{font:400 12px var(--mono);color:var(--dim);letter-spacing:0;margin-left:-4px}
nav.top ul{display:flex;gap:2px;list-style:none;margin:0;padding:0}
nav.top li a{font:500 13px var(--mono);color:var(--dim);padding:7px 11px;border-radius:8px;transition:color .15s,background .15s}
nav.top li a:hover{color:var(--ink);background:var(--panel)}
nav.top li a.on{color:var(--ink);background:var(--panel)}
.nav-r{margin-left:auto;display:flex;align-items:center;gap:8px}
.searchbtn{
  display:flex;align-items:center;gap:10px;height:34px;padding:0 8px 0 11px;min-width:190px;
  border:1px solid var(--line);border-radius:9px;background:var(--glass);color:var(--dim);
  font:400 13px var(--sans);transition:border-color .15s,color .15s;
}
.searchbtn:hover{border-color:var(--line-2);color:var(--ink)}
.searchbtn svg{width:14px;height:14px;flex:none}
.searchbtn span{flex:1;text-align:left}
kbd{font:500 11px var(--mono);padding:2px 6px;border:1px solid var(--line-2);border-bottom-width:2px;border-radius:5px;color:var(--dim);background:var(--panel)}
.iconbtn{width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--line);border-radius:9px;background:var(--glass);color:var(--dim);transition:all .15s}
.iconbtn:hover{color:var(--ink);border-color:var(--line-2)}
.iconbtn svg{width:16px;height:16px}
#auth{display:flex;align-items:center;gap:8px;min-width:96px;justify-content:flex-end}
.avatar{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font:700 13px var(--mono);
  color:#06140f;background:conic-gradient(from 200deg,var(--green),var(--teal),var(--pink),var(--green));border:0;text-transform:uppercase}
.menu{position:absolute;right:22px;top:56px;min-width:220px;padding:6px;border:1px solid var(--line-2);border-radius:12px;
  background:var(--panel);box-shadow:0 20px 50px rgba(0,0,0,.45);z-index:40}
.menu[hidden]{display:none}
.menu .who{padding:10px 12px 8px;font:400 12px var(--mono);color:var(--dim);border-bottom:1px solid var(--line);margin-bottom:6px;word-break:break-all}
.menu a,.menu button{display:block;width:100%;text-align:left;padding:9px 12px;border:0;background:none;border-radius:8px;font:500 13px var(--sans);color:var(--ink-2)}
.menu a:hover,.menu button:hover{background:var(--panel-2);color:var(--ink)}
@media (max-width:780px){nav.top ul{display:none}.searchbtn{min-width:0}.searchbtn span,.searchbtn kbd{display:none}.searchbtn{width:34px;padding:0;justify-content:center}}

@media (max-width:600px){
  nav.top .in{gap:10px}
  .brand small{display:none}
  .nav-r{gap:6px}
  #auth{min-width:0;gap:6px}
  .menu{right:12px}
}
@media (max-width:360px){#auth .btn:not(.primary){display:none}}

/* — buttons & fields — */
.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;height:38px;padding:0 16px;
  border-radius:9px;border:1px solid var(--line-2);background:var(--panel);color:var(--ink);
  font:600 13.5px var(--sans);transition:transform .15s var(--ease),border-color .15s,background .15s,box-shadow .2s;white-space:nowrap;
}
.btn:hover{border-color:var(--ink);transform:translateY(-1px)}
.btn.sm{height:32px;padding:0 12px;font-size:13px}
.btn.primary{
  color:#04130d;border-color:transparent;
  background:linear-gradient(100deg,var(--green),var(--teal) 60%,#2bd4c4);
  box-shadow:0 6px 22px -6px var(--glow-a);
}
.btn.primary:hover{box-shadow:0 10px 30px -6px var(--glow-a),0 0 0 4px color-mix(in srgb,var(--teal) 18%,transparent)}
.btn.block{width:100%;height:44px;font-size:14.5px}
.btn[disabled]{opacity:.6;cursor:wait;transform:none}
.btn .spin{width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin .7s linear infinite}
.field{display:grid;gap:7px;margin-bottom:16px}
.field label{font:500 12px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}
.input{
  width:100%;height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--line-2);
  background:color-mix(in srgb,var(--bg) 60%,transparent);color:var(--ink);font:400 15px var(--sans);
  transition:border-color .15s,box-shadow .15s;
}
.input::placeholder{color:var(--dim-2)}
.input:focus{outline:0;border-color:var(--teal);box-shadow:0 0 0 4px color-mix(in srgb,var(--teal) 16%,transparent)}
.pw{position:relative}.pw .input{padding-right:64px}
.pw button{position:absolute;right:6px;top:6px;height:32px;padding:0 10px;border:0;border-radius:7px;background:none;color:var(--dim);font:500 12px var(--mono)}
.pw button:hover{color:var(--ink);background:var(--panel-2)}
.msg{min-height:20px;font:400 13px var(--sans);margin:0 0 14px}
.msg.err{color:var(--rose)}.msg.ok{color:var(--green)}

/* — hero — */
.hero{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:44px;align-items:center;padding:82px 0 30px}
.eyebrow{display:inline-flex;align-items:center;gap:9px;font:500 12px var(--mono);color:var(--teal);letter-spacing:.12em;text-transform:uppercase;
  margin:0 0 22px;padding:6px 12px 6px 10px;border:1px solid color-mix(in srgb,var(--teal) 32%,transparent);border-radius:999px;background:color-mix(in srgb,var(--teal) 8%,transparent)}
.eyebrow::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--green);animation:ping 2.4s ease-out infinite}
@keyframes ping{0%{box-shadow:0 0 0 0 rgba(3,170,92,.6)}70%,100%{box-shadow:0 0 0 8px rgba(3,170,92,0)}}
.hero h1{font-size:clamp(40px,6.6vw,74px);line-height:1;letter-spacing:-.05em;font-weight:600;margin:0 0 24px}
.hero h1 em{
  font-style:normal;background:linear-gradient(100deg,var(--green),var(--teal),var(--pink),var(--teal),var(--green));background-size:250% 100%;
  -webkit-background-clip:text;background-clip:text;color:transparent;animation:shimmer 9s linear infinite;
}
@keyframes shimmer{to{background-position:250% 0}}
.hero p.lede{font-size:clamp(16px,2.1vw,19px);color:var(--ink-2);max-width:50ch;margin:0 0 30px;line-height:1.55}
.cta-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.inline-form{display:flex;gap:8px;flex-wrap:wrap;max-width:460px;width:100%}
.inline-form .input{flex:1;min-width:190px;height:42px}
.inline-form .btn{height:42px}
.fineprint{font:400 12px var(--mono);color:var(--dim);margin:12px 0 0}
.fineprint.ok{color:var(--green)}.fineprint.err{color:var(--rose)}
@media (max-width:900px){.hero{grid-template-columns:1fr;padding-top:52px;gap:30px}}

/* signal board: today's stories, bar length = the source's own count */
.board{border:1px solid var(--line-2);border-radius:16px;background:var(--glass);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);overflow:hidden;box-shadow:0 30px 70px -30px rgba(0,0,0,.6)}
.board header{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--line);font:500 11px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
.board header i{width:9px;height:9px;border-radius:50%;background:var(--line-2)}
.board header i:nth-child(1){background:#ff5f57}.board header i:nth-child(2){background:#febc2e}.board header i:nth-child(3){background:#28c840}
.board header b{margin-left:8px;font-weight:500}
.board ol{list-style:none;margin:0;padding:6px 0}
.board li{display:grid;grid-template-columns:22px 1fr auto;gap:10px;align-items:center;padding:9px 16px}
.board li a{display:contents}
.board .n{font:500 11px var(--mono);color:var(--dim-2)}
.board .t{min-width:0}
.board .t span{display:block;font:500 13.5px var(--sans);color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.board .bar-track{height:4px;border-radius:4px;background:var(--line);margin-top:7px;overflow:hidden}
.board .bar-fill{display:block;height:100%;width:var(--w);border-radius:4px;background:linear-gradient(90deg,var(--green),var(--teal));transform-origin:left;animation:grow 1.1s var(--ease) both;animation-delay:calc(var(--i)*90ms + 300ms)}
@keyframes grow{from{transform:scaleX(0)}}
.board .v{font:500 12px var(--mono);color:var(--ink-2);text-align:right;min-width:52px}
.board li:hover{background:color-mix(in srgb,var(--panel-2) 70%,transparent)}
.board footer{padding:10px 16px;border-top:1px solid var(--line);font:400 11px var(--mono);color:var(--dim-2)}

/* — source marquee — */
.marquee{margin:30px 0 6px;overflow:hidden;border-block:1px solid var(--line);
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
.marquee div{display:flex;gap:44px;width:max-content;padding:14px 0;animation:slide 38s linear infinite}
.marquee span{font:500 12px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--dim);white-space:nowrap}
.marquee span::before{content:"◆";color:var(--teal);margin-right:44px;font-size:8px;vertical-align:middle}
@keyframes slide{to{transform:translateX(-50%)}}

/* — filters — */
.bar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:34px 0 14px;flex-wrap:wrap}
.bar h2{font:500 12px var(--mono);color:var(--dim);letter-spacing:.12em;text-transform:uppercase;margin:0}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{font:500 12px var(--mono);padding:6px 12px;border:1px solid var(--line);border-radius:999px;color:var(--dim);transition:all .15s;background:transparent}
.chip:hover{color:var(--ink);border-color:var(--line-2)}
.chip.on{color:var(--bg);border-color:var(--ink);background:var(--ink)}
.chip.fy{color:var(--pink);border-color:color-mix(in srgb,var(--pink) 45%,transparent)}
.chip.fy.on{color:#fff;background:var(--pink);border-color:var(--pink)}
[hidden]{display:none!important}

/* — spotlight: a glow that follows the pointer, set by two CSS variables — */
.spot{position:relative;--mx:50%;--my:0%}
.spot::before,.spot::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .3s}
.spot::before{background:radial-gradient(380px circle at var(--mx) var(--my),color-mix(in srgb,var(--teal) 15%,transparent),transparent 62%)}
.spot::after{padding:1px;background:radial-gradient(260px circle at var(--mx) var(--my),var(--teal),color-mix(in srgb,var(--pink) 60%,transparent) 45%,transparent 75%);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
.spot:hover::before,.spot:hover::after{opacity:1}

/* — the lead story — */
.lead{
  display:block;overflow:hidden;border:1px solid var(--line-2);border-radius:18px;padding:38px;margin-bottom:14px;
  background:linear-gradient(160deg,color-mix(in srgb,var(--panel) 92%,transparent),color-mix(in srgb,var(--bg-2) 92%,transparent));
  transition:transform .25s var(--ease);
}
.lead:hover{transform:translateY(-3px)}
.lead .kicker{display:flex;gap:10px;align-items:center;margin-bottom:18px;flex-wrap:wrap}
.lead h3{font-size:clamp(26px,4vw,42px);line-height:1.08;letter-spacing:-.04em;margin:0 0 16px;font-weight:600;max-width:24ch}
.lead p{color:var(--ink-2);font-size:17.5px;margin:0 0 24px;max-width:62ch}
.lead .go{font:500 13px var(--mono);color:var(--teal)}
.lead .go::after{content:" →";transition:margin .2s}
.lead:hover .go::after{margin-left:6px}
.lead .save{position:absolute;top:22px;right:22px}
@media (max-width:600px){.lead{padding:24px}}

/* — story grid — */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}
.card{
  display:flex;flex-direction:column;gap:12px;padding:22px;border:1px solid var(--line);border-radius:var(--r);
  background:color-mix(in srgb,var(--panel) 88%,transparent);transition:transform .22s var(--ease),border-color .2s,background .2s;
}
.card:hover{transform:translateY(-3px);border-color:var(--line-2);background:var(--panel)}
.card h3{font-size:17.5px;line-height:1.3;letter-spacing:-.02em;margin:0;font-weight:600;padding-right:34px}
.card h3 a::after{content:"";position:absolute;inset:0;z-index:1;border-radius:inherit}
.card p{margin:0;color:var(--ink-2);font-size:14.5px;line-height:1.55}
.card .why{color:var(--dim);font-size:13.5px;border-left:2px solid var(--line-2);padding-left:12px}
.card .foot{margin-top:auto;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding-top:4px;position:relative;z-index:2}
.card .save{position:absolute;top:16px;right:14px}
.card.fy-hit{border-color:color-mix(in srgb,var(--pink) 50%,transparent)}

.save{z-index:3;width:32px;height:32px;display:grid;place-items:center;border-radius:9px;border:1px solid transparent;background:none;color:var(--dim-2);transition:all .15s}
.save svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linejoin:round}
.save:hover{color:var(--ink);background:var(--panel-2);border-color:var(--line-2)}
.save[aria-pressed="true"]{color:var(--teal)}
.save[aria-pressed="true"] svg{fill:currentColor}
.save.pop svg{animation:pop .35s var(--ease)}
@keyframes pop{40%{transform:scale(1.35)}}

.k{font:500 11px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}
.tag{font:500 10.5px var(--mono);padding:3px 8px;border-radius:5px;letter-spacing:.05em;text-transform:uppercase;background:var(--panel-2);color:var(--dim);border:1px solid var(--line)}
.tag.agents{color:var(--teal);border-color:color-mix(in srgb,var(--teal) 35%,transparent);background:color-mix(in srgb,var(--teal) 9%,transparent)}
.tag.research{color:var(--green);border-color:color-mix(in srgb,var(--green) 35%,transparent);background:color-mix(in srgb,var(--green) 9%,transparent)}
.tag.policy,.tag.funding{color:var(--pink);border-color:color-mix(in srgb,var(--pink) 35%,transparent);background:color-mix(in srgb,var(--pink) 9%,transparent)}
.tag.deep{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.sig{font:500 11px var(--mono);color:var(--dim)}

.dayhead{display:flex;align-items:baseline;gap:14px;margin:52px 0 16px}
.dayhead h2{font-size:22px;letter-spacing:-.03em;margin:0;font-weight:600}
.dayhead span{font:400 12px var(--mono);color:var(--dim)}
.dayhead::after{content:"";flex:1;height:1px;background:var(--line)}

/* — bento: how it works — */
.bento{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-top:80px}
.tile{border:1px solid var(--line);border-radius:16px;padding:26px;background:color-mix(in srgb,var(--panel) 85%,transparent);grid-column:span 2;overflow:hidden}
.tile.wide{grid-column:span 4}
.tile .num{font:500 11px var(--mono);letter-spacing:.12em;color:var(--teal);margin-bottom:14px;display:block}
.tile h3{font-size:22px;letter-spacing:-.03em;line-height:1.15;margin:0 0 10px;font-weight:600}
.tile p{margin:0;color:var(--ink-2);font-size:15px;line-height:1.6}
.tile pre{margin:18px 0 0;font:400 12.5px/1.75 var(--mono);color:var(--ink-2);background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:14px 16px;overflow-x:auto}
.tile pre b{color:var(--green);font-weight:500}.tile pre i{color:var(--dim);font-style:normal}
@media (max-width:900px){.tile,.tile.wide{grid-column:span 6}}

/* — the band that asks for an email — */
.band{margin-top:80px;border:1px solid var(--line-2);border-radius:20px;padding:46px 34px;text-align:center;position:relative;overflow:hidden;
  background:radial-gradient(600px 240px at 50% -20%,var(--glow-b),transparent 70%),color-mix(in srgb,var(--panel) 85%,transparent)}
.band h2{font-size:clamp(26px,4vw,38px);letter-spacing:-.04em;line-height:1.1;margin:0 0 12px;font-weight:600}
.band p{margin:0 auto 24px;color:var(--ink-2);max-width:46ch}
.band .inline-form{margin:0 auto;justify-content:center}
.band .fineprint{text-align:center}

/* — story page — */
.progress{position:fixed;top:0;left:0;height:3px;width:100%;z-index:60;transform-origin:left;background:linear-gradient(90deg,var(--green),var(--teal),var(--pink));transform:scaleX(0)}
@supports (animation-timeline:scroll()){.progress{animation:fill linear both;animation-timeline:scroll(root)}@keyframes fill{to{transform:scaleX(1)}}}
.story{padding:56px 0 24px}
.crumb{font:500 12px var(--mono);color:var(--dim);margin-bottom:26px;display:inline-block}
.crumb:hover{color:var(--ink)}
.story h1{font-size:clamp(30px,5vw,48px);line-height:1.06;letter-spacing:-.045em;margin:14px 0 18px;font-weight:600}
.story .meta{display:flex;flex-wrap:wrap;gap:12px;align-items:center;font:400 12px var(--mono);color:var(--dim);padding-bottom:22px;border-bottom:1px solid var(--line);margin-bottom:22px}
.story .actions{display:flex;gap:8px;margin-bottom:30px;flex-wrap:wrap}
.story .tldr{font-size:19px;line-height:1.55;color:var(--ink-2);margin:0 0 34px}
.sec{margin:0 0 30px}
.sec h2{font:500 12px var(--mono);letter-spacing:.13em;text-transform:uppercase;margin:0 0 12px;display:flex;gap:10px;align-items:center}
.sec h2::before{content:"";width:16px;height:1px;background:currentColor}
.sec.what h2{color:var(--green)}.sec.sowhat h2{color:var(--teal)}.sec.caveats h2{color:var(--rose)}.sec.take h2{color:var(--pink)}
.sec p{margin:0;font-size:17px;line-height:1.72;color:var(--ink-2)}
.sec.caveats{border:1px solid color-mix(in srgb,var(--rose) 32%,transparent);background:color-mix(in srgb,var(--rose) 6%,transparent);border-radius:var(--r);padding:20px 22px}
.sec ul{margin:0;padding:0;list-style:none;display:grid;gap:8px}
.sec li{padding:11px 14px 11px 40px;border:1px solid var(--line);border-radius:9px;background:var(--panel);position:relative;font-size:15.5px;color:var(--ink-2)}
.sec li::before{content:"→";position:absolute;left:14px;color:var(--pink);font-family:var(--mono)}
.note{font:400 12px/1.6 var(--mono);color:var(--dim-2);margin-top:36px;padding-top:18px;border-top:1px dashed var(--line)}

/* — prose pages — */
.prose h1{font-size:clamp(32px,5vw,50px);letter-spacing:-.045em;line-height:1.06;margin:0 0 20px;font-weight:600}
.prose h2{font-size:22px;letter-spacing:-.025em;margin:40px 0 10px;font-weight:600}
.prose p,.prose li{color:var(--ink-2);font-size:17px;line-height:1.72}
.prose code{font:500 14px var(--mono);background:var(--panel);border:1px solid var(--line);padding:2px 6px;border-radius:5px}
.prose pre{font:400 13px/1.7 var(--mono);background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:18px 20px;overflow-x:auto;color:var(--ink-2)}
.list{display:grid;gap:10px}
.rowlink{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:16px 20px;border:1px solid var(--line);border-radius:var(--r);background:color-mix(in srgb,var(--panel) 88%,transparent);transition:all .18s var(--ease)}
.rowlink:hover{border-color:var(--line-2);transform:translateX(3px);background:var(--panel)}
.rowlink h3{margin:0;font-size:17px;letter-spacing:-.02em;font-weight:600}

/* — auth — */
.auth{min-height:calc(100vh - 60px);display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:60px;max-width:1080px;margin:0 auto;padding:40px 22px}
.auth-side h1{font-size:clamp(34px,4.6vw,54px);line-height:1.02;letter-spacing:-.05em;font-weight:600;margin:0 0 20px}
.auth-side h1 em{font-style:normal;background:linear-gradient(100deg,var(--green),var(--teal),var(--pink));-webkit-background-clip:text;background-clip:text;color:transparent}
.auth-side p{color:var(--ink-2);font-size:17px;max-width:40ch;margin:0 0 28px}
.perks{list-style:none;margin:0;padding:0;display:grid;gap:14px}
.perks li{display:grid;grid-template-columns:34px 1fr;gap:14px;align-items:start;font-size:15px;color:var(--ink-2)}
.perks li b{display:block;color:var(--ink);font-weight:600;margin-bottom:1px}
.perks li span.ic{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;border:1px solid var(--line-2);background:var(--panel);color:var(--teal);font:500 14px var(--mono)}
.authcard{
  position:relative;border:1px solid var(--line-2);border-radius:20px;padding:34px;background:var(--glass);
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 40px 90px -40px rgba(0,0,0,.7);
}
.authcard::before{content:"";position:absolute;inset:-1px;border-radius:20px;padding:1px;pointer-events:none;
  background:linear-gradient(140deg,var(--green),transparent 30%,transparent 70%,var(--pink));opacity:.55;
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
.authcard h2{margin:0 0 6px;font-size:24px;letter-spacing:-.03em;font-weight:600}
.authcard .sub{color:var(--dim);font-size:14.5px;margin:0 0 24px}
.authcard .alt{margin:20px 0 0;text-align:center;font-size:14px;color:var(--dim)}
.authcard .alt a{color:var(--teal);font-weight:600}
@media (max-width:860px){.auth{grid-template-columns:1fr;gap:34px}.auth-side{order:2}}

/* — account — */
.acct{padding:56px 0 20px}
.acct-head{display:flex;align-items:center;gap:18px;margin-bottom:34px;flex-wrap:wrap}
.acct-head .avatar{width:56px;height:56px;font-size:20px}
.acct-head h1{margin:0;font-size:28px;letter-spacing:-.035em;font-weight:600}
.acct-head p{margin:2px 0 0;font:400 13px var(--mono);color:var(--dim)}
.acct-head .btn{margin-left:auto}
.panel{border:1px solid var(--line);border-radius:16px;padding:26px;background:color-mix(in srgb,var(--panel) 88%,transparent);margin-bottom:16px}
.panel h2{margin:0 0 4px;font-size:18px;letter-spacing:-.02em;font-weight:600;display:flex;align-items:center;gap:10px}
.panel > p{margin:0 0 18px;color:var(--dim);font-size:14.5px}
.saved-flag{font:500 11px var(--mono);color:var(--green);opacity:0;transition:opacity .3s}
.saved-flag.on{opacity:1}
.toggles{display:flex;gap:8px;flex-wrap:wrap}
.toggle{font:500 13px var(--mono);padding:8px 14px;border-radius:999px;border:1px solid var(--line-2);background:transparent;color:var(--dim);transition:all .15s}
.toggle:hover{color:var(--ink)}
.toggle[aria-pressed="true"]{color:#04130d;background:linear-gradient(100deg,var(--green),var(--teal));border-color:transparent}
.switch{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:14px 0 0;margin-top:18px;border-top:1px solid var(--line)}
.switch b{display:block;font-weight:600}.switch span{color:var(--dim);font-size:14px}
.sw{width:46px;height:26px;border-radius:999px;border:1px solid var(--line-2);background:var(--panel-2);position:relative;flex:none;transition:background .2s}
.sw::after{content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:var(--ink);transition:transform .2s var(--ease)}
.sw[aria-checked="true"]{background:linear-gradient(100deg,var(--green),var(--teal));border-color:transparent}
.sw[aria-checked="true"]::after{transform:translateX(20px);background:#04130d}
.savedrow{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;padding:14px 0;border-top:1px solid var(--line)}
.savedrow:first-of-type{border-top:0}
.savedrow a.t{font-weight:600;letter-spacing:-.015em;display:block}
.savedrow a.t:hover{color:var(--teal)}
.savedrow .k{display:block;margin-top:3px}
.skel{height:58px;border-radius:10px;background:linear-gradient(90deg,var(--panel),var(--panel-2),var(--panel));background-size:200% 100%;animation:sk 1.4s linear infinite;margin-bottom:10px}
@keyframes sk{to{background-position:-200% 0}}

/* — command palette — */
.pal{position:fixed;inset:0;z-index:80;display:grid;justify-items:center;align-content:start;padding:12vh 16px 0;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.pal[hidden]{display:none}
.pal-box{width:min(640px,100%);border:1px solid var(--line-2);border-radius:16px;background:var(--panel);box-shadow:0 40px 100px rgba(0,0,0,.6);overflow:hidden;animation:palin .18s var(--ease)}
@keyframes palin{from{opacity:0;transform:translateY(-8px) scale(.985)}}
.pal-box input{width:100%;height:56px;padding:0 20px;border:0;border-bottom:1px solid var(--line);background:none;color:var(--ink);font:400 17px var(--sans)}
.pal-box input:focus{outline:0}
.pal-list{max-height:min(52vh,420px);overflow-y:auto;padding:6px;margin:0;list-style:none}
.pal-list li a{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:10px 12px;border-radius:9px}
.pal-list li a[aria-selected="true"]{background:var(--panel-2)}
.pal-list .pt{font-weight:500;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pal-list .ps{display:block;font:400 12px var(--sans);color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
.pal-list .pk{font:500 10.5px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--dim-2)}
.pal-list .ph{padding:10px 12px 4px;font:500 10.5px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--dim-2)}
.pal-empty{padding:34px;text-align:center;color:var(--dim);font:400 13px var(--mono)}
.pal-foot{display:flex;gap:16px;padding:10px 16px;border-top:1px solid var(--line);font:400 11px var(--mono);color:var(--dim-2)}

.toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,20px);opacity:0;z-index:90;padding:11px 18px;border-radius:10px;border:1px solid var(--line-2);
  background:var(--panel);font:500 13px var(--sans);box-shadow:0 14px 40px rgba(0,0,0,.45);transition:all .25s var(--ease);pointer-events:none}
.toast.on{opacity:1;transform:translate(-50%,0)}

footer.site{margin-top:100px;border-top:1px solid var(--line);padding:38px 0 60px;color:var(--dim);font-size:13px}
footer.site .in{display:flex;gap:30px;justify-content:space-between;flex-wrap:wrap}
footer.site p{margin:0 0 8px;max-width:58ch;line-height:1.6}
footer.site a{color:var(--ink-2);text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--line-2)}
footer.site nav{display:flex;gap:26px;flex-wrap:wrap;font:400 13px var(--mono)}
footer.site nav div{display:grid;gap:8px;align-content:start}
footer.site nav b{font-weight:500;color:var(--ink);margin-bottom:2px}
footer.site nav a{text-decoration:none;color:var(--dim)}footer.site nav a:hover{color:var(--ink)}
.empty{padding:70px 0;text-align:center;color:var(--dim);font:400 14px var(--mono)}

/* — motion: one entrance, and nothing for people who ask for none — */
@media (prefers-reduced-motion:no-preference){
  .bg i:nth-child(1){animation:drift 22s ease-in-out infinite alternate}
  .bg i:nth-child(2){animation:drift 26s ease-in-out infinite alternate-reverse}
  .bg i:nth-child(3){animation:drift 30s ease-in-out infinite alternate}
  @keyframes drift{to{transform:translate(70px,50px) scale(1.15)}}
  .rise{animation:rise .7s var(--ease) both}
  @keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
  .grid .card{animation:rise .6s var(--ease) both}
  .grid .card:nth-child(1){animation-delay:.04s}.grid .card:nth-child(2){animation-delay:.09s}.grid .card:nth-child(3){animation-delay:.14s}
  .grid .card:nth-child(4){animation-delay:.19s}.grid .card:nth-child(5){animation-delay:.24s}.grid .card:nth-child(6){animation-delay:.29s}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}html{scroll-behavior:auto}.marquee div{animation:none!important}}
`;
