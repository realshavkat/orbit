/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Memory: adaptive sleep under memory pressure, an optional memory budget,
// the orbit://memoire sheet and an eco mode. Runs from one timer per window
// (60 s) plus the platform's "memory-pressure" notification.
var OrbitMemory = {
  init() {
    this.observe = this.observe.bind(this);
    Services.obs.addObserver(this.observe, "memory-pressure");
    window.addEventListener("unload", () => Services.obs.removeObserver(this.observe, "memory-pressure"), { once: true });
    this._timer = setInterval(() => this.enforceBudget(), 60_000);
    window.addEventListener("unload", () => clearInterval(this._timer), { once: true });
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
      b?.docShellIsActive || b?._sharingState?.webRTC?.sharing || tab.pictureinpicture);
  },

  sleepIdle(idleMs) {
    const cutoff = Date.now() - idleMs;
    let n = 0;
    for (const tab of gBrowser.tabs) {
      if (this.canSleep(tab) && tab.lastAccessed < cutoff && gBrowser.discardBrowser(tab)) n++;
    }
    return n;
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

  // Runs every minute: idle sleep (unless set to "never"), then the memory budget.
  async enforceBudget() {
    const minutes = this.idleMinutes();
    if (minutes > 0) this.sleepIdle(minutes * 60_000);
    const budgetMb = Orbit.pref("orbit.memory.budget-mb", 0);
    if (budgetMb <= 0) return;
    let { total, tabs } = await this.measure();
    const limit = budgetMb * 1024 * 1024;
    if (total <= limit) return;
    let n = 0;
    for (const t of tabs.filter(t => !t.asleep && this.canSleep(t.tab)).sort((a, b) => a.tab.lastAccessed - b.tab.lastAccessed)) {
      if (total <= limit) break;
      if (gBrowser.discardBrowser(t.tab)) {
        total -= t.bytes;
        n++;
      }
    }
    if (n >= 3) OrbitNotify.tabsSlept(n);
  },

  // Eco mode: fewer content processes (after restart), still background,
  // smaller image cache.
  setEco(on) {
    const p = Services.prefs;
    p.setBoolPref("orbit.memory.eco", on);
    if (on) {
      p.setIntPref("dom.ipc.processCount", 2);
      p.setIntPref("image.mem.surfacecache.max_size_kb", 131072);
      p.setBoolPref("orbit.effects.nebula", false);
    } else {
      for (const k of ["dom.ipc.processCount", "image.mem.surfacecache.max_size_kb"]) p.clearUserPref(k);
      p.setBoolPref("orbit.effects.nebula", true);
    }
  },

  fmt(bytes) {
    const mb = bytes / 1048576;
    return mb >= 1024 ? `${(mb / 1024).toFixed(1).replace(".", ",")} Go` : `${Math.round(mb)} Mo`;
  },

  // ---- orbit://memoire sheet --------------------------------------------------
  t(k) {
    const fr = Orbit.lang() == "fr";
    const S = {
      title: [fr ? "Orbit utilise" : "Orbit uses"],
      all: [fr ? "Tout mettre en veille" : "Put all to sleep"],
      sleep: [fr ? "Mettre en veille" : "Sleep"],
      active: [fr ? "Actif" : "Active"], asleep: [fr ? "En veille" : "Asleep"],
      tabs: [fr ? "Onglets actifs" : "Active tabs"], ui: [fr ? "Interface Orbit" : "Orbit interface"],
      budget: [fr ? "PLAFOND MÉMOIRE" : "MEMORY LIMIT"], off: [fr ? "Désactivé" : "Off"],
      budgetD: [fr ? "Au-delà, les onglets les plus anciens passent en veille." : "Above it, the oldest tabs go to sleep."],
      after: [fr ? "MISE EN VEILLE APRÈS" : "SLEEP AFTER"], adaptive: [fr ? "Adaptatif" : "Adaptive"],
      afterD: [fr ? "Adaptatif : plus court quand Windows manque de mémoire." : "Adaptive: shorter when memory runs low."],
      eco: [fr ? "MODE ÉCO" : "ECO MODE"],
      ecoD: [fr ? "2 processus au lieu de 4 (au prochain démarrage), fond figé, cache d'images réduit." : "2 processes instead of 4 (next start), still background, smaller image cache."],
      tab: [fr ? "ONGLET" : "TAB"], state: [fr ? "ÉTAT" : "STATE"], mem: [fr ? "MÉMOIRE" : "MEMORY"],
      playing: [fr ? "Son en cours" : "Playing"],
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
        h("div", { class: "orbit-setting-desc" }, Orbit.lang() == "fr"
          ? `${tabs.length} onglets ouverts, dont ${tabs.length - awake.length} en veille : ils ne consomment presque rien.`
          : `${tabs.length} open tabs, ${tabs.length - awake.length} asleep: they use almost nothing.`)),
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
