/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Memory: adaptive sleep under memory pressure, an optional memory budget,
// the orbit://memoire sheet and an eco mode. Runs from one timer per window
// (60 s) plus the platform's "memory-pressure" notification.
var OrbitMemory = {
  init() {
    if (!this._watching) {
      this._watching = true;
      this.observe = this.observe.bind(this);
      Services.obs.addObserver(this.observe, "memory-pressure");
      window.addEventListener("unload", () => Services.obs.removeObserver(this.observe, "memory-pressure"), { once: true });
    }
    // One timer for the whole app. Each window would otherwise sleep the same tabs.
    if (this._timer) return;
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      if (win != window && win.OrbitMemory?._timer) return;
    }
    this._timer = setInterval(() => this.enforceBudget(), 60_000);
    window.addEventListener("unload", () => {
      clearInterval(this._timer);
      this._timer = null;
      for (const win of Services.wm.getEnumerator("navigator:browser")) {
        if (win != window && !win.closed) {
          win.OrbitMemory?.init();
          break;
        }
      }
    }, { once: true });
  },

  // Windows reports low memory: sleep everything idle for 2+ minutes.
  observe(_subject, topic) {
    if (topic != "memory-pressure") return;
    this.pressureUntil = Date.now() + 10 * 60_000;
    const n = this.sleepIdle(2 * 60_000);
    if (n >= 3) OrbitNotify.tabsSlept(n);
  },

  // Minutes before an idle tab sleeps; -1 = adaptive (shorter under pressure).
  idleMinutes() {
    const v = Orbit.pref("orbit.tabs.unload-after-minutes", -1);
    if (v != -1) return v;
    return Date.now() < (this.pressureUntil ?? 0) ? 3 : 15;
  },

  canSleep(tab) {
    const b = tab.linkedBrowser;
    return !(tab.selected || tab.closing || !tab.linkedPanel || tab.soundPlaying || tab.hasAttribute("pending") ||
      b?.docShellIsActive || b?._sharingState?.webRTC?.sharing ||
      // Gecko marks the tab with an attribute; sleeping it would close its Picture-in-Picture.
      tab.hasAttribute("pictureinpicture"));
  },

  sleepIdle(idleMs) {
    const cutoff = Date.now() - idleMs;
    let n = 0;
    for (const tab of gBrowser.tabs) {
      if (this.canSleep(tab) && tab.lastAccessed < cutoff && gBrowser.discardBrowser(tab)) n++;
    }
    return n;
  },

  // Sleep every background tab, then let Gecko give unused memory back.
  async freeNow() {
    const total = info => info.memory + info.children.reduce((a, c) => a + c.memory, 0);
    const before = total(await ChromeUtils.requestProcInfo());
    let slept = 0;
    for (const win of Services.wm.getEnumerator("navigator:browser")) slept += win.OrbitMemory?.sleepAll() ?? 0;
    await new Promise(resolve => Cc["@mozilla.org/memory-reporter-manager;1"]
      .getService(Ci.nsIMemoryReporterManager).minimizeMemoryUsage(resolve));
    return { slept, bytes: Math.max(0, before - total(await ChromeUtils.requestProcInfo())) };
  },

  sleepAll() {
    let n = 0;
    for (const tab of gBrowser.tabs) if (this.canSleep(tab) && gBrowser.discardBrowser(tab)) n++;
    return n;
  },

  // Total resident memory of Orbit (all processes) and a per-tab estimate:
  // a content process' memory shared evenly by the tabs it hosts.
  async measure() {
    const info = await ChromeUtils.requestProcInfo();
    const byPid = new Map(info.children.map(c => [c.pid, c.memory]));
    const total = info.memory + info.children.reduce((a, c) => a + c.memory, 0);
    const pidOf = tab => tab.linkedBrowser?.browsingContext?.currentWindowGlobal?.osPid ?? null;
    const counts = new Map();
    for (const tab of gBrowser.tabs) {
      const pid = tab.linkedPanel && !tab.hasAttribute("pending") ? pidOf(tab) : null;
      if (pid) counts.set(pid, (counts.get(pid) ?? 0) + 1);
    }
    const tabs = gBrowser.tabs.map(tab => {
      const pid = tab.linkedPanel && !tab.hasAttribute("pending") ? pidOf(tab) : null;
      return { tab, asleep: !pid, bytes: pid ? (byPid.get(pid) ?? 0) / counts.get(pid) : 0 };
    });
    return { total, ui: info.memory, tabs };
  },

  // Runs every minute from one window: idle sleep, then the memory budget.
  // The budget is measured again after each tab, because a shared process
  // does not shrink by that tab's share of its memory.
  async enforceBudget() {
    let slept = 0;
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      const mem = win.OrbitMemory;
      if (!mem) continue;
      const minutes = mem.idleMinutes();
      if (minutes > 0) slept += mem.sleepIdle(minutes * 60_000);
    }
    const budgetMb = Orbit.pref("orbit.memory.budget-mb", 0);
    let discarded = 0;
    if (budgetMb > 0) {
      const limit = budgetMb * 1024 * 1024;
      for (let i = 0; i < 30; i++) {
        const { total, next } = await this.oldestAwake();
        if (total <= limit || !next) break;
        if (!next.win.gBrowser.discardBrowser(next.tab)) break;
        discarded++;
      }
    }
    const n = slept + discarded;
    if (n >= 3) OrbitNotify.tabsSlept(n);
  },

  // Total memory, and the oldest tab that can sleep, across every window.
  async oldestAwake() {
    const info = await ChromeUtils.requestProcInfo();
    const total = info.memory + info.children.reduce((a, c) => a + c.memory, 0);
    let next = null;
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      const mem = win.OrbitMemory;
      if (!mem) continue;
      for (const tab of win.gBrowser.tabs) {
        if (!mem.canSleep(tab)) continue;
        if (!next || tab.lastAccessed < next.tab.lastAccessed) next = { tab, win };
      }
    }
    return { total, next };
  },

  // Eco mode: fewer content processes (after restart), still background,
  // smaller image cache.
  ECO_KEYS: ["dom.ipc.processCount", "image.mem.surfacecache.max_size_kb", "orbit.effects.nebula"],
  ECO_SAVED: "orbit.memory.eco-saved",

  setEco(on) {
    const p = Services.prefs;
    p.setBoolPref("orbit.memory.eco", on);
    if (on) {
      if (!p.prefHasUserValue(this.ECO_SAVED)) {
        const saved = {};
        for (const k of this.ECO_KEYS) saved[k] = p.prefHasUserValue(k) ? Orbit.pref(k) : null;
        p.setStringPref(this.ECO_SAVED, JSON.stringify(saved));
      }
      p.setIntPref("dom.ipc.processCount", 2);
      p.setIntPref("image.mem.surfacecache.max_size_kb", 131072);
      p.setBoolPref("orbit.effects.nebula", false);
    } else {
      let saved = {};
      try {
        saved = JSON.parse(Orbit.pref(this.ECO_SAVED, "{}"));
      } catch {}
      for (const k of this.ECO_KEYS) {
        const v = saved[k];
        if (v == null) {
          if (p.prefHasUserValue(k)) p.clearUserPref(k);
        } else if (typeof v == "boolean") p.setBoolPref(k, v);
        else p.setIntPref(k, v);
      }
      if (p.prefHasUserValue(this.ECO_SAVED)) p.clearUserPref(this.ECO_SAVED);
    }
  },

  // ---- performance presets ----------------------------------------------------------
  // Four planets, from fastest to lightest. Process counts apply after a restart.
  PRESETS: {
    mercure: {
      "dom.ipc.processCount": 8, "dom.ipc.processPrelaunch.enabled": true, "orbit.tabs.unload-after-minutes": 60,
      "orbit.memory.budget-mb": 0, "orbit.memory.eco": false, "orbit.effects.nebula": true, "orbit.effects.animations": true,
      "orbit.effects.grain": true, "image.mem.surfacecache.max_size_kb": 524288,
    },
    venus: {
      "dom.ipc.processCount": 4, "dom.ipc.processPrelaunch.enabled": false, "orbit.tabs.unload-after-minutes": -1,
      "orbit.memory.budget-mb": 0, "orbit.memory.eco": false, "orbit.effects.nebula": true, "orbit.effects.animations": true,
      "orbit.effects.grain": true, "image.mem.surfacecache.max_size_kb": 262144,
    },
    saturne: {
      "dom.ipc.processCount": 2, "dom.ipc.processPrelaunch.enabled": false, "orbit.tabs.unload-after-minutes": -1,
      "orbit.memory.budget-mb": 2048, "orbit.memory.eco": true, "orbit.effects.nebula": false, "orbit.effects.animations": true,
      "orbit.effects.grain": true, "image.mem.surfacecache.max_size_kb": 131072,
    },
    neptune: {
      "dom.ipc.processCount": 1, "dom.ipc.processPrelaunch.enabled": false, "orbit.tabs.unload-after-minutes": 5,
      "orbit.memory.budget-mb": 1024, "orbit.memory.eco": true, "orbit.effects.nebula": false, "orbit.effects.animations": false,
      "orbit.effects.grain": false, "image.mem.surfacecache.max_size_kb": 65536,
    },
  },

  applyPreset(id) {
    const p = Services.prefs;
    for (const [name, value] of Object.entries(this.PRESETS[id] ?? {})) {
      if (typeof value == "boolean") p.setBoolPref(name, value);
      else p.setIntPref(name, value);
    }
    p.setStringPref("orbit.performance.preset", id);
    if (p.prefHasUserValue(this.ECO_SAVED)) p.clearUserPref(this.ECO_SAVED);
  },

  fmt(bytes) {
    const mb = bytes / 1048576;
    return mb >= 1024 ? `${(mb / 1024).toFixed(1).replace(".", ",")} Go` : `${Math.round(mb)} Mo`;
  },

  // ---- orbit://memoire sheet --------------------------------------------------
  t(k) {
    const fr = Orbit.lang() == "fr";
    const S = {
      title: [Orbit.tr("Orbit uses", "Orbit utilise")],
      all: [Orbit.tr("Put all to sleep", "Tout mettre en veille")],
      sleep: [Orbit.tr("Sleep", "Mettre en veille")],
      active: [Orbit.tr("Active", "Actif")], asleep: [Orbit.tr("Asleep", "En veille")],
      tabs: [Orbit.tr("Active tabs", "Onglets actifs")], ui: [Orbit.tr("Orbit interface", "Interface Orbit")],
      budget: [Orbit.tr("MEMORY LIMIT", "PLAFOND MÉMOIRE")], off: [Orbit.tr("Off", "Désactivé")],
      budgetD: [Orbit.tr("Above it, the oldest tabs go to sleep.", "Au-delà, les onglets les plus anciens passent en veille.")],
      after: [Orbit.tr("SLEEP AFTER", "MISE EN VEILLE APRÈS")], adaptive: [Orbit.tr("Adaptive", "Adaptatif")],
      afterD: [Orbit.tr("Adaptive: shorter when memory runs low.", "Adaptatif : plus court quand Windows manque de mémoire.")],
      eco: [Orbit.tr("ECO MODE", "MODE ÉCO")],
      ecoD: [Orbit.tr("2 processes instead of 4 (next start), still background, smaller image cache.", "2 processus au lieu de 4 (au prochain démarrage), fond figé, cache d'images réduit.")],
      tab: [Orbit.tr("TAB", "ONGLET")], state: [Orbit.tr("STATE", "ÉTAT")], mem: [Orbit.tr("MEMORY", "MÉMOIRE")],
      playing: [Orbit.tr("Playing", "Son en cours")],
    };
    return S[k][0];
  },

  open() {
    this.close(true);
    const h = Orbit.h.bind(Orbit);
    const body = h("div", { class: "orbit-mem-body" });
    const sheet = h("div", { id: "orbit-memory", class: "orbit-sheet", onmousedown: e => e.target == sheet && this.close() },
      h("div", { class: "orbit-sheet-card orbit-mem-card" },
        h("div", { class: "orbit-settings-top" },
          h("div", { class: "orbit-sheet-kicker" }, "ORBIT://MEMOIRE"),
          h("button", { class: "orbit-icon-button", "aria-label": "Fermer", onclick: () => this.close() }, Orbit.icon("x"))),
        body));
    document.body.append(sheet);
    this._key = e => e.key == "Escape" && (e.preventDefault(), this.close());
    window.addEventListener("keydown", this._key, true);
    this.renderSheet(body, true);
    this._refresh = setInterval(() => this.renderSheet(body, false), 2500);
  },

  close(instant = false) {
    clearInterval(this._refresh);
    window.removeEventListener("keydown", this._key, true);
    const sheet = document.getElementById("orbit-memory");
    if (!sheet) return;
    if (instant) return sheet.remove();
    sheet.setAttribute("closing", "true");
    setTimeout(() => sheet.remove(), 180);
  },

  async renderSheet(body, full) {
    const h = Orbit.h.bind(Orbit);
    const { total, ui, tabs } = await this.measure();
    if (!body.isConnected) return;
    const awake = tabs.filter(t => !t.asleep);
    const tabBytes = awake.reduce((a, t) => a + t.bytes, 0);
    const head = h("div", { class: "orbit-mem-head" },
      h("div", {},
        h("div", { class: "orbit-mem-total" }, `${this.t("title")} `, h("span", { class: "orbit-key" }, this.fmt(total))),
        h("div", { class: "orbit-setting-desc" }, Orbit.tr(`${tabs.length} open tabs, ${tabs.length - awake.length} asleep: they use almost nothing.`, `${tabs.length} onglets ouverts, dont ${tabs.length - awake.length} en veille : ils ne consomment presque rien.`))),
      h("button", { class: "orbit-button primary", onclick: () => { this.sleepAll(); this.renderSheet(body, false); } }, this.t("all")));
    const pct = x => `${Math.max(2, Math.round((x / Math.max(total, 1)) * 100))}`;
    const bar = h("div", { class: "orbit-mem-bar" },
      h("span", { style: `flex: ${pct(tabBytes)}; background: var(--orbit-accent)` }),
      h("span", { style: `flex: ${pct(ui)}; background: color-mix(in oklch, var(--orbit-c1) 55%, var(--orbit-panel))` }),
      h("span", { style: `flex: ${pct(Math.max(0, total - tabBytes - ui))}; background: var(--orbit-active)` }));
    const legend = h("div", { class: "orbit-mem-legend" },
      h("span", {}, h("i", { style: "background: var(--orbit-accent)" }), `${this.t("tabs")} · ${this.fmt(tabBytes)}`),
      h("span", {}, h("i", { style: "background: color-mix(in oklch, var(--orbit-c1) 55%, var(--orbit-panel))" }), `${this.t("ui")} · ${this.fmt(ui)}`));
    const rows = h("div", { class: "orbit-mem-table" },
      h("div", { class: "orbit-mem-row orbit-mem-th" }, h("span", {}, this.t("tab")), h("span", {}, this.t("state")), h("span", {}, this.t("mem")), h("span")),
      ...tabs.sort((a, b) => b.bytes - a.bytes).slice(0, 40).map(({ tab, asleep, bytes }) =>
        h("div", { class: "orbit-mem-row", asleep },
          h("button", { class: "orbit-mem-name", onclick: () => { gBrowser.selectedTab = tab; this.close(); } },
            h("img", { src: tab.getAttribute("image") || "chrome://global/skin/icons/defaultFavicon.svg", alt: "" }),
            h("span", {}, tab.label)),
          h("span", { class: asleep ? "" : "orbit-mem-on" }, asleep ? this.t("asleep") : this.t("active")),
          h("span", {}, asleep ? "0 Mo" : this.fmt(bytes)),
          h("span", {}, tab.soundPlaying ? this.t("playing") : !asleep && this.canSleep(tab)
            ? h("button", { class: "orbit-button", onclick: () => { gBrowser.discardBrowser(tab); this.renderSheet(body, false); } }, this.t("sleep"))
            : null))));
    if (full || !body.querySelector(".orbit-mem-controls")) {
      const S = OrbitSettings;
      const minutes = Orbit.pref("orbit.tabs.unload-after-minutes", -1);
      const controls = h("div", { class: "orbit-mem-controls" },
        h("div", { class: "orbit-setting orbit-setting-col" },
          h("div", { class: "orbit-sheet-kicker" }, this.t("budget")),
          S.slider({ min: 0, max: 4096, step: 256, unit: " Mo", value: Orbit.pref("orbit.memory.budget-mb", 0),
            onInput: v => Services.prefs.setIntPref("orbit.memory.budget-mb", v) }),
          h("div", { class: "orbit-setting-desc" }, this.t("budgetD"))),
        h("div", { class: "orbit-setting orbit-setting-col" },
          h("div", { class: "orbit-sheet-kicker" }, this.t("after")),
          S.segmented([[5, "5 min"], [20, "20 min"], [60, "1 h"], [-1, this.t("adaptive")]], minutes,
            v => Services.prefs.setIntPref("orbit.tabs.unload-after-minutes", v)),
          h("div", { class: "orbit-setting-desc" }, this.t("afterD"))),
        h("div", { class: "orbit-setting orbit-setting-col" },
          h("div", { style: "display:flex;justify-content:space-between;align-items:center" },
            h("div", { class: "orbit-sheet-kicker" }, this.t("eco")),
            S.switch(Orbit.pref("orbit.memory.eco", false), on => this.setEco(on))),
          h("div", { class: "orbit-setting-desc" }, this.t("ecoD"))));
      body.replaceChildren(head, bar, legend, controls, rows);
    } else {
      body.replaceChild(head, body.querySelector(".orbit-mem-head"));
      body.replaceChild(bar, body.querySelector(".orbit-mem-bar"));
      body.replaceChild(legend, body.querySelector(".orbit-mem-legend"));
      body.replaceChild(rows, body.querySelector(".orbit-mem-table"));
    }
  },
};
