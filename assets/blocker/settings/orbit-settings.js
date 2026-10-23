/* Orbit Blocker settings page. Talks to uBlock Origin's background through its
 * own dashboard messages, so every change takes uBO's normal code path.
 * GPL-3.0 like the add-on. */

const fr = (navigator.language || "").toLowerCase().startsWith("fr");
const T = fr ? {
  protection: "Protection", lists: "Listes de filtres", paused: "Sites en pause", rules: "Mes règles", about: "À propos",
  active: "Protection active", sinceInstall: "Bloqués depuis l'installation", rulesCount: "{n} règles chargées",
  protectionD: "Ce qu'Orbit Blocker fait sur toutes les pages.", update: "Mettre à jour les listes", updating: "Mise à jour…",
  stealth: "Mode furtif", stealthD: "Les pubs bloquées répondent comme si elles avaient chargé, et les pièges des anti-adblock restent en place. Les sites ne voient pas Orbit Blocker.",
  listsCard: "Listes", listsActive: "{n} actives · {r} règles", fresh: "À jour · {ago} · vérifiées automatiquement", never: "Jamais mises à jour",
  aggressive: "Masquage agressif", aggressiveD: "Cache aussi les emplacements de pub vides sur tous les sites. Plus propre, mais plus facile à détecter.",
  media: "Couper les grosses vidéos", mediaD: "Les médias de plus de 50 Ko attendent ton clic.",
  fonts: "Bloquer les polices distantes", fontsD: "Les pages utilisent les polices de ton PC. Plus rapide, parfois moins joli.",
  cname: "Démasquer les pisteurs cachés", cnameD: "Repère les pisteurs qui se font passer pour le site lui-même.",
  ping: "Bloquer les pings de liens", pingD: "Empêche les liens de prévenir un site quand tu cliques dessus.",
  autoUpdate: "Mettre à jour les listes toute seule", autoUpdateD: "Orbit Blocker récupère les nouvelles règles et les nouvelles listes en arrière-plan.",
  listsD: "Les listes disent quoi bloquer. Elles se mettent à jour toutes seules.", showAll: "Afficher les {n} autres", showLess: "Réduire",
  of: "{a} sur {b}", rulesN: "{n} règles", off: "—",
  g_default: "Orbit et uBlock", g_ads: "Publicités", g_privacy: "Vie privée", g_malware: "Sécurité", g_annoyances: "Bannières et gênes",
  g_multipurpose: "Polyvalentes", g_regions: "Régionales", g_custom: "Ajoutées", g_user: "Mes règles",
  pausedD: "Orbit Blocker ne bloque rien sur ces sites.", add: "Ajouter", addPh: "exemple.com", none: "Aucun site en pause.", remove: "Retirer",
  rulesD: "Une règle par ligne, au format uBlock Origin / Adblock Plus.", save: "Enregistrer", saved: "Enregistré", revert: "Annuler",
  aboutD: "Le bloqueur d'Orbit.", version: "Version {v}",
  credits: "Basé sur uBlock Origin de Raymond Hill (GPL-3.0). Listes : uBlock, EasyList, AdGuard, Brave, Fanboy, URLhaus et la liste Furtif d'Orbit.",
  license: "Licence et code source", ago_now: "à l'instant", orbitOnly: "Orbit Blocker ne fonctionne que dans Orbit.",
} : {
  protection: "Protection", lists: "Filter lists", paused: "Paused sites", rules: "My rules", about: "About",
  active: "Protection on", sinceInstall: "Blocked since install", rulesCount: "{n} rules loaded",
  protectionD: "What Orbit Blocker does on every page.", update: "Update lists", updating: "Updating…",
  stealth: "Stealth mode", stealthD: "Blocked ads answer as if they had loaded, and anti-adblock traps stay in place. Sites cannot see Orbit Blocker.",
  listsCard: "Lists", listsActive: "{n} on · {r} rules", fresh: "Up to date · {ago} · checked automatically", never: "Never updated",
  aggressive: "Aggressive hiding", aggressiveD: "Also hides empty ad slots on every site. Cleaner, but easier to detect.",
  media: "Block large videos", mediaD: "Media over 50 KB wait for your click.",
  fonts: "Block remote fonts", fontsD: "Pages use your PC's fonts. Faster, sometimes less pretty.",
  cname: "Uncloak hidden trackers", cnameD: "Spots trackers that pretend to be the site itself.",
  ping: "Block link pings", pingD: "Stops links from telling a site when you click them.",
  autoUpdate: "Update lists on its own", autoUpdateD: "Orbit Blocker fetches new rules and new lists in the background.",
  listsD: "Lists say what to block. They update on their own.", showAll: "Show {n} more", showLess: "Show less",
  of: "{a} of {b}", rulesN: "{n} rules", off: "—",
  g_default: "Orbit and uBlock", g_ads: "Ads", g_privacy: "Privacy", g_malware: "Security", g_annoyances: "Banners and annoyances",
  g_multipurpose: "Multipurpose", g_regions: "Regional", g_custom: "Added", g_user: "My rules",
  pausedD: "Orbit Blocker blocks nothing on these sites.", add: "Add", addPh: "example.com", none: "No paused site.", remove: "Remove",
  rulesD: "One rule per line, in uBlock Origin / Adblock Plus syntax.", save: "Save", saved: "Saved", revert: "Revert",
  aboutD: "Orbit's blocker.", version: "Version {v}",
  credits: "Based on uBlock Origin by Raymond Hill (GPL-3.0). Lists: uBlock, EasyList, AdGuard, Brave, Fanboy, URLhaus and Orbit's Stealth list.",
  license: "License and source code", ago_now: "just now", orbitOnly: "Orbit Blocker only works in Orbit.",
};
const t = (k, vars = {}) => (T[k] ?? k).replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? "");
const send = (what, more = {}) => vAPI.messaging.send("dashboard", { what, ...more });
const num = n => (typeof n == "number" ? n.toLocaleString(navigator.language) : "—");
const STEALTH = "orbit-stealth";
const GROUPS = ["default", "ads", "privacy", "malware", "annoyances", "multipurpose", "regions", "custom"];
const ICONS = {
  protection: ["M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z", "m9 12 2 2 4-4"],
  lists: ["M3 12h.01", "M3 18h.01", "M3 6h.01", "M8 12h13", "M8 18h13", "M8 6h13"],
  paused: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M10 15V9", "M14 15V9"],
  rules: ["m16 18 6-6-6-6", "m8 6-6 6 6 6"],
  about: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M12 16v-4", "M12 8h.01"],
  refresh: ["M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", "M21 3v5h-5", "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", "M8 16H3v5"],
  x: ["M18 6 6 18", "m6 6 12 12"],
};

const el = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (typeof v == "function") e.addEventListener(k.slice(2), v);
    else if (k == "class") e.className = v;
    else if (k == "text") e.textContent = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  e.append(...kids.flat().filter(k => k != null && k !== false));
  return e;
};
const NS = "http://www.w3.org/2000/svg";
const icon = name => {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  s.setAttribute("class", "i");
  for (const d of ICONS[name]) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    s.append(p);
  }
  return s;
};
const toggle = (on, label, change, disabled) => el("button", {
  class: "switch", role: "switch", "aria-checked": String(!!on), "aria-label": label, disabled,
  onclick: async e => {
    const b = e.currentTarget;
    const next = b.getAttribute("aria-checked") != "true";
    b.setAttribute("aria-checked", String(next));
    b.disabled = true;
    try {
      await change(next);
    } finally {
      b.disabled = false;
    }
  },
});
const ago = ms => {
  if (!ms) return t("never");
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return t("ago_now");
  const rtf = new Intl.RelativeTimeFormat(navigator.language, { numeric: "auto" });
  if (s < 3600) return rtf.format(-Math.round(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
  return rtf.format(-Math.round(s / 86400), "day");
};

const state = { lists: null, settings: null, expanded: new Set() };
const load = async () => {
  [state.lists, state.settings] = await Promise.all([send("getLists"), send("userSettings")]);
};
const selectedKeys = () => Object.entries(state.lists.available).filter(([, l]) => l.off !== true).map(([k]) => k);
const lastUpdate = () => Math.max(0, ...selectedKeys().map(k => state.lists.cache?.[k]?.writeTime || 0));
const setLists = async keys => {
  await send("applyFilterListSelection", { toSelect: keys, toImport: "", toRemove: [] });
  await send("reloadAllFilters");
  await load();
};
const setting = async (name, value) => {
  state.settings = await send("userSettings", { name, value });
};

const head = (title, desc, ...extra) => el("header", { class: "head" },
  el("div", {}, el("h1", { text: title }), el("p", { text: desc })), ...extra);
const row = (title, desc, on, change) => el("div", { class: "row" },
  el("div", {}, el("b", { text: title }), el("span", { text: desc })), toggle(on, title, change));

const updateButton = () => {
  const b = el("button", { class: "btn", onclick: async () => {
    b.disabled = true;
    b.lastChild.textContent = t("updating");
    document.body.classList.add("updating");
    await send("listsUpdateNow", { assetKeys: ["assets.json", ...selectedKeys()], preferOrigin: true });
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 1500));
      await load();
      if (!state.lists.isUpdating && i > 1) break;
    }
    document.body.classList.remove("updating");
    render();
  } }, icon("refresh"), el("span", { text: t("update") }));
  return b;
};

const pages = {
  protection() {
    const L = state.lists;
    const S = state.settings;
    const stealthOn = L.available[STEALTH]?.off !== true;
    const on = selectedKeys().filter(k => L.available[k].content == "filters").length;
    return [
      head(t("protection"), t("protectionD"), updateButton()),
      el("section", { class: "hero" },
        el("div", { class: "card stealth", on: stealthOn },
          el("div", { class: "card-top" }, el("b", { text: t("stealth") }),
            toggle(stealthOn, t("stealth"), async next => {
              const keys = new Set(selectedKeys());
              if (next) keys.add(STEALTH);
              else keys.delete(STEALTH);
              await setLists([...keys]);
              render();
            })),
          el("span", { text: t("stealthD") })),
        el("div", { class: "card" },
          el("small", { text: t("listsCard") }),
          el("b", { class: "big", text: t("listsActive", { n: on, r: num(L.netFilterCount + L.cosmeticFilterCount) }) }),
          el("span", { class: "fresh" }, el("i"), t("fresh", { ago: ago(lastUpdate()) })))),
      el("section", { class: "rows" },
        row(t("aggressive"), t("aggressiveD"), S.ignoreGenericCosmeticFilters !== true, async next => {
          await setting("ignoreGenericCosmeticFilters", !next);
          await send("reloadAllFilters");
        }),
        row(t("media"), t("mediaD"), S.noLargeMedia, next => setting("noLargeMedia", next)),
        row(t("fonts"), t("fontsD"), S.noRemoteFonts, next => setting("noRemoteFonts", next)),
        S.cnameUncloakEnabled !== undefined ? row(t("cname"), t("cnameD"), S.cnameUncloakEnabled, next => setting("cnameUncloakEnabled", next)) : null,
        row(t("ping"), t("pingD"), S.hyperlinkAuditingDisabled, next => setting("hyperlinkAuditingDisabled", next)),
        row(t("autoUpdate"), t("autoUpdateD"), S.autoUpdate, next => setting("autoUpdate", next))),
    ];
  },

  lists() {
    const L = state.lists;
    const by = new Map();
    for (const [key, l] of Object.entries(L.available)) {
      if (l.content != "filters" || key == L.userFiltersPath) continue;
      const g = GROUPS.includes(l.group) ? l.group : "custom";
      if (!by.has(g)) by.set(g, []);
      by.get(g).push([key, l]);
    }
    const toggleList = async (key, next) => {
      const keys = new Set(selectedKeys());
      if (next) keys.add(key);
      else keys.delete(key);
      await setLists([...keys]);
      render();
    };
    const groups = GROUPS.filter(g => by.has(g)).map(g => {
      const items = by.get(g).sort(([, a], [, b]) => (a.off === true) - (b.off === true) || a.title.localeCompare(b.title));
      const onCount = items.filter(([, l]) => l.off !== true).length;
      const long = items.length > 8 && !state.expanded.has(g);
      const shown = long ? items.filter(([, l]) => l.off !== true).concat(items.filter(([, l]) => l.off === true).slice(0, Math.max(0, 6 - onCount))) : items;
      const hidden = items.length - shown.length;
      return el("section", { class: "group" },
        el("div", { class: "group-head" }, el("b", { text: t(`g_${g}`) }), el("span", { text: t("of", { a: onCount, b: items.length }) })),
        shown.map(([key, l]) => el("div", { class: "list", off: l.off === true },
          el("div", {}, el("span", { class: "list-title", text: l.title }),
            key.startsWith("brave-") ? el("em", { text: "Brave" }) : null,
            key.startsWith("orbit-") ? el("em", { class: "orbit", text: "Orbit" }) : null),
          el("span", { class: "count", text: l.off === true ? t("off") : num(l.entryUsedCount ?? l.entryCount) }),
          toggle(l.off !== true, l.title, next => toggleList(key, next)))),
        hidden > 0 || state.expanded.has(g) ? el("button", { class: "more", onclick: () => {
          if (state.expanded.has(g)) state.expanded.delete(g);
          else state.expanded.add(g);
          render();
        } }, state.expanded.has(g) ? t("showLess") : t("showAll", { n: hidden })) : null);
    });
    return [head(t("lists"), t("listsD"), updateButton()), el("div", { class: "groups" }, groups)];
  },

  async paused() {
    const data = await send("getWhitelist");
    const all = (data.whitelist || []).filter(Boolean);
    const internal = all.filter(l => /-scheme$/.test(l));
    const lines = all.filter(l => !internal.includes(l));
    const save = async next => {
      await send("setWhitelist", { whitelist: [...internal, ...next].join("\n") });
      render();
    };
    const input = el("input", { type: "text", placeholder: t("addPh"), "aria-label": t("addPh"), spellcheck: "false" });
    const add = () => {
      const v = input.value.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (v && !lines.includes(v)) save([...lines, v]);
    };
    input.addEventListener("keydown", e => e.key == "Enter" && add());
    return [head(t("paused"), t("pausedD")),
      el("div", { class: "add" }, input, el("button", { class: "btn primary", onclick: add, text: t("add") })),
      el("section", { class: "rows" }, lines.length ? lines.map(h => el("div", { class: "row site" },
        el("b", { text: h }),
        el("button", { class: "icon-btn", "aria-label": `${t("remove")} ${h}`, title: t("remove"), onclick: () => save(lines.filter(x => x != h)) }, icon("x"))))
        : el("p", { class: "empty", text: t("none") }))];
  },

  async rules() {
    const data = await send("readUserFilters");
    const area = el("textarea", { spellcheck: "false", "aria-label": t("rules") });
    area.value = data.content || "";
    const status = el("span", { class: "status" });
    const saveBtn = el("button", { class: "btn primary", disabled: true, text: t("save"), onclick: async () => {
      saveBtn.disabled = true;
      await send("writeUserFilters", { content: area.value, enabled: true, trusted: data.trusted === true });
      await send("reloadAllFilters");
      status.textContent = t("saved");
      data.content = area.value;
    } });
    const revert = el("button", { class: "btn", text: t("revert"), onclick: () => {
      area.value = data.content || "";
      saveBtn.disabled = true;
    } });
    area.addEventListener("input", () => {
      saveBtn.disabled = area.value == (data.content || "");
      status.textContent = "";
    });
    return [head(t("rules"), t("rulesD")), area, el("div", { class: "actions" }, status, revert, saveBtn)];
  },

  about() {
    const v = browser.runtime.getManifest().version;
    return [head(t("about"), t("aboutD")),
      el("section", { class: "card about" },
        el("img", { src: "img/icon_64.png", alt: "" }),
        el("div", {}, el("b", { text: "Orbit Blocker" }), el("span", { text: t("version", { v }) }), el("p", { text: t("credits") }),
          el("a", { href: "LICENSE.txt", target: "_blank", text: t("license") })))];
  },
};

const nav = document.getElementById("nav");
const main = document.getElementById("main");
const current = () => (pages[location.hash.slice(1)] ? location.hash.slice(1) : "protection");
let renderId = 0;
async function render() {
  const id = ++renderId;
  const page = current();
  nav.replaceChildren(...Object.keys(pages).map(k => el("a", { href: `#${k}`, "aria-current": k == page ? "page" : null }, icon(k), t(k))));
  const content = await pages[page]();
  if (id != renderId) return;
  main.replaceChildren(...content);
  document.getElementById("total-rules").textContent = t("rulesCount", { n: num(state.lists.netFilterCount + state.lists.cosmeticFilterCount) });
}

async function start() {
  document.documentElement.lang = fr ? "fr" : "en";
  for (const n of document.querySelectorAll("[data-t]")) n.textContent = t(n.dataset.t);
  const info = await browser.runtime.getBrowserInfo().catch(() => ({ name: "" }));
  if (!/^Orbit/.test(info.name)) {
    main.replaceChildren(head("Orbit Blocker", t("orbitOnly")));
    return;
  }
  document.getElementById("brand-state").textContent = t("active");
  await load();
  window.addEventListener("hashchange", render);
  await render();
  const popup = await vAPI.messaging.send("popupPanel", { what: "getPopupData", tabId: -1 }).catch(() => null);
  if (popup?.globalBlockedRequestCount != null) document.getElementById("total-count").textContent = num(popup.globalBlockedRequestCount);
}
start();
