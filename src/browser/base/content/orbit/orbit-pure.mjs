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

const ORBIT_ALIASES = {
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
