/* Orbit Blocker popup: an on/off switch per site, the page's numbers and
 * quick tools. Drives uBO's own controls, so every change goes through its
 * normal code path; everything else lives on orbit-settings.html.
 * GPL-3.0 like the add-on. */
"use strict";
(function () {
  const lang = (navigator.language || "").split("-")[0];
  const fr = lang == "fr";
  const T = lang == "es"
    ? { on: "Protegido", onD: "Anuncios, rastreadores y software espía bloqueados en este sitio.", off: "Desactivado en este sitio",
      offD: "Este sitio se muestra sin bloqueo.", zap: "Ocultar un elemento", report: "Informar",
      advanced: "Modo avanzado", simple: "Modo simple", by: "Basado en uBlock Origin", na: "Nada que bloquear en esta página." }
    : lang == "de"
    ? { on: "Geschützt", onD: "Werbung, Tracker und Spyware sind auf dieser Seite blockiert.", off: "Auf dieser Seite aus",
      offD: "Diese Seite lädt ohne Blockierung.", zap: "Element ausblenden", report: "Melden",
      advanced: "Erweiterter Modus", simple: "Einfacher Modus", by: "Basiert auf uBlock Origin", na: "Auf dieser Seite gibt es nichts zu blockieren." }
    : lang == "pt"
    ? { on: "Protegido", onD: "Anúncios, rastreadores e spyware bloqueados neste site.", off: "Desativado neste site",
      offD: "Este site abre sem bloqueio.", zap: "Ocultar um elemento", report: "Relatar",
      advanced: "Modo avançado", simple: "Modo simples", by: "Baseado no uBlock Origin", na: "Nada para bloquear nesta página." }
    : lang == "it"
    ? { on: "Protetto", onD: "Pubblicità, traccianti e spyware bloccati su questo sito.", off: "Disattivato su questo sito",
      offD: "Questo sito si apre senza blocchi.", zap: "Nascondi un elemento", report: "Segnala",
      advanced: "Modalità avanzata", simple: "Modalità semplice", by: "Basato su uBlock Origin", na: "Niente da bloccare in questa pagina." }
    : lang == "ru"
    ? { on: "Защищено", onD: "Реклама, трекеры и шпионские программы на этом сайте заблокированы.", off: "Отключено на этом сайте",
      offD: "Сайт открывается без блокировки.", zap: "Скрыть элемент", report: "Сообщить",
      advanced: "Расширенный режим", simple: "Простой режим", by: "На основе uBlock Origin", na: "На этой странице нечего блокировать." }
    : lang == "uk"
    ? { on: "Захищено", onD: "Рекламу, трекери та шпигунські програми на цьому сайті заблоковано.", off: "Вимкнено на цьому сайті",
      offD: "Сайт відкривається без блокування.", zap: "Сховати елемент", report: "Повідомити",
      advanced: "Розширений режим", simple: "Простий режим", by: "На основі uBlock Origin", na: "На цій сторінці нічого блокувати." }
    : fr
    ? { on: "Protégé", onD: "Pubs, pisteurs et logiciels espions bloqués sur ce site.", off: "Désactivé sur ce site",
      offD: "Ce site s'affiche sans blocage.", zap: "Masquer un élément", report: "Signaler",
      advanced: "Mode avancé", simple: "Mode simple", by: "uBlock Origin · listes de Brave", na: "Rien à bloquer sur cette page." }
    : { on: "Protected", onD: "Ads, trackers and spyware are blocked on this site.", off: "Off on this site",
      offD: "This site loads without blocking.", zap: "Hide an element", report: "Report",
      advanced: "Advanced mode", simple: "Simple mode", by: "uBlock Origin · Brave's lists", na: "Nothing to block on this page." };
  const $ = s => document.querySelector(s);
  const el = (tag, props = {}, ...kids) => {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...kids);
    return e;
  };
  const X = fr
    ? { here: "bloqués ici", domains: "domaines", total: "au total", resume: "Réactiver la protection", settings: "Réglages du bloqueur", all: "Tous les réglages", stealthOn: "Furtif actif", stealthOff: "Furtif coupé",
      fresh: "listes à jour {ago}", now: "à l'instant",
      popups: "Bloquer les pop-ups", media: "Couper les grosses vidéos", js: "Couper JavaScript", paused: "En pause sur ce site",
      pausedD: "Ce site s'affiche sans blocage. Les autres restent protégés.", onD: "Pubs, pisteurs et messages anti-adblock bloqués sans que le site le voie." }
    : { here: "blocked here", domains: "domains", total: "in total", resume: "Turn protection back on", settings: "Blocker settings", all: "All settings", stealthOn: "Stealth on", stealthOff: "Stealth off",
      fresh: "lists updated {ago}", now: "just now",
      popups: "Block pop-ups", media: "Block large videos", js: "Turn off JavaScript", paused: "Paused on this site",
      pausedD: "This site loads without blocking. Other sites stay protected.", onD: "Ads, trackers and anti-adblock walls blocked without the site noticing." };
  const NS = "http://www.w3.org/2000/svg";
  const svg = (...paths) => {
    const s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("aria-hidden", "true");
    for (const d of paths) {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", d);
      s.append(p);
    }
    return s;
  };

  const on = () => !document.body.classList.contains("off");
  const host = () => $("#hostname")?.textContent.replace(/[­ ]/g, "").trim() ?? "";
  const stat = sel => ($(sel)?.textContent ?? "").trim().split(/,\s|\s\(|\s\/\s|\s(?:sur|of|out of|von|de|di|из|з|z)\s/)[0] || "0";

  const mark = el("img", { id: "ob-mark", src: "img/icon_64.png", alt: "" });
  const openSettings = e => {
    e?.preventDefault();
    browser.tabs.create({ url: browser.runtime.getURL("orbit-settings.html") });
    window.close();
  };
  const hostEl = el("span");
  const settings = el("a", { id: "ob-settings", href: "orbit-settings.html", title: X.settings, ariaLabel: X.settings, onclick: openSettings },
    svg("M20 7h-9", "M14 17H5", "M17 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", "M7 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"));
  const head = el("div", { id: "ob-head" }, mark, el("div", {}, el("b", { textContent: "Orbit Blocker" }), hostEl), settings);
  const sw = el("button", { className: "ob-switch", role: "switch", ariaLabel: "Orbit Blocker" });
  const title = el("b");
  const desc = el("span");
  const status = el("div", { id: "ob-status" }, el("div", { className: "ob-text" }, title, desc), sw);
  const num = () => el("b");
  const stats = [[num(), X.here], [num(), X.domains], [num(), X.total]];
  const statsEl = el("div", { id: "ob-stats" }, ...stats.map(([b, label]) => el("div", {}, b, el("span", { textContent: label }))));
  const actions = el("div", { id: "ob-actions" },
    el("button", { onclick: () => $("#gotoZap")?.click() },
      svg("M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"), T.zap),
    el("button", { onclick: () => $("#gotoReport")?.click() }, svg("M7.9 20A9 9 0 1 0 4 16.1L2 22Z"), T.report));
  const toggles = [["#no-popups", X.popups], ["#no-large-media", X.media], ["#no-scripting", X.js]].map(([sel, label]) => {
    const b = el("button", { className: "ob-mini", role: "switch", ariaLabel: label, onclick: () => {
      $(sel)?.click();
      setTimeout(paint, 80);
    } });
    return [sel, b, el("div", { className: "ob-row" }, el("span", { textContent: label }), b)];
  });
  const rows = el("div", { id: "ob-rows" }, ...toggles.map(t => t[2]));
  const resume = el("button", { id: "ob-resume", textContent: X.resume, onclick: () => sw.click() });
  const footText = el("span");
  const foot = el("div", { id: "ob-foot" }, el("i"), footText, el("button", { textContent: X.all, onclick: openSettings }));
  const shell = el("div", { id: "ob-shell" }, head, status, statsEl, actions, rows, resume);
  $("#main").prepend(shell);
  document.body.append(foot);

  const paint = () => {
    const h = host();
    const active = on() && !!h;
    document.body.classList.toggle("ob-paused", !!h && !on());
    hostEl.textContent = h;
    sw.setAttribute("aria-checked", String(active));
    sw.disabled = !h;
    title.textContent = !h ? "Orbit Blocker" : active ? T.on : X.paused;
    desc.textContent = !h ? T.na : active ? X.onD : X.pausedD;
    stats[0][0].textContent = stat('[data-i18n^="popupBlockedOnThisPage"] + span');
    stats[1][0].textContent = stat('[data-i18n^="popupDomainsConnected"] + span');
    stats[2][0].textContent = stat('[data-i18n^="popupBlockedSinceInstall"] + span');
    for (const [sel, b] of toggles) {
      b.setAttribute("aria-checked", String(!!$(sel)?.classList.contains("on")));
      b.disabled = !active;
    }
    mark.src = active ? "img/icon_64.png" : "img/icon_64-off.png";
  };
  sw.addEventListener("click", () => {
    $("#switch")?.click();
    setTimeout(paint, 60);
  });
  const mo = new MutationObserver(paint);
  mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  for (const sel of ["#hostname", "#basicStats", "#extraTools"]) {
    const node = $(sel);
    if (node) mo.observe(node, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
  }
  paint();
  vAPI.messaging.send("dashboard", { what: "getLists" }).then(L => {
    const keys = Object.keys(L.available).filter(k => L.available[k].off !== true);
    const last = Math.max(0, ...keys.map(k => L.cache?.[k]?.writeTime || 0));
    const sec = (Date.now() - last) / 1000;
    const rtf = new Intl.RelativeTimeFormat(navigator.language, { numeric: "auto" });
    const when = sec < 60 ? X.now : sec < 3600 ? rtf.format(-Math.round(sec / 60), "minute")
      : sec < 86400 ? rtf.format(-Math.round(sec / 3600), "hour") : rtf.format(-Math.round(sec / 86400), "day");
    const stealth = L.available["orbit-stealth"]?.off !== true;
    foot.classList.toggle("ob-weak", !stealth);
    footText.textContent = `${stealth ? X.stealthOn : X.stealthOff} · ${X.fresh.replace("{ago}", last ? when : "—")}`;
  }).catch(() => {});
})();
