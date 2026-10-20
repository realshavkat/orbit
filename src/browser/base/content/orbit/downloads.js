/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// orbit://downloads: every download grouped by day, week and month, with
// search, filters, sorting, the file's folder and actions. Data comes from
// the OrbitDownloads actor; this page has no privileges of its own.
import { downloadGroup } from "./orbit-pure.mjs";

const $ = id => document.getElementById(id);
let S = {};
let lang = "en";
let items = new Map();
let filter = "all";

// Lucide icons, inline (this page cannot recolor icon files).
const ICONS = {
  open: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  retry: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  cancel: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  copy: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  source: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  remove: '<path d="M5 12h14"/>',
  delete: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
};

function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.innerHTML = ICONS[name];
  return svg;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function act(id, action) {
  document.dispatchEvent(new CustomEvent("OrbitDownloads:Act", { bubbles: true, detail: { id, action } }));
}

function size(bytes) {
  if (!bytes) return "";
  const units = lang.startsWith("fr") ? ["o", "Ko", "Mo", "Go", "To"] : ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${new Intl.NumberFormat(lang, { maximumFractionDigits: bytes < 10 && i ? 1 : 0 }).format(bytes)} ${units[i]}`;
}

function host(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// File type badge: the extension, colored by kind.
const KINDS = [
  [/^(zip|rar|7z|tar|gz|xz|bz2)$/, "#e3a33b"], [/^(exe|msi|msix|appx|bat|cmd)$/, "#4f8cff"],
  [/^(pdf)$/, "#ef4444"], [/^(png|jpe?g|gif|webp|svg|avif|heic|bmp|ico)$/, "#22c58b"],
  [/^(mp4|mkv|mov|webm|avi|m4v)$/, "#a66bff"], [/^(mp3|wav|flac|ogg|m4a|aac)$/, "#ff6bcb"],
  [/^(docx?|odt|rtf|txt|md)$/, "#5b8cff"], [/^(xlsx?|ods|csv)$/, "#2e9c56"], [/^(pptx?|odp|key)$/, "#ff8a3d"],
  [/^(iso|img|dmg)$/, "#8a8a99"], [/^(js|ts|py|json|html|css|java|c|cpp|rs|go)$/, "#f5c518"],
];

function badge(name) {
  const ext = (/\.([a-z0-9]{1,5})$/i.exec(name)?.[1] ?? "").toLowerCase();
  const b = el("span", "badge", ext.slice(0, 4).toUpperCase() || "•");
  b.style.setProperty("--c", KINDS.find(([re]) => re.test(ext))?.[1] ?? "#7c86ff");
  return b;
}

function groupLabel(key) {
  if (S[key]) return S[key];
  const [y, m] = key.split("-").map(Number);
  const label = new Intl.DateTimeFormat(lang, { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function timeOf(d, group) {
  const date = new Date(d.start);
  const t = new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit" }).format(date);
  if (group == "today" || group == "yesterday") return t;
  return `${new Intl.DateTimeFormat(lang, { weekday: group == "week" ? "long" : undefined, day: "numeric", month: "short" }).format(date)} · ${t}`;
}

function row(d, group) {
  const r = el("article", `item ${d.state}${d.exists || d.state != "done" ? "" : " missing"}`);
  r.tabIndex = 0;
  const info = el("div", "info");
  const name = el("div", "name", d.name);
  name.title = d.name;
  const meta = el("div", "meta");
  const parts = [];
  if (d.state == "running") {
    const pct = d.total ? Math.round((d.current / d.total) * 100) : null;
    parts.push(`${size(d.current)}${d.total ? ` / ${size(d.total)}` : ""}`, d.speed ? `${size(d.speed)}/s` : "", pct != null ? `${pct} %` : "");
  } else {
    parts.push(d.state == "done" ? (d.exists ? size(d.size || d.total) : S.missing) : S[d.state] ?? d.state);
  }
  parts.push(host(d.url), timeOf(d, group));
  meta.textContent = parts.filter(Boolean).join("  ·  ");
  const path = el("div", "path", d.dir);
  path.title = `${d.dir}\\${d.name}`;
  info.append(name, meta, path);
  if (d.state == "running" || d.state == "paused") {
    const bar = el("div", "progress");
    const fill = el("i");
    fill.style.width = d.total ? `${(d.current / d.total) * 100}%` : "30%";
    if (!d.total) bar.classList.add("unknown");
    bar.append(fill);
    info.append(bar);
  }
  const actions = el("div", "actions");
  const add = (action, title) => {
    const b = el("button", "icon");
    b.title = title;
    b.setAttribute("aria-label", title);
    b.append(icon(action));
    b.addEventListener("click", e => {
      e.stopPropagation();
      if (action == "delete" && !confirm(S.confirmDelete.replace("{name}", d.name))) return;
      act(d.id, action);
    });
    actions.append(b);
  };
  if (d.state == "done" && d.exists) add("open", S.open);
  if (d.exists || d.state == "running") add("folder", S.folder);
  if (d.state == "running") add("pause", S.pause);
  if (d.state == "running" || d.state == "paused") add("cancel", S.cancel);
  if (d.state == "failed" || d.state == "canceled" || d.state == "paused") add("retry", S.retry);
  add("copy", S.copy);
  add("source", S.source);
  add("remove", S.remove);
  if (d.state == "done" && d.exists) add("delete", S.delete);
  r.append(badge(d.name), info, actions);
  r.addEventListener("dblclick", () => d.state == "done" && d.exists && act(d.id, "open"));
  r.addEventListener("keydown", e => e.key == "Enter" && d.state == "done" && d.exists && act(d.id, "open"));
  return r;
}

const FILTERS = [["all", d => true], ["done", d => d.state == "done"], ["running", d => d.state == "running" || d.state == "paused"],
  ["failed", d => d.state == "failed" || d.state == "canceled"]];
const SORTS = {
  newest: (a, b) => b.start - a.start,
  oldest: (a, b) => a.start - b.start,
  size: (a, b) => (b.size || b.total) - (a.size || a.total),
  name: (a, b) => a.name.localeCompare(b.name, lang),
};

function render() {
  const q = $("q").value.trim().toLowerCase();
  const test = FILTERS.find(([k]) => k == filter)[1];
  const sort = $("sort").value;
  const shown = [...items.values()].filter(d => test(d) && (!q || `${d.name} ${d.url} ${d.dir}`.toLowerCase().includes(q))).sort(SORTS[sort]);
  const all = [...items.values()];
  const total = all.reduce((a, d) => a + (d.state == "done" ? d.size || d.total : 0), 0);
  $("stats").textContent = `${S.count.replace("{n}", all.length)}${total ? `  ·  ${size(total)}` : ""}`;
  for (const b of $("filters").children) b.toggleAttribute("active", b.dataset.f == filter);
  const list = $("list");
  list.replaceChildren();
  // Date groups only make sense in date order.
  const byDate = sort == "newest" || sort == "oldest";
  let current = null;
  let box = null;
  for (const d of shown) {
    const g = downloadGroup(d.start);
    if (!byDate) {
      if (!box) list.append((box = el("div", "group")));
    } else if (g != current) {
      current = g;
      const sec = el("div", "group");
      sec.append(el("h2", null, groupLabel(g)));
      list.append(sec);
      box = sec;
    }
    box.append(row(d, g));
  }
  $("empty").hidden = shown.length > 0;
  $("empty").textContent = items.size ? S.noMatch : S.empty;
}

function setup(data) {
  S = data.strings;
  lang = data.lang;
  document.documentElement.lang = lang;
  document.title = S.title;
  $("title").textContent = S.title;
  $("q").placeholder = S.search;
  const openDir = $("open-dir");
  openDir.append(icon("folder"), el("span", null, S.openDir));
  openDir.title = data.dir;
  openDir.onclick = () => act(0, "openDir");
  $("clear").textContent = S.clear;
  $("clear").onclick = () => confirm(S.confirmClear) && act(0, "clear");
  $("filters").replaceChildren(...FILTERS.map(([k]) => {
    const b = el("button", "chip", S[`f_${k}`]);
    b.dataset.f = k;
    b.onclick = () => {
      filter = k;
      render();
    };
    return b;
  }));
  $("sort").replaceChildren(...Object.keys(SORTS).map(k => {
    const o = el("option", null, S[`s_${k}`]);
    o.value = k;
    return o;
  }));
  $("sort").onchange = render;
  $("q").oninput = render;
  items = new Map(data.items.map(d => [d.id, d]));
  render();
  $("q").focus();
}

document.addEventListener("OrbitDownloads:Data", e => setup(e.detail));
document.addEventListener("OrbitDownloads:Changed", e => {
  for (const d of e.detail.items) items.set(d.id, d);
  render();
});
document.addEventListener("OrbitDownloads:Removed", e => {
  items.delete(e.detail.id);
  render();
});
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key == "f") {
    e.preventDefault();
    $("q").focus();
  }
});
document.dispatchEvent(new CustomEvent("OrbitDownloads:Ready", { bubbles: true }));
