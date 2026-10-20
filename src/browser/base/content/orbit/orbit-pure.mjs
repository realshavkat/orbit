/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Shared checks with no browser services, so tools/check-orbit.mjs can run them.

export const ASSISTANTS = [
  { name: "Claude", alias: "@claude", url: "https://claude.ai/new?q={searchTerms}", home: "https://claude.ai/new" },
  { name: "ChatGPT", alias: "@gpt", url: "https://chatgpt.com/?q={searchTerms}", home: "https://chatgpt.com" },
  { name: "Perplexity", alias: "@perplexity", url: "https://www.perplexity.ai/search?q={searchTerms}", home: "https://www.perplexity.ai" },
  { name: "Le Chat", alias: "@mistral", url: "https://chat.mistral.ai/chat?q={searchTerms}", home: "https://chat.mistral.ai/chat" },
];

// "socks5://host:port" | "http(s)://host:port" -> { kind, host, port } or null.
export function parseProxy(text) {
  const m = /^(socks5?|socks4|https?):\/\/\[?([\w.-]+|[0-9a-f:]+)\]?:(\d{1,5})\/?$/i.exec((text ?? "").trim());
  if (!m || +m[3] < 1 || +m[3] > 65535) return null;
  const scheme = m[1].toLowerCase();
  return { kind: scheme.startsWith("socks") ? (scheme == "socks4" ? "socks4" : "socks5") : "http", host: m[2], port: +m[3] };
}

// True only when a 206 body is exactly the byte range we asked for.
export function contentRange(header, from, to, total = null) {
  const m = /^bytes (\d+)-(\d+)\/(\d+|\*)$/i.exec(String(header ?? "").trim());
  if (!m || +m[1] != from || +m[2] != to) return false;
  return total == null || m[3] == "*" || +m[3] == total;
}

// Offset of the zip archive inside a .crx (v2 or v3).
export function zipOffset(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(...bytes.subarray(0, 4));
  if (magic == "PK\x03\x04") return 0;
  if (magic != "Cr24") throw new Error("not a crx");
  const version = view.getUint32(4, true);
  if (version == 3) return 12 + view.getUint32(8, true);
  if (version == 2) return 16 + view.getUint32(8, true) + view.getUint32(12, true);
  throw new Error(`crx v${version}`);
}

// Date group of a download for orbit://downloads: "today", "yesterday",
// "week" (last 7 days), "month" (this calendar month), else "YYYY-MM".
export function downloadGroup(time, now = Date.now()) {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  const start = day.getTime();
  if (time >= start) return "today";
  if (time >= start - 864e5) return "yesterday";
  if (time >= start - 6 * 864e5) return "week";
  const d = new Date(time);
  const n = new Date(now);
  if (d.getFullYear() == n.getFullYear() && d.getMonth() == n.getMonth()) return "month";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const ORBIT_ALIASES = {
  downloads: "orbit:downloads", telechargements: "orbit:downloads",
  home: "orbit:home", accueil: "orbit:home", memoire: "orbit:memory", memory: "orbit:memory",
  settings: "orbit:settings", preferences: "about:preferences", extensions: "about:addons",
  addons: "about:addons", credits: "orbit:about", about: "orbit:about",
};

export function resolveOrbitURL(text) {
  const m = /^orbit:(?:\/\/)?([\w-]+)(.*)$/i.exec(String(text ?? "").trim());
  if (!m) return null;
  const page = m[1].toLowerCase();
  const alias = ORBIT_ALIASES[page];
  return alias ? alias + (alias.startsWith("about:") ? m[2] : "") : `about:${page}${m[2]}`;
}

// One sRGB pixel (0-255 channels) as the color formats the picker offers.
export function colorFormats(r, g, b) {
  const hex = `#${[r, g, b].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
  const [R, G, B] = [r, g, b].map(v => v / 255);
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  let hue = 0;
  let s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    hue = max == R ? ((G - B) / d) % 6 : max == G ? (B - R) / d + 2 : (R - G) / d + 4;
    hue = (hue * 60 + 360) % 360;
  }
  // OKLCH from linear sRGB (Björn Ottosson's OKLab matrices).
  const [lr, lg, lb] = [R, G, B].map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const L = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const M = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const S = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const okL = 0.2104542553 * L + 0.793617785 * M - 0.0040720468 * S;
  const okA = 1.9779984951 * L - 2.428592205 * M + 0.4505937099 * S;
  const okB = 0.0259040371 * L + 0.7827717662 * M - 0.808675766 * S;
  const C = Math.hypot(okA, okB);
  const H = C < 2e-4 ? 0 : ((Math.atan2(okB, okA) * 180) / Math.PI + 360) % 360;
  return {
    hex,
    rgb: `rgb(${r}, ${g}, ${b})`,
    hsl: `hsl(${Math.round(hue)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`,
    oklch: `oklch(${+(okL * 100).toFixed(1)}% ${+C.toFixed(3)} ${+H.toFixed(1)})`,
  };
}
