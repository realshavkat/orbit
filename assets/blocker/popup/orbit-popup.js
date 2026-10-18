/* Orbit Blocker popup: a simple on/off switch per site by default, uBO Lite's
 * full controls in advanced mode. Drives uBO Lite's own slider, so every
 * change goes through its normal code path. GPL-3.0 like the add-on. */
"use strict";
(function () {
  const lang = (navigator.language || "").split("-")[0];
  const fr = lang == "fr";
  const T = lang == "es"
    ? { on: "Protegido", onD: "Anuncios, rastreadores y software espía bloqueados en este sitio.", off: "Desactivado en este sitio",
      offD: "Este sitio se muestra sin bloqueo.", zap: "Ocultar un elemento", report: "Informar",
      advanced: "Modo avanzado", simple: "Modo simple", by: "Basado en uBO Lite", na: "Nada que bloquear en esta página." }
    : lang == "de"
    ? { on: "Geschützt", onD: "Werbung, Tracker und Spyware sind auf dieser Seite blockiert.", off: "Auf dieser Seite aus",
      offD: "Diese Seite lädt ohne Blockierung.", zap: "Element ausblenden", report: "Melden",
      advanced: "Erweiterter Modus", simple: "Einfacher Modus", by: "Basiert auf uBO Lite", na: "Auf dieser Seite gibt es nichts zu blockieren." }
    : lang == "pt"
    ? { on: "Protegido", onD: "Anúncios, rastreadores e spyware bloqueados neste site.", off: "Desativado neste site",
      offD: "Este site abre sem bloqueio.", zap: "Ocultar um elemento", report: "Relatar",
      advanced: "Modo avançado", simple: "Modo simples", by: "Baseado no uBO Lite", na: "Nada para bloquear nesta página." }
    : lang == "it"
    ? { on: "Protetto", onD: "Pubblicità, traccianti e spyware bloccati su questo sito.", off: "Disattivato su questo sito",
      offD: "Questo sito si apre senza blocchi.", zap: "Nascondi un elemento", report: "Segnala",
      advanced: "Modalità avanzata", simple: "Modalità semplice", by: "Basato su uBO Lite", na: "Niente da bloccare in questa pagina." }
    : lang == "ru"
    ? { on: "Защищено", onD: "Реклама, трекеры и шпионские программы на этом сайте заблокированы.", off: "Отключено на этом сайте",
      offD: "Сайт открывается без блокировки.", zap: "Скрыть элемент", report: "Сообщить",
      advanced: "Расширенный режим", simple: "Простой режим", by: "На основе uBO Lite", na: "На этой странице нечего блокировать." }
    : lang == "uk"
    ? { on: "Захищено", onD: "Рекламу, трекери та шпигунські програми на цьому сайті заблоковано.", off: "Вимкнено на цьому сайті",
      offD: "Сайт відкривається без блокування.", zap: "Сховати елемент", report: "Повідомити",
      advanced: "Розширений режим", simple: "Простий режим", by: "На основі uBO Lite", na: "На цій сторінці нічого блокувати." }
    : fr
    ? { on: "Protégé", onD: "Pubs, pisteurs et logiciels espions bloqués sur ce site.", off: "Désactivé sur ce site",
      offD: "Ce site s'affiche sans blocage.", zap: "Masquer un élément", report: "Signaler",
      advanced: "Mode avancé", simple: "Mode simple", by: "Basé sur uBO Lite", na: "Rien à bloquer sur cette page." }
    : { on: "Protected", onD: "Ads, trackers and spyware are blocked on this site.", off: "Off on this site",
      offD: "This site loads without blocking.", zap: "Hide an element", report: "Report",
      advanced: "Advanced mode", simple: "Simple mode", by: "Based on uBO Lite", na: "Nothing to block on this page." };
  const $ = s => document.querySelector(s);
  const el = (tag, props = {}, ...kids) => {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...kids);
    return e;
  };

  const slider = () => $(".filteringModeSlider");
  const level = () => parseInt(slider()?.dataset.level ?? "2", 10);
  const setLevel = l => slider()?.querySelector(`span[data-level="${l}"]`)?.click();
  const ADV = "orbit-blocker-advanced";
  const LAST = "orbit-blocker-last-level";

  const main = $("main");
  const head = el("div", { id: "ob-head" },
    el("img", { src: "img/icon_64.png", alt: "" }),
    el("div", {}, el("b", { textContent: "Orbit Blocker" }), el("small", { id: "ob-host" })));
  const sw = el("button", { className: "ob-switch", role: "switch" });
  const title = el("b");
  const desc = el("span");
  const simple = el("div", { id: "ob-simple" }, el("div", { className: "ob-text" }, title, desc), sw);
  const actions = el("div", { id: "ob-actions" },
    el("button", { textContent: T.zap, onclick: () => $("#gotoZapper")?.click() }),
    el("button", { textContent: T.report, onclick: () => $("#gotoReport")?.click() }));
  const modeBtn = el("button");
  const foot = el("div", { id: "ob-foot" }, el("span", { textContent: T.by }), modeBtn);
  main.prepend(head, simple, actions);
  document.body.append(foot);

  const advanced = () => localStorage.getItem(ADV) == "1";
  const paint = () => {
    const on = level() > 0;
    simple.dataset.on = String(on);
    sw.setAttribute("aria-checked", String(on));
    title.textContent = on ? T.on : T.off;
    desc.textContent = on ? T.onD : T.offD;
    document.body.classList.toggle("ob-advanced", advanced());
    modeBtn.textContent = advanced() ? T.simple : T.advanced;
    const host = $("#hostname")?.textContent.replace(/­/g, "").trim();
    $("#ob-host").textContent = host || "";
    sw.disabled = !host;
    if (!host) desc.textContent = T.na;
  };
  sw.addEventListener("click", () => {
    if (level() > 0) {
      localStorage.setItem(LAST, String(level()));
      setLevel(0);
    } else {
      setLevel(parseInt(localStorage.getItem(LAST) || "2", 10) || 2);
    }
    setTimeout(paint, 60);
  });
  modeBtn.addEventListener("click", () => {
    localStorage.setItem(ADV, advanced() ? "0" : "1");
    paint();
  });
  // uBO Lite fills the popup asynchronously: repaint whenever its state changes.
  const mo = new MutationObserver(paint);
  mo.observe(slider(), { attributes: true, attributeFilter: ["data-level"] });
  mo.observe($("#hostname"), { childList: true, subtree: true, characterData: true });
  paint();
})();
