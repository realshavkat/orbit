/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Orbit home (orbit://home): an unprivileged static page. Orbit's
// OrbitHome actor answers "OrbitHome:Ready" with the data it needs.
"use strict";
const STRINGS = {
  fr: { morning: "Bonjour", evening: "Bonsoir", night: "Bonne nuit", ph: "Rechercher, saisir une adresse ou demander à l'IA",
    ask: "Demander à", add: "Ajouter", remove: "Retirer", blocked: n => `${n} PISTEUR${n > 1 ? "S" : ""} BLOQUÉ${n > 1 ? "S" : ""} AUJOURD'HUI`,
    slept: n => `${n} ONGLET${n > 1 ? "S" : ""} EN VEILLE · MÉMOIRE LIBÉRÉE` },
  en: { morning: "Good morning", evening: "Good evening", night: "Good night", ph: "Search, type an address or ask AI",
    ask: "Ask", add: "Add", remove: "Remove", blocked: n => `${n} TRACKER${n > 1 ? "S" : ""} BLOCKED TODAY`,
    slept: n => `${n} TAB${n > 1 ? "S" : ""} ASLEEP · MEMORY FREED` },
  es: { morning: "Buenos días", evening: "Buenas tardes", night: "Buenas noches", ph: "Busca, escribe una dirección o pregunta a la IA",
    ask: "Preguntar a", add: "Añadir", remove: "Quitar", blocked: n => `${n} RASTREADOR${n > 1 ? "ES" : ""} BLOQUEADO${n > 1 ? "S" : ""} HOY`,
    slept: n => `${n} PESTAÑA${n > 1 ? "S" : ""} EN REPOSO · MEMORIA LIBERADA` },
  de: { morning: "Guten Morgen", evening: "Guten Abend", night: "Gute Nacht", ph: "Suchen, Adresse eingeben oder die KI fragen",
    ask: "Fragen:", add: "Hinzufügen", remove: "Entfernen", blocked: n => `${n} TRACKER HEUTE BLOCKIERT`,
    slept: n => `${n} TAB${n > 1 ? "S" : ""} SCHLAFEN · SPEICHER FREI` },
  pt: { morning: "Bom dia", evening: "Boa noite", night: "Boa noite", ph: "Pesquise, digite um endereço ou pergunte à IA",
    ask: "Perguntar a", add: "Adicionar", remove: "Remover", blocked: n => `${n} RASTREADOR${n > 1 ? "ES" : ""} BLOQUEADO${n > 1 ? "S" : ""} HOJE`,
    slept: n => `${n} ABA${n > 1 ? "S" : ""} EM REPOUSO · MEMÓRIA LIBERADA` },
  it: { morning: "Buongiorno", evening: "Buonasera", night: "Buonanotte", ph: "Cerca, scrivi un indirizzo o chiedi all'IA",
    ask: "Chiedi a", add: "Aggiungi", remove: "Rimuovi", blocked: n => `${n} TRACCIANT${n > 1 ? "I" : "E"} BLOCCAT${n > 1 ? "I" : "O"} OGGI`,
    slept: n => `${n} SCHED${n > 1 ? "E" : "A"} SOSPES${n > 1 ? "E" : "A"} · MEMORIA LIBERATA` },
  ru: { morning: "Доброе утро", evening: "Добрый вечер", night: "Доброй ночи", ph: "Ищите, введите адрес или спросите ИИ",
    ask: "Спросить", add: "Добавить", remove: "Удалить", blocked: n => `ТРЕКЕРОВ ЗАБЛОКИРОВАНО СЕГОДНЯ: ${n}`,
    slept: n => `ВКЛАДОК СПИТ: ${n} · ПАМЯТЬ ОСВОБОЖДЕНА` },
  uk: { morning: "Доброго ранку", evening: "Добрий вечір", night: "Добраніч", ph: "Шукайте, введіть адресу або запитайте ШІ",
    ask: "Запитати", add: "Додати", remove: "Прибрати", blocked: n => `ТРЕКЕРІВ ЗАБЛОКОВАНО СЬОГОДНІ: ${n}`,
    slept: n => `ВКЛАДОК СПИТЬ: ${n} · ПАМ'ЯТЬ ЗВІЛЬНЕНО` },
};
let lang = navigator.language.split("-")[0];
let fr = lang == "fr";
const $ = id => document.getElementById(id);
const T = () => STRINGS[lang] ?? STRINGS.en;

const AI = [
  ["Claude", "https://claude.ai/new?q="],
  ["ChatGPT", "https://chatgpt.com/?q="],
  ["Perplexity", "https://www.perplexity.ai/search?q="],
  ["Mistral", "https://chat.mistral.ai/chat?q="],
];
let searchTpl = "https://www.google.com/search?q={q}";

const q = $("q");
const looksLikeUrl = s => /^[a-z]+:\/\//i.test(s) || /^[^\s]+\.[a-z]{2,}(\/\S*)?$/i.test(s);
const go = url => (location.href = url);
$("search").addEventListener("submit", e => {
  e.preventDefault();
  const v = q.value.trim();
  if (!v) return;
  go(looksLikeUrl(v) ? (/^[a-z]+:\/\//i.test(v) ? v : `https://${v}`) : searchTpl.replace("{q}", encodeURIComponent(v)));
});
// Tab sends the question to the first assistant (Claude).
q.addEventListener("keydown", e => {
  if (e.key == "Tab" && !e.shiftKey && q.value.trim()) {
    e.preventDefault();
    go(AI[0][1] + encodeURIComponent(q.value.trim()));
  }
});

function render(data = {}) {
  if (data.lang) {
    lang = data.lang;
    fr = lang == "fr";
  }
  const t = T();
  document.documentElement.lang = STRINGS[lang] ? lang : "en";
  if (/^https:\/\//.test(data.search || "")) searchTpl = data.search;
  const hour = new Date().getHours();
  $("hello").textContent = hour < 5 ? t.night : hour < 18 ? t.morning : t.evening;
  $("name").textContent = data.name || "";
  $("comma").hidden = !data.name;
  q.placeholder = t.ph;

  const ai = $("ai");
  ai.replaceChildren();
  for (const [label, url] of AI) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `✦ ${label}`;
    b.title = `${t.ask} ${label}`;
    b.addEventListener("click", () => {
      const v = q.value.trim();
      go(v ? url + encodeURIComponent(v) : new URL(url).origin);
    });
    ai.append(b);
  }

  const tiles = $("tiles");
  tiles.replaceChildren();
  for (const { title, url } of (data.tiles || []).slice(0, 5)) {
    if (!/^https?:\/\//.test(url)) continue;
    const a = document.createElement("a");
    a.href = url;
    a.className = "tile";
    const ico = document.createElement("span");
    ico.className = "ico";
    // A letter instead of a remote favicon: the home page makes no network requests.
    ico.textContent = (title || new URL(url).hostname).trim().charAt(0).toUpperCase();
    const label = document.createElement("span");
    label.textContent = title || new URL(url).hostname;
    const x = document.createElement("button");
    x.className = "x";
    x.type = "button";
    x.title = t.remove;
    x.textContent = "×";
    x.addEventListener("click", e => {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent("OrbitHome:RemoveTile", { detail: url, bubbles: true }));
    });
    a.append(ico, label, x);
    tiles.append(a);
  }
  const add = document.createElement("button");
  add.type = "button";
  add.className = "tile add";
  add.innerHTML = '<span class="ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span><span></span>';
  add.lastChild.textContent = t.add;
  add.addEventListener("click", () => document.dispatchEvent(new CustomEvent("OrbitHome:AddTile", { bubbles: true })));
  tiles.append(add);

  $("stat-blocked").textContent = data.blocked ? t.blocked(data.blocked) : "";
  $("stat-slept").textContent = data.slept ? t.slept(data.slept) : "";
}

const dateEl = $("date");
const tick = () => {
  const d = new Date();
  const loc = { fr: "fr-FR", es: "es-ES", de: "de-DE", pt: "pt-BR", it: "it-IT", ru: "ru-RU", uk: "uk-UA" }[lang] ?? "en-US";
  dateEl.textContent = d.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" }) +
    " · " + d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
};
tick();
setInterval(tick, 30_000);

render();
document.addEventListener("OrbitHome:Data", e => {
  render(e.detail);
  tick();
});
document.dispatchEvent(new CustomEvent("OrbitHome:Ready", { bubbles: true }));
