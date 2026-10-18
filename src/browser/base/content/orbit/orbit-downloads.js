/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Orbit Turbo: big downloads use several connections at once (like a
// download manager), which gets past servers that slow down each connection.
// It only kicks in when the server accepts byte ranges; otherwise, or on any
// error, the normal download carries on. A global per-IP limit cannot be lifted.
var OrbitDownloads = {
  MIN_SIZE: 8 * 1024 * 1024, // smaller files are not worth splitting
  CHUNK: 4 * 1024 * 1024, // concatenation step, keeps memory flat

  t(k) {
    const fr = Orbit.lang() == "fr";
    return {
      turbo: "Orbit Turbo", cancel: Orbit.tr("Cancel", "Annuler"), done: Orbit.tr("Downloaded", "Téléchargé"),
      failed: Orbit.tr("Turbo unavailable, normal download.", "Turbo indisponible, téléchargement normal."),
      conn: Orbit.tr("connections", "connexions"),
    }[k];
  },

  get enabled() {
    return Orbit.pref("orbit.downloads.turbo", true);
  },

  get connections() {
    return Math.min(16, Math.max(2, Orbit.pref("orbit.downloads.connections", 8)));
  },

  async init() {
    if (this._view) return;
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      if (win != window && win.OrbitDownloads?._view) return;
    }
    const { Downloads } = ChromeUtils.importESModule("resource://gre/modules/Downloads.sys.mjs");
    this.Downloads = Downloads;
    this.list = await Downloads.getList(Downloads.ALL);
    if (window.closed) return;
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      if (win != window && win.OrbitDownloads?._view) return;
    }
    this._view = { onDownloadAdded: d => this.consider(d) };
    this.list.addView(this._view);
    window.addEventListener("unload", () => {
      if (this._view) this.list.removeView(this._view);
      this._view = null;
      for (const win of Services.wm.getEnumerator("navigator:browser")) {
        if (win != window && !win.closed) {
          win.OrbitDownloads?.init();
          break;
        }
      }
    }, { once: true });
  },

  // Takes over a fresh, public, plain GET download when the server allows ranges.
  // The original download keeps running until Turbo has the whole file.
  async consider(download) {
    if (!this.enabled || download.succeeded || download.source.isPrivate || this._ours?.has(download)) return;
    const url = download.source.url;
    if (!/^https?:/.test(url) || download.source.adjustChannel) return;
    for (let i = 0; i < 20 && !(download.totalBytes > 0) && !download.stopped; i++) await new Promise(r => setTimeout(r, 150));
    if (download.stopped || download.succeeded || !(download.totalBytes >= this.MIN_SIZE)) return;
    const probe = await this.probe(url, download.totalBytes);
    if (!probe) return;
    const target = download.target.path;
    const tmp = `${target}.orbit-turbo`;
    try {
      await this.turbo(url, tmp, probe.size, probe.validator);
      if (download.succeeded || download.canceled || window.closed) {
        await IOUtils.remove(tmp, { ignoreAbsent: true });
        return;
      }
      await download.finalize(true);
      await this.list.remove(download).catch(() => {});
      await IOUtils.remove(target, { ignoreAbsent: true });
      await IOUtils.move(tmp, target);
      const done = await this.Downloads.createDownload({ source: url, target, succeeded: true, totalBytes: probe.size });
      (this._ours ??= new WeakSet()).add(done);
      await this.list.add(done);
      await this.markDownloaded(done);
    } catch (e) {
      const dropped = download.stopped || download.succeeded || download.canceled;
      if (!dropped || e?.name == "AbortError") await IOUtils.remove(tmp, { ignoreAbsent: true });
      if (e?.name == "AbortError") return;
      console.error("Orbit Turbo", e);
      OrbitNotify.show({ kind: "turbo", icon: "download", title: this.t("turbo"), text: this.t("failed"), timeout: 4000 });
    }
  },

  // The normal download manager writes this mark. Turbo saves the file itself,
  // so it has to ask for the same one (Zone.Identifier on Windows).
  async markDownloaded(download) {
    try {
      const { DownloadIntegration } = ChromeUtils.importESModule("resource://gre/modules/DownloadIntegration.sys.mjs");
      await DownloadIntegration.downloadDone(download);
    } catch (e) {
      console.error("Orbit Turbo mark", e);
    }
  },

  // Range support check: a 1-byte request must come back 206 with the full size.
  async probe(url, expected) {
    try {
      const res = await fetch(url, { headers: { Range: "bytes=0-0" }, credentials: "include", cache: "no-store" });
      const range = res.headers.get("content-range");
      res.body?.cancel();
      const size = +(/\/(\d+)$/.exec(range ?? "")?.[1] ?? 0);
      const validator = res.headers.get("etag") || res.headers.get("last-modified") || "";
      if (res.status != 206 || !size || !validator || (expected > 0 && size != expected)) return null;
      if (!this.pure().contentRange(range, 0, 0, size)) return null;
      return { size, validator };
    } catch {
      return null;
    }
  },

  async turbo(url, target, size, validator) {
    const n = this.connections;
    const part = Math.ceil(size / n);
    const parts = Array.from({ length: n }, (_, i) => ({
      from: i * part, to: Math.min(size, (i + 1) * part) - 1, path: `${target}.orbit-part${i}`, got: 0,
    })).filter(p => p.from <= p.to);
    const ctrl = new AbortController();
    let card;
    try {
      card = this.card(PathUtils.filename(target).replace(/\.orbit-turbo$/, ""), () => ctrl.abort());
    } catch {
      card = { update() {}, done() {}, remove() {} };
    }
    const started = Date.now();
    const tick = setInterval(() => {
      const got = parts.reduce((a, p) => a + p.got, 0);
      card.update(got / size, got / Math.max(0.5, (Date.now() - started) / 1000), parts.length);
    }, 400);
    try {
      await Promise.all(parts.map(p => this.segment(url, p, validator, ctrl.signal, size)));
      // Stitch the parts in order, a few MB at a time.
      await IOUtils.write(target, new Uint8Array(0));
      for (const p of parts) {
        const len = p.to - p.from + 1;
        for (let off = 0; off < len; off += this.CHUNK) {
          const bytes = await IOUtils.read(p.path, { offset: off, maxBytes: Math.min(this.CHUNK, len - off) });
          await IOUtils.write(target, bytes, { mode: "append" });
        }
      }
      const { size: written } = await IOUtils.stat(target);
      if (written != size) throw new Error(`size mismatch ${written} != ${size}`);
      card.done(this.t("done"));
    } catch (e) {
      card.remove();
      await IOUtils.remove(target, { ignoreAbsent: true });
      if (ctrl.signal.aborted) throw new DOMException("aborted", "AbortError");
      throw e;
    } finally {
      clearInterval(tick);
      for (const p of parts) await IOUtils.remove(p.path, { ignoreAbsent: true });
    }
  },

  async segment(url, p, validator, signal, total) {
    await IOUtils.write(p.path, new Uint8Array(0));
    const headers = { Range: `bytes=${p.from}-${p.to}` };
    if (validator) headers["If-Range"] = validator;
    const res = await fetch(url, { headers, credentials: "include", cache: "no-store", signal });
    if (res.status != 206 || !this.pure().contentRange(res.headers.get("content-range"), p.from, p.to, total)) {
      res.body?.cancel();
      throw new Error(`segment ${p.from}: HTTP ${res.status}`);
    }
    const reader = res.body.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      await IOUtils.write(p.path, value, { mode: "append" });
      p.got += value.byteLength;
    }
    if (p.got != p.to - p.from + 1) throw new Error(`segment ${p.from}: short read`);
  },

  pure() {
    return ChromeUtils.importESModule("resource://orbit/orbit-pure.mjs");
  },

  fmtSpeed(bps) {
    const mb = bps / 1048576;
    const fr = Orbit.lang() == "fr";
    return mb >= 1 ? `${mb.toFixed(1).replace(".", Orbit.tr(".", ","))} ${Orbit.tr("MB", "Mo")}/s` : `${Math.round(bps / 1024)} ${Orbit.tr("KB", "Ko")}/s`;
  },

  // Progress card in the toast stack.
  card(name, onCancel) {
    const h = Orbit.h.bind(Orbit);
    let stack = document.getElementById("orbit-toasts");
    if (!stack) document.body.append(stack = h("div", { id: "orbit-toasts" }));
    const bar = h("i");
    const info = h("span", {}, "…");
    const card = h("div", { class: "orbit-toast orbit-turbo", role: "status" },
      h("div", { class: "orbit-toast-main" },
        h("span", { class: "orbit-toast-icon" }, Orbit.icon("zap")),
        h("div", { class: "orbit-toast-text" }, h("b", {}, name), info),
        h("button", { class: "orbit-toast-close", "aria-label": this.t("cancel"), onclick: () => { onCancel(); close(); } }, Orbit.icon("x"))),
      h("div", { class: "orbit-turbo-bar" }, bar));
    stack.append(card);
    const close = () => {
      card.setAttribute("closing", "true");
      setTimeout(() => card.remove(), 200);
    };
    return {
      update: (frac, bps, n) => {
        bar.style.transform = `scaleX(${Math.min(1, frac)})`;
        info.textContent = `${Math.round(frac * 100)} % · ${this.fmtSpeed(bps)} · ${this.t("turbo")} ×${n}`;
      },
      done: text => {
        bar.style.transform = "scaleX(1)";
        info.textContent = text;
        card.setAttribute("data-tone", "ok");
        setTimeout(close, 3000);
      },
      remove: close,
    };
  },
};
