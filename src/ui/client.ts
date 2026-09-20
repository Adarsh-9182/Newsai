/**
 * The site's only JavaScript, shipped as two static files: a tiny blocking
 * script that sets the theme before first paint, and app.js.
 *
 * The pages are complete without either. Reading, tags, the archive and RSS
 * never need a script; app.js adds the things a static page cannot know on
 * its own — who is signed in, what they saved — plus search and polish.
 *
 * It is kept as plain ES5-style JavaScript in a string on purpose. There is no
 * bundler in this project, and the file is served as-is under a Content
 * Security Policy of `script-src 'self'`, which is why nothing here is ever
 * inlined into a page. Every piece of text that came from a feed or a user is
 * written with textContent, never innerHTML, so a hostile story title is
 * inert by construction rather than by escaping.
 */

export const THEME_JS = `try{var t=localStorage.getItem("nai_theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export const APP_JS = String.raw`(function () {
  "use strict";
  var doc = document;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var state = { user: null, saved: null };

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function safeHref(u) { return /^(https?:\/\/|\/(?!\/))/.test(u) ? u : "#"; }
  function safeNext(n) { return n && /^\/(?!\/)/.test(n) ? n : "/account/"; }
  function stash(k, v) { try { v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function unstash(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } }

  var toastTimer;
  function toast(msg) {
    var t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("on"); }, 2400);
  }

  function api(method, path, body) {
    return fetch(path, {
      method: method,
      credentials: "same-origin",
      headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.message || "Something went wrong."); e.status = r.status; e.code = j.error; throw e; }
        return j;
      });
    });
  }

  // — theme —
  $$("[data-theme-toggle]").forEach(function (b) {
    b.addEventListener("click", function () {
      var next = doc.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      doc.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("nai_theme", next); } catch (e) {}
    });
  });

  // — spotlight: two CSS variables follow the pointer over any .spot —
  doc.addEventListener("pointermove", function (e) {
    var s = e.target.closest && e.target.closest(".spot");
    if (!s) return;
    var r = s.getBoundingClientRect();
    s.style.setProperty("--mx", (e.clientX - r.left) + "px");
    s.style.setProperty("--my", (e.clientY - r.top) + "px");
  }, { passive: true });

  // — the nav's account slot —
  var menu;
  function closeMenu() { if (menu) menu.hidden = true; }
  function renderAuth() {
    var slot = $("#auth");
    if (!slot) return;
    slot.textContent = "";
    if (menu) { menu.remove(); menu = null; }
    if (!state.user) {
      var next = location.pathname === "/" ? "" : "?next=" + encodeURIComponent(location.pathname);
      var a = el("a", "btn sm", "Sign in"); a.href = "/login/" + next;
      var b = el("a", "btn sm primary", "Get started"); b.href = "/signup/" + next;
      slot.appendChild(a); slot.appendChild(b);
      return;
    }
    var initial = (state.user.name || state.user.email || "?").trim().charAt(0);
    var av = el("button", "avatar", initial);
    av.type = "button"; av.setAttribute("aria-label", "Account menu"); av.setAttribute("aria-haspopup", "menu");
    slot.appendChild(av);
    menu = el("div", "menu"); menu.hidden = true; menu.setAttribute("role", "menu");
    menu.appendChild(el("div", "who", state.user.email));
    var acct = el("a", null, "Saved stories & feed"); acct.href = "/account/";
    var out = el("button", null, "Sign out"); out.type = "button";
    out.addEventListener("click", logout);
    menu.appendChild(acct); menu.appendChild(out);
    doc.querySelector("nav.top").appendChild(menu);
    av.addEventListener("click", function (e) { e.stopPropagation(); menu.hidden = !menu.hidden; });
  }
  doc.addEventListener("click", function (e) { if (menu && !menu.contains(e.target)) closeMenu(); });

  function logout() {
    api("POST", "/api/auth/logout", {}).catch(function () {}).then(function () {
      state.user = null; state.saved = null; stash("nai_user", null);
      location.href = "/";
    });
  }
  $$("[data-logout]").forEach(function (b) { b.addEventListener("click", logout); });

  // — saved stories —
  function paintSaves() {
    $$(".save").forEach(function (b) {
      b.setAttribute("aria-pressed", state.saved && state.saved[b.dataset.id] ? "true" : "false");
    });
  }
  doc.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".save");
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    if (!state.user) { location.href = "/login/?next=" + encodeURIComponent(location.pathname); return; }
    var id = b.dataset.id, was = !!(state.saved && state.saved[id]);
    state.saved = state.saved || {};
    if (was) delete state.saved[id]; else state.saved[id] = true;
    paintSaves();
    if (!was) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); }
    var req = was
      ? api("DELETE", "/api/saves?id=" + encodeURIComponent(id))
      : api("POST", "/api/saves", { storyId: id, title: b.dataset.title, url: b.dataset.url, source: b.dataset.source, slug: b.dataset.slug || null });
    req.then(function () { toast(was ? "Removed from saved" : "Saved"); }).catch(function (err) {
      if (was) state.saved[id] = true; else delete state.saved[id];
      paintSaves(); toast(err.message);
    });
  });

  // — following a topic, and the "for you" filter —
  function follows() { return (state.user && state.user.follows) || []; }
  function paintFollow() {
    $$("[data-follow]").forEach(function (b) {
      var on = follows().indexOf(b.dataset.follow) !== -1;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.textContent = (on ? "✓ Following " : "+ Follow ") + b.dataset.follow;
    });
  }
  function savePrefs(next) {
    return api("PUT", "/api/prefs", next).then(function (j) { state.user = j.user; stash("nai_user", j.user); return j.user; });
  }
  $$("[data-follow]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (!state.user) { location.href = "/login/?next=" + encodeURIComponent(location.pathname); return; }
      var t = b.dataset.follow, cur = follows().slice(), i = cur.indexOf(t);
      if (i === -1) cur.push(t); else cur.splice(i, 1);
      savePrefs({ follows: cur, digest: state.user.digest }).then(function () {
        paintFollow(); toast(i === -1 ? "Following " + t : "Unfollowed " + t);
      }).catch(function (e) { toast(e.message); });
    });
  });

  function paintForYou() {
    var chips = $("#filter-chips");
    if (!chips) return;
    var f = follows();
    var old = $(".chip.fy", chips); if (old) old.remove();
    $$("[data-tags]").forEach(function (c) { c.classList.remove("fy-hit"); c.hidden = false; });
    if (!f.length) return;
    var hit = function (c) { return (c.dataset.tags || "").split(" ").some(function (t) { return f.indexOf(t) !== -1; }); };
    $$("[data-tags]").forEach(function (c) { if (hit(c)) c.classList.add("fy-hit"); });
    var chip = el("button", "chip fy", "for you"); chip.type = "button";
    chip.addEventListener("click", function () {
      var on = chip.classList.toggle("on");
      $$("[data-tags]").forEach(function (c) { c.hidden = on && !hit(c); });
    });
    chips.insertBefore(chip, chips.firstChild);
  }

  // — newsletter —
  $$("[data-subscribe]").forEach(function (form) {
    var msg = form.nextElementSibling;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = $("input", form), btn = $("button", form);
      btn.disabled = true;
      api("POST", "/api/subscribe", { email: input.value }).then(function () {
        input.value = "";
        if (msg) { msg.textContent = "You're on the list."; msg.className = "fineprint ok"; }
      }).catch(function (err) {
        var closed = err.code === "no_database";
        if (msg) { msg.textContent = closed ? "Subscriptions open very soon — check back shortly." : err.message; msg.className = "fineprint err"; }
      }).then(function () { btn.disabled = false; });
    });
  });

  // — sign in / sign up —
  $$("[data-toggle-pw]").forEach(function (b) {
    b.addEventListener("click", function () {
      var i = b.parentNode.querySelector("input"), show = i.type === "password";
      i.type = show ? "text" : "password"; b.textContent = show ? "hide" : "show";
    });
  });
  var qNext = new URLSearchParams(location.search).get("next");
  $$("[data-keep-next]").forEach(function (a) { if (qNext) a.href += "?next=" + encodeURIComponent(qNext); });
  $$("[data-auth]").forEach(function (form) {
    var mode = form.dataset.auth, msg = $("[data-msg]", form), btn = $("button[type=submit]", form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      msg.textContent = ""; msg.className = "msg";
      var f = new FormData(form), body = { email: f.get("email"), password: f.get("password") };
      if (mode === "signup") body.name = f.get("name") || "";
      if (!/^\S+@\S+\.\S+$/.test(body.email || "")) { msg.textContent = "Enter a valid email address."; msg.className = "msg err"; return; }
      if (!body.password || body.password.length < 8) { msg.textContent = "Password must be at least 8 characters."; msg.className = "msg err"; return; }
      var label = btn.textContent; btn.disabled = true; btn.textContent = "";
      btn.appendChild(el("span", "spin"));
      api("POST", "/api/auth/" + mode, body).then(function (j) {
        stash("nai_user", j.user);
        msg.textContent = "Welcome — taking you in…"; msg.className = "msg ok";
        location.href = safeNext(qNext);
      }).catch(function (err) {
        msg.textContent = err.code === "no_database" ? "Accounts aren't switched on yet. Please check back soon." : err.message;
        msg.className = "msg err";
        btn.disabled = false; btn.textContent = label;
      });
    });
  });

  // — the account page —
  function initAccount() {
    var page = $("#account");
    if (!page) return;
    if (!state.user) { location.replace("/login/?next=/account/"); return; }
    $("#account-gate").hidden = true; page.hidden = false;
    var u = state.user;
    $("#acct-avatar").textContent = (u.name || u.email).trim().charAt(0);
    $("#acct-name").textContent = u.name || "Your account";
    $("#acct-email").textContent = u.email;

    var flagTimer, pending;
    function flag() { var f = $("#prefs-flag"); f.classList.add("on"); clearTimeout(flagTimer); flagTimer = setTimeout(function () { f.classList.remove("on"); }, 1600); }
    function commit() {
      clearTimeout(pending);
      pending = setTimeout(function () {
        var tags = $$("#follow-toggles .toggle").filter(function (b) { return b.getAttribute("aria-pressed") === "true"; }).map(function (b) { return b.dataset.tag; });
        savePrefs({ follows: tags, digest: $("#digest-switch").getAttribute("aria-checked") === "true" }).then(flag).catch(function (e) { toast(e.message); });
      }, 350);
    }
    $$("#follow-toggles .toggle").forEach(function (b) {
      b.setAttribute("aria-pressed", u.follows.indexOf(b.dataset.tag) !== -1 ? "true" : "false");
      b.addEventListener("click", function () { b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true"); commit(); });
    });
    var sw = $("#digest-switch");
    sw.setAttribute("aria-checked", u.digest ? "true" : "false");
    sw.addEventListener("click", function () { sw.setAttribute("aria-checked", sw.getAttribute("aria-checked") === "true" ? "false" : "true"); commit(); });

    var list = $("#saved-list");
    api("GET", "/api/saves").then(function (j) {
      list.textContent = "";
      $("#saved-count").textContent = j.saves.length ? j.saves.length + " saved" : "";
      if (!j.saves.length) { list.appendChild(el("p", "empty", "Nothing saved yet. Tap the bookmark on any story.")); return; }
      j.saves.forEach(function (s) {
        var row = el("div", "savedrow"), left = el("div");
        var a = el("a", "t", s.title); a.href = s.slug ? "/story/" + encodeURIComponent(s.slug) + "/" : safeHref(s.url);
        if (!s.slug) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
        left.appendChild(a); left.appendChild(el("span", "k", s.source));
        var rm = el("button", "btn sm", "Remove"); rm.type = "button";
        rm.addEventListener("click", function () {
          api("DELETE", "/api/saves?id=" + encodeURIComponent(s.storyId)).then(function () { row.remove(); toast("Removed"); }).catch(function (e) { toast(e.message); });
        });
        row.appendChild(left); row.appendChild(rm); list.appendChild(row);
      });
    }).catch(function (e) { list.textContent = ""; list.appendChild(el("p", "empty", e.message)); });
  }

  // — copy link —
  $$("[data-copy-link]").forEach(function (b) {
    b.addEventListener("click", function () {
      var done = function () { toast("Link copied"); };
      if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, function () { toast("Couldn't copy"); }); else toast("Couldn't copy");
    });
  });

  // — command palette —
  var pal = $("#palette"), input = $("#pal-input"), listEl = $("#pal-list");
  var index = null, results = [], active = 0, opener = null;
  var PAGES = [
    { t: "Today", u: "/", k: "page" }, { t: "Archive", u: "/archive/", k: "page" },
    { t: "How it works", u: "/about/", k: "page" }, { t: "Your account & saved stories", u: "/account/", k: "page" },
    { t: "RSS feed", u: "/feed.xml", k: "page" }
  ];
  var TAGS = ["agents", "research", "models", "tools", "infra", "funding", "policy", "india"].map(function (t) { return { t: "#" + t, u: "/tag/" + t + "/", k: "tag" }; });

  function loadIndex() {
    if (index) return Promise.resolve();
    return fetch("/search.json").then(function (r) { return r.json(); }).then(function (j) { index = j; }).catch(function () { index = []; });
  }
  function search(q) {
    q = q.trim().toLowerCase();
    var stories = (index || []).map(function (s) { return { t: s.t, sub: s.s, u: s.u, k: s.a ? "analysis" : s.k, hay: (s.t + " " + s.s + " " + s.g.join(" ") + " " + s.k).toLowerCase(), title: s.t.toLowerCase() }; });
    if (!q) return PAGES.concat(TAGS.slice(0, 4)).concat(stories.slice(0, 6));
    var terms = q.split(/\s+/);
    var scored = [];
    PAGES.concat(TAGS).forEach(function (p) { if (terms.every(function (t) { return p.t.toLowerCase().indexOf(t) !== -1; })) scored.push([3, p]); });
    stories.forEach(function (s) {
      if (!terms.every(function (t) { return s.hay.indexOf(t) !== -1; })) return;
      var score = terms.reduce(function (a, t) { return a + (s.title.indexOf(t) !== -1 ? 2 : 1); }, 0);
      scored.push([score, s]);
    });
    scored.sort(function (a, b) { return b[0] - a[0]; });
    return scored.slice(0, 30).map(function (x) { return x[1]; });
  }
  function draw() {
    listEl.textContent = "";
    if (!results.length) { listEl.appendChild(el("li", "pal-empty", "No matches. Try a tag like agents or infra.")); return; }
    results.forEach(function (r, i) {
      var li = el("li"); li.setAttribute("role", "presentation");
      var a = el("a"); a.href = safeHref(r.u); a.setAttribute("role", "option"); a.setAttribute("aria-selected", i === active ? "true" : "false");
      var left = el("div"); left.appendChild(el("div", "pt", r.t));
      if (r.sub) left.appendChild(el("span", "ps", r.sub));
      a.appendChild(left); a.appendChild(el("span", "pk", r.k));
      a.addEventListener("mousemove", function () { if (active !== i) { active = i; mark(); } });
      li.appendChild(a); listEl.appendChild(li);
    });
  }
  function mark() {
    $$("a", listEl).forEach(function (a, i) { a.setAttribute("aria-selected", i === active ? "true" : "false"); if (i === active) a.scrollIntoView({ block: "nearest" }); });
  }
  function openPal() {
    if (!pal) return;
    opener = doc.activeElement; pal.hidden = false; input.value = ""; active = 0;
    // Focus at once, not on a timer: keystrokes typed straight after opening
    // must land in the box, not on the page behind it.
    input.focus();
    loadIndex().then(function () { results = search(input.value); draw(); });
  }
  function closePal() { if (!pal || pal.hidden) return; input.blur(); pal.hidden = true; if (opener && opener.focus) opener.focus(); }
  if (pal) {
    $$("[data-open-palette]").forEach(function (b) { b.addEventListener("click", openPal); });
    pal.addEventListener("mousedown", function (e) { if (e.target === pal) closePal(); });
    input.addEventListener("input", function () { active = 0; results = search(input.value); draw(); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, results.length - 1); mark(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); mark(); }
      else if (e.key === "Enter" && results[active]) { e.preventDefault(); location.href = safeHref(results[active].u); }
    });
  }
  doc.addEventListener("keydown", function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((doc.activeElement || {}).tagName || "");
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); pal && pal.hidden ? openPal() : closePal(); }
    else if (e.key === "/" && !typing && pal && pal.hidden) { e.preventDefault(); openPal(); }
    else if (e.key === "Escape") { closePal(); closeMenu(); }
  });

  // — boot: paint from the cached session at once, then confirm with the server —
  state.user = unstash("nai_user");
  renderAuth(); paintFollow(); paintForYou();
  api("GET", "/api/me").then(function (j) {
    state.user = j.user; stash("nai_user", j.user);
  }, function () { /* no API (static preview, or accounts not switched on) — stay signed out */ state.user = null; })
  .then(function () {
    renderAuth(); paintFollow(); paintForYou(); initAccount();
    if (!state.user) return;
    return api("GET", "/api/saves").then(function (j) {
      state.saved = {}; j.saves.forEach(function (s) { state.saved[s.storyId] = true; }); paintSaves();
    });
  }).catch(function () {});
})();
`;
