/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Orbit Turbo: big downloads use several connections at once (like a
// download manager), which gets past servers that slow down each connection.
// Adaptive: the normal download runs first for a moment; if it is already fast
// (above the user's threshold) or nearly done, Turbo stays out of the way.
// Otherwise the normal download pauses (its data kept) while Turbo works, and
// resumes if Turbo fails. Needs a server that accepts byte ranges.
var OrbitDownloads = {
  CHUNK: 4 * 1024 * 1024, // write and concatenation step, keeps memory flat
  MEASURE_MS: 2500, // how long the normal download runs before deciding

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
    return Math.min(32, Math.max(2, Orbit.pref("orbit.downloads.connections", 8)));
  },

  // Turbo only when the normal download is slower than this (0 = always).
  get threshold() {
    return Math.max(0, Orbit.pref("orbit.downloads.turbo-below-mbps", 20)) * 1048576;
  },

  get minSize() {
    return Math.max(1, Orbit.pref("orbit.downloads.turbo-min-mb", 16)) * 1048576;
  },

  async init() {
    // Every window dresses its own downloads panel; the download list view
    // below is app-wide (first window only).
    window.addEventListener("popupshowing", e => e.target.id == "downloadsPanel" && this.panelHead(), true);
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
    // A download can be added before it starts: wait for its size.
    const over = () => download.succeeded || download.canceled || !!download.error;
    for (let i = 0; i < 40 && !(download.totalBytes > 0) && !over(); i++) await new Promise(r => setTimeout(r, 150));
    if (download.stopped || over() || !(download.totalBytes >= this.minSize)) return;
    // Let the normal download show its speed first.
    const t0 = Date.now();
    const b0 = download.currentBytes;
    await new Promise(r => setTimeout(r, this.MEASURE_MS));
    if (download.stopped || download.succeeded) return;
    const speed = (download.currentBytes - b0) / ((Date.now() - t0) / 1000);
    const left = download.totalBytes - download.currentBytes;
    if ((this.threshold && speed >= this.threshold) || left / Math.max(1, speed) < 6) return;
    const probe = await this.probe(url, download.totalBytes);
    if (!probe || download.stopped || download.succeeded) return;
    const target = download.target.path;
    const tmp = `${target}.orbit-turbo`;
    // Both at once would split the bandwidth: pause the normal one, keep its
    // data, and hide it from the panel while Turbo shows its own progress.
    download.tryToKeepPartialData = true;
    (this._paused ??= new Set()).add(download);
    await download.cancel().catch(() => {});
    this.hidePaused();
    let resumed = false;
    const resume = () => {
      if (resumed || download.succeeded) return;
      resumed = true;
      this._paused.delete(download);
      this.hidePaused();
      download.start().catch(() => {});
    };
    try {
      await this.turbo(url, tmp, probe.size, probe.validator);
      if (download.succeeded || window.closed) {
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
      await IOUtils.remove(tmp, { ignoreAbsent: true });
      // Cancelled from the Turbo card: the user wants no download at all.
      if (e?.name == "AbortError") {
        await download.finalize(true).catch(() => {});
        return;
      }
      console.error("Orbit Turbo", e);
      resume();
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
      // Stitch: the first part becomes the file, the others are appended.
      await IOUtils.move(parts[0].path, target);
      for (const p of parts.slice(1)) {
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
    // Few large writes instead of one per network packet (that capped speed).
    let pending = [];
    let pendingBytes = 0;
    const flush = async () => {
      if (!pendingBytes) return;
      const block = new Uint8Array(pendingBytes);
      let at = 0;
      for (const c of pending) {
        block.set(c, at);
        at += c.byteLength;
      }
      pending = [];
      pendingBytes = 0;
      await IOUtils.write(p.path, block, { mode: "append" });
    };
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      pending.push(value);
      pendingBytes += value.byteLength;
      p.got += value.byteLength;
      if (pendingBytes >= this.CHUNK) await flush();
    }
    await flush();
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

  // ---- downloads panel -------------------------------------------------------------
  // A header with Orbit Turbo's switch, then Turbo's running downloads.
  panelHead() {
    const body = document.querySelector("#downloadsPanel-mainView > .panel-view-body-unscrollable");
    if (!body) return null;
    let jobs = document.getElementById("orbit-dl-jobs");
    if (!jobs) {
      const h = Orbit.h.bind(Orbit);
      const sw = OrbitSettings.switch(this.enabled, on => Services.prefs.setBoolPref("orbit.downloads.turbo", on));
      body.prepend(
        h("div", { id: "orbit-dl-head" },
          h("b", {}, Orbit.tr("Downloads", "Téléchargements")),
          h("label", { class: "orbit-dl-turbo", title: Orbit.tr("Several connections for big downloads, only when it helps.",
            "Plusieurs connexions pour les gros téléchargements, seulement quand ça aide.") },
            Orbit.icon("zap"), h("span", {}, "Turbo"), sw),
          h("button", { class: "orbit-icon-button", title: Orbit.tr("Download settings", "Réglages des téléchargements"), onclick: () => {
            PanelMultiView.hidePopup(document.getElementById("downloadsPanel"));
            OrbitSettings.open("downloads");
          } }, Orbit.icon("settings-2"))),
        jobs = h("div", { id: "orbit-dl-jobs" }));
      Services.prefs.addObserver("orbit.downloads.turbo", this._turboObs = () => {
        sw.toggleAttribute("on", this.enabled);
        sw.setAttribute("aria-checked", String(this.enabled));
      });
      window.addEventListener("unload", () => Services.prefs.removeObserver("orbit.downloads.turbo", this._turboObs), { once: true });
    }
    this.hidePaused();
    return jobs;
  },

  // The normal download Turbo paused looks "cancelled" in the list: hidden meanwhile.
  hidePaused() {
    for (const el of document.querySelectorAll("#downloadsListBox > richlistitem")) {
      const d = el._shell?.download;
      if (d) el.hidden = !!this._paused?.has(d);
    }
  },

  // Turbo's progress: in the downloads panel, or a toast if the panel was never built.
  card(name, onCancel) {
    const h = Orbit.h.bind(Orbit);
    let stack = this.panelHead();
    if (!stack) stack = document.getElementById("orbit-toasts");
    if (!stack) document.body.append(stack = h("div", { id: "orbit-toasts" }));
    const bar = h("i");
    const info = h("span", {}, "…");
    const card = h("div", { class: stack.id == "orbit-dl-jobs" ? "orbit-dl-job orbit-turbo" : "orbit-toast orbit-turbo", role: "status" },
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
