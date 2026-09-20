/**
 * The design system, as one stylesheet.
 *
 * Borrowed in spirit from typesafe.ai — the tokens below were read off that
 * site's CSS rather than guessed: an off-black `#1e1e1e` and off-white
 * `#fefefe` (never pure), Host Grotesk for words and JetBrains Mono for
 * everything that is data, and a small set of saturated accents used
 * sparingly against a quiet ground. The whole thing reads as code because
 * the structure is code-shaped: hairline borders, mono labels, a grid that
 * shows.
 *
 * Two rules keep it from becoming decoration. Colour carries meaning — green
 * is research, teal is agents, pink is policy, and nothing else gets a
 * colour. And there is no JavaScript in the visual layer: every effect here
 * is CSS, so the page paints instantly on a phone on mobile data.
 */

export const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@300..800&family=JetBrains+Mono:wght@400;500;700&display=swap";

export const CSS = String.raw`
:root {
  --bg:#141414; --bg-2:#1a1a1a; --panel:#1e1e1e; --panel-2:#242424;
  --line:#2c2c2c; --line-2:#3a3a3a;
  --ink:#fefefe; --ink-2:#d4d4d4; --dim:#858585; --dim-2:#5f5f5f;
  --green:#03aa5c; --teal:#09aea1; --pink:#d45bb6; --rose:#f386a1;
  --sans:"Host Grotesk",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  --mono:"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace;
  --r:10px;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    --bg:#fefefe; --bg-2:#f6f6f5; --panel:#fff; --panel-2:#f3f3f2;
    --line:#e5e5e3; --line-2:#d0d0cd;
    --ink:#1e1e1e; --ink-2:#3a3a38; --dim:#6b6b68; --dim-2:#9a9a96;
    --green:#028a4a; --teal:#077f76; --pink:#b8399a; --rose:#d4587a;
  }
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  margin:0;background:var(--bg);color:var(--ink);
  font:16px/1.6 var(--sans);-webkit-font-smoothing:antialiased;
  font-feature-settings:"ss01","cv11";
  min-height:100vh;
}
a{color:inherit;text-decoration:none}
::selection{background:var(--teal);color:#000}

/* The signature: a faint grid that fades out, with a green-teal bloom above it.
   Pure CSS — two gradients on a fixed pseudo-element. */
body::before{
  content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;
  background-image:
    linear-gradient(var(--line) 1px,transparent 1px),
    linear-gradient(90deg,var(--line) 1px,transparent 1px);
  background-size:56px 56px;
  -webkit-mask-image:radial-gradient(ellipse 80% 55% at 50% 0%,#000 0%,transparent 75%);
          mask-image:radial-gradient(ellipse 80% 55% at 50% 0%,#000 0%,transparent 75%);
  opacity:.55;
}
body::after{
  content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;
  background:
    radial-gradient(600px 320px at 22% -4%,rgba(3,170,92,.16),transparent 70%),
    radial-gradient(520px 300px at 78% -2%,rgba(9,174,161,.13),transparent 70%);
}
@media (prefers-color-scheme: light){
  :root:not([data-theme="dark"]) body::after{opacity:.5}
}

.wrap{max-width:1080px;margin:0 auto;padding:0 20px}
.narrow{max-width:720px;margin:0 auto;padding:0 20px}

/* — nav — */
nav.top{
  position:sticky;top:0;z-index:20;
  backdrop-filter:blur(14px) saturate(140%);-webkit-backdrop-filter:blur(14px) saturate(140%);
  background:color-mix(in srgb,var(--bg) 78%,transparent);
  border-bottom:1px solid var(--line);
}
nav.top .in{display:flex;align-items:center;justify-content:space-between;height:56px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:-.02em}
.brand i{
  width:22px;height:22px;border-radius:6px;display:block;
  background:conic-gradient(from 210deg,var(--green),var(--teal),var(--pink),var(--green));
  box-shadow:0 0 18px rgba(3,170,92,.35);
}
.brand small{font:400 12px var(--mono);color:var(--dim);letter-spacing:0}
nav.top ul{display:flex;gap:4px;list-style:none;margin:0;padding:0}
nav.top li a{
  font:500 13px var(--mono);color:var(--dim);padding:7px 11px;border-radius:7px;
  transition:color .15s,background .15s;
}
nav.top li a:hover{color:var(--ink);background:var(--panel)}
nav.top li a.on{color:var(--ink)}
.live{display:inline-flex;align-items:center;gap:7px;font:500 11px var(--mono);
      color:var(--dim);text-transform:uppercase;letter-spacing:.09em}
.live::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--green);
  box-shadow:0 0 0 0 rgba(3,170,92,.6);animation:ping 2.4s ease-out infinite}
@keyframes ping{70%{box-shadow:0 0 0 7px rgba(3,170,92,0)}100%{box-shadow:0 0 0 0 rgba(3,170,92,0)}}
@media (max-width:640px){nav.top li:not(:last-child){display:none}.live{display:none}}

/* — hero — */
.hero{padding:88px 0 40px}
.eyebrow{font:500 12px var(--mono);color:var(--teal);letter-spacing:.14em;text-transform:uppercase;margin:0 0 20px}
.hero h1{
  font-size:clamp(38px,7vw,68px);line-height:1.02;letter-spacing:-.045em;
  font-weight:600;margin:0 0 22px;max-width:15ch;
}
.hero h1 em{
  font-style:normal;
  background:linear-gradient(100deg,var(--green),var(--teal) 55%,var(--pink));
  -webkit-background-clip:text;background-clip:text;color:transparent;
}
.hero p.lede{font-size:clamp(16px,2.2vw,19px);color:var(--ink-2);max-width:52ch;margin:0 0 30px;line-height:1.55}
.stats{display:flex;flex-wrap:wrap;gap:0;border:1px solid var(--line);border-radius:var(--r);
       background:color-mix(in srgb,var(--panel) 70%,transparent);width:fit-content;max-width:100%}
.stats div{padding:12px 22px;border-right:1px solid var(--line)}
.stats div:last-child{border-right:0}
.stats b{display:block;font:700 22px var(--mono);letter-spacing:-.03em}
.stats span{font:400 11px var(--mono);color:var(--dim);text-transform:uppercase;letter-spacing:.09em}
@media (max-width:520px){.stats div{padding:10px 14px}.stats b{font-size:18px}}

/* — filters — */
.bar{display:flex;align-items:center;justify-content:space-between;gap:16px;
     padding:22px 0 14px;border-bottom:1px solid var(--line);margin-bottom:22px;flex-wrap:wrap}
.bar h2{font:500 12px var(--mono);color:var(--dim);letter-spacing:.12em;text-transform:uppercase;margin:0}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{font:500 12px var(--mono);padding:5px 11px;border:1px solid var(--line);border-radius:999px;
      color:var(--dim);transition:all .15s;cursor:pointer;background:transparent}
.chip:hover{color:var(--ink);border-color:var(--line-2)}
.chip.on{color:var(--ink);border-color:var(--ink);background:var(--panel)}

/* — the lead story — */
.lead{
  display:block;position:relative;overflow:hidden;
  border:1px solid var(--line);border-radius:14px;padding:32px;margin-bottom:14px;
  background:linear-gradient(180deg,var(--panel),var(--bg-2));
  transition:border-color .2s,transform .2s;
}
.lead::before{
  content:"";position:absolute;inset:-1px;border-radius:14px;padding:1px;pointer-events:none;
  background:linear-gradient(120deg,var(--green),transparent 35%,transparent 65%,var(--pink));
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor;mask-composite:exclude;opacity:.55;transition:opacity .25s;
}
.lead:hover{transform:translateY(-2px)}
.lead:hover::before{opacity:1}
.lead .kicker{display:flex;gap:10px;align-items:center;margin-bottom:16px}
.lead h3{font-size:clamp(24px,3.6vw,36px);line-height:1.12;letter-spacing:-.035em;margin:0 0 14px;font-weight:600;max-width:24ch}
.lead p{color:var(--ink-2);font-size:17px;margin:0 0 20px;max-width:62ch}
.lead .go{font:500 13px var(--mono);color:var(--teal)}

/* — story grid — */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:12px}
.card{
  display:flex;flex-direction:column;gap:12px;padding:20px;
  border:1px solid var(--line);border-radius:var(--r);background:var(--panel);
  transition:border-color .18s,transform .18s,background .18s;position:relative;
}
.card:hover{border-color:var(--line-2);transform:translateY(-2px);background:var(--panel-2)}
.card h3{font-size:17px;line-height:1.32;letter-spacing:-.018em;margin:0;font-weight:600}
.card p{margin:0;color:var(--ink-2);font-size:14.5px;line-height:1.55}
.card .why{color:var(--dim);font-size:13.5px;border-left:2px solid var(--line-2);padding-left:11px}
.card .foot{margin-top:auto;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding-top:4px}

.k{font:500 11px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}
.tag{font:500 10.5px var(--mono);padding:3px 8px;border-radius:5px;letter-spacing:.05em;
     text-transform:uppercase;background:var(--panel-2);color:var(--dim);border:1px solid var(--line)}
.tag.agents{color:var(--teal);border-color:color-mix(in srgb,var(--teal) 35%,transparent);background:color-mix(in srgb,var(--teal) 9%,transparent)}
.tag.research{color:var(--green);border-color:color-mix(in srgb,var(--green) 35%,transparent);background:color-mix(in srgb,var(--green) 9%,transparent)}
.tag.policy,.tag.funding{color:var(--pink);border-color:color-mix(in srgb,var(--pink) 35%,transparent);background:color-mix(in srgb,var(--pink) 9%,transparent)}
.tag.deep{color:var(--ink);background:var(--ink);color:var(--bg);border-color:var(--ink)}
.sig{font:500 11px var(--mono);color:var(--dim)}

.dayhead{display:flex;align-items:baseline;gap:14px;margin:44px 0 16px}
.dayhead h2{font-size:22px;letter-spacing:-.03em;margin:0;font-weight:600}
.dayhead span{font:400 12px var(--mono);color:var(--dim)}
.dayhead::after{content:"";flex:1;height:1px;background:var(--line)}

/* — story page — */
.story{padding:56px 0 24px}
.crumb{font:500 12px var(--mono);color:var(--dim);margin-bottom:26px;display:inline-block}
.crumb:hover{color:var(--ink)}
.story h1{font-size:clamp(30px,5vw,46px);line-height:1.08;letter-spacing:-.04em;margin:14px 0 18px;font-weight:600}
.story .meta{display:flex;flex-wrap:wrap;gap:12px;align-items:center;font:400 12px var(--mono);color:var(--dim);
             padding-bottom:26px;border-bottom:1px solid var(--line);margin-bottom:34px}
.story .tldr{font-size:19px;line-height:1.55;color:var(--ink-2);margin:0 0 34px}
.sec{margin:0 0 30px}
.sec h2{font:500 12px var(--mono);letter-spacing:.13em;text-transform:uppercase;margin:0 0 12px;display:flex;gap:10px;align-items:center}
.sec h2::before{content:"";width:16px;height:1px;background:currentColor}
.sec.what h2{color:var(--green)} .sec.sowhat h2{color:var(--teal)}
.sec.caveats h2{color:var(--rose)} .sec.take h2{color:var(--pink)}
.sec p{margin:0;font-size:17px;line-height:1.7;color:var(--ink-2)}
.sec.caveats{border:1px solid color-mix(in srgb,var(--rose) 30%,transparent);
  background:color-mix(in srgb,var(--rose) 5%,transparent);border-radius:var(--r);padding:20px 22px}
.sec ul{margin:0;padding:0;list-style:none;display:grid;gap:8px}
.sec li{padding:11px 14px 11px 40px;border:1px solid var(--line);border-radius:8px;background:var(--panel);
        position:relative;font-size:15.5px;color:var(--ink-2)}
.sec li::before{content:"→";position:absolute;left:14px;color:var(--pink);font-family:var(--mono)}
.src-btn{display:inline-flex;align-items:center;gap:8px;font:500 13px var(--mono);
  padding:11px 18px;border:1px solid var(--line-2);border-radius:8px;transition:all .15s;margin-top:8px}
.src-btn:hover{border-color:var(--ink);background:var(--panel)}
.note{font:400 12px/1.6 var(--mono);color:var(--dim-2);margin-top:36px;padding-top:18px;border-top:1px dashed var(--line)}

/* — prose pages — */
.prose h1{font-size:clamp(32px,5vw,48px);letter-spacing:-.04em;line-height:1.08;margin:0 0 20px;font-weight:600}
.prose h2{font-size:22px;letter-spacing:-.025em;margin:40px 0 10px;font-weight:600}
.prose p,.prose li{color:var(--ink-2);font-size:17px;line-height:1.7}
.prose code{font:500 14px var(--mono);background:var(--panel);border:1px solid var(--line);padding:2px 6px;border-radius:5px}
.prose pre{font:400 13px/1.7 var(--mono);background:var(--panel);border:1px solid var(--line);
           border-radius:var(--r);padding:18px 20px;overflow-x:auto;color:var(--ink-2)}

footer.site{margin-top:90px;border-top:1px solid var(--line);padding:32px 0 56px;
            color:var(--dim);font-size:13px}
footer.site .in{display:flex;gap:20px;justify-content:space-between;flex-wrap:wrap}
footer.site p{margin:0;max-width:56ch;line-height:1.6}
footer.site a{color:var(--ink-2);text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--line-2)}
.empty{padding:70px 0;text-align:center;color:var(--dim);font:400 14px var(--mono)}

/* — motion: one entrance, and respect people who don't want it — */
@media (prefers-reduced-motion:no-preference){
  .rise{animation:rise .6s cubic-bezier(.2,.7,.2,1) both}
  @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  .grid .card:nth-child(1){animation-delay:.04s}.grid .card:nth-child(2){animation-delay:.08s}
  .grid .card:nth-child(3){animation-delay:.12s}.grid .card:nth-child(4){animation-delay:.16s}
  .grid .card:nth-child(5){animation-delay:.20s}.grid .card:nth-child(6){animation-delay:.24s}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}html{scroll-behavior:auto}}
`;
