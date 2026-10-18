/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Orbit home: an unprivileged static page. The browser passes what it
// needs in the URL hash (name, search URL, shortcuts, language), so the
// page has no access to anything else.
"use strict";
const params = new URLSearchParams(location.hash.slice(1));
const fr = (params.get("lang") || navigator.language).startsWith("fr");
const T = fr
  ? { morning: "Bonjour", evening: "Bonsoir", night: "Bonne nuit", ph: "Rechercher, saisir une adresse ou demander à l'IA", ask: "Demander à" }
  : { morning: "Good morning", evening: "Good evening", night: "Good night", ph: "Search, type an address or ask AI", ask: "Ask" };
document.documentElement.lang = fr ? "fr" : "en";

const hour = new Date().getHours();
document.getElementById("hello").textContent = hour < 5 ? T.night : hour < 18 ? T.morning : T.evening;
const name = params.get("name") || "";
document.getElementById("name").textContent = name;
document.getElementById("comma").hidden = !name;

const dateEl = document.getElementById("date");
const tick = () => {
  const d = new Date();
  dateEl.textContent = d.toLocaleDateString(fr ? "fr-FR" : "en-US", { weekday: "long", day: "numeric", month: "long" }) +
    " · " + d.toLocaleTimeString(fr ? "fr-FR" : "en-US", { hour: "2-digit", minute: "2-digit" });
};
tick();
setInterval(tick, 30_000);

const q = document.getElementById("q");
q.placeholder = T.ph;
// The search URL template comes from the browser; only accept http(s).
const searchTpl = /^https:\/\//.test(params.get("s") || "") ? params.get("s") : "https://www.google.com/search?q={q}";
const looksLikeUrl = s => /^[a-z]+:\/\//i.test(s) || /^[^\s]+\.[a-z]{2,}(\/\S*)?$/i.test(s);
document.getElementById("search").addEventListener("submit", e => {
  e.preventDefault();
  const v = q.value.trim();
  if (!v) return;
  location.href = looksLikeUrl(v) ? (/^[a-z]+:\/\//i.test(v) ? v : `https://${v}`) : searchTpl.replace("{q}", encodeURIComponent(v));
});

const AI = [
  ["Claude", "https://claude.ai/new?q="],
  ["ChatGPT", "https://chatgpt.com/?q="],
  ["Perplexity", "https://www.perplexity.ai/search?q="],
  ["Le Chat", "https://chat.mistral.ai/chat?q="],
];
const ai = document.getElementById("ai");
for (const [label, url] of AI) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = `✦ ${label}`;
  b.title = `${T.ask} ${label}`;
  b.addEventListener("click", () => {
    const v = q.value.trim();
    location.href = v ? url + encodeURIComponent(v) : new URL(url).origin;
  });
  ai.append(b);
}

// Shortcuts: "title|url" pairs, http(s) only.
const tiles = document.getElementById("tiles");
for (const item of (params.get("t") || "").split("\n").filter(Boolean).slice(0, 6)) {
  const [title, url] = item.split("|");
  if (!/^https?:\/\//.test(url || "")) continue;
  const a = document.createElement("a");
  a.href = url;
  const ico = document.createElement("span");
  ico.className = "ico";
  // A letter instead of a remote favicon: the home page makes no network requests.
  ico.textContent = (title || new URL(url).hostname).trim().charAt(0).toUpperCase();
  const label = document.createElement("span");
  label.textContent = title || new URL(url).hostname;
  a.append(ico, label);
  tiles.append(a);
}
