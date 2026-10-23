/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var OrbitSecurity = {
  PREF: "orbit.security.fortress",
  SAVED: "orbit.security.saved",
  FORTRESS: {
    "privacy.resistFingerprinting": true,
    "fission.webContentIsolationStrategy": 1,
    "dom.ipc.processCount.webIsolated": 4,
    "webgl.disabled": true,
    "media.peerconnection.enabled": false,
    "browser.contentblocking.category": "strict",
    "dom.security.https_only_mode": true,
    "javascript.options.ion": false,
    "javascript.options.baselinejit": false,
    "javascript.options.native_regexp": false,
    "geo.enabled": false,
    "network.http.referer.XOriginPolicy": 2,
    "security.ssl.require_safe_negotiation": true,
    "privacy.firstparty.isolate": false,
    "browser.formfill.enable": false,
    "signon.autofillForms": false,
  },

  get on() {
    return Orbit.pref(this.PREF, false);
  },

  read(name) {
    const p = Services.prefs;
    if (!p.prefHasUserValue(name)) return null;
    return Orbit.pref(name);
  },

  write(name, value) {
    const p = Services.prefs;
    if (value === null || value === undefined) p.clearUserPref(name);
    else if (typeof value == "boolean") p.setBoolPref(name, value);
    else if (typeof value == "number") p.setIntPref(name, value);
    else p.setStringPref(name, value);
  },

  set(on) {
    if (on == this.on) return;
    const p = Services.prefs;
    if (on) {
      const saved = {};
      for (const name of Object.keys(this.FORTRESS)) saved[name] = this.read(name);
      p.setStringPref(this.SAVED, JSON.stringify(saved));
      for (const [name, value] of Object.entries(this.FORTRESS)) this.write(name, value);
    } else {
      let saved = {};
      try {
        saved = JSON.parse(Orbit.pref(this.SAVED, "{}"));
      } catch {}
      for (const name of Object.keys(this.FORTRESS)) this.write(name, saved[name] ?? null);
      p.setStringPref("browser.contentblocking.category", saved["browser.contentblocking.category"] ?? "standard");
      p.clearUserPref(this.SAVED);
    }
    p.setBoolPref(this.PREF, on);
  },
};

var OrbitSitePerms = {
  CALL_SITES: ["https://discord.com", "https://meet.google.com", "https://teams.microsoft.com", "https://teams.live.com",
    "https://app.zoom.us", "https://web.whatsapp.com", "https://www.messenger.com", "https://app.slack.com"],
  DEVICES: [["microphone", "mic", "Microphone", "Micro"], ["camera", "video", "Camera", "Caméra"], ["screen", "monitor-up", "Screen", "Écran"]],

  init() {
    const urlbarBox = document.getElementById("identity-box");
    if (!urlbarBox || this.button) return;
    this.exemptCallSites();
    this.button = Orbit.h("button", { id: "orbit-perms-button", hidden: true,
      onclick: e => (e.stopPropagation(), this.toggle()),
      onmousedown: e => e.stopPropagation() });
    urlbarBox.after(this.button);
    this._update = () => this.update();
    gBrowser.tabContainer.addEventListener("TabSelect", this._update);
    gBrowser.tabContainer.addEventListener("TabAttrModified", this._update);
    this._progress = { onLocationChange: (b, p, r, uri, flags) => !(flags & Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT) && this.update() };
    gBrowser.addProgressListener(this._progress);
    this._perm = (subject, topic) => topic == "perm-changed" && this.update();
    Services.obs.addObserver(this._perm, "perm-changed");
    navigator.mediaDevices?.addEventListener("devicechange", () => (this._hw = null, this.update()));
    window.addEventListener("unload", () => {
      Services.obs.removeObserver(this._perm, "perm-changed");
      gBrowser.removeProgressListener(this._progress);
    }, { once: true });
    this.update();
  },

  exemptCallSites() {
    if (Orbit.pref("orbit.calls.exempted", 0) >= 1) return;
    for (const origin of this.CALL_SITES) {
      const principal = Services.scriptSecurityManager.createContentPrincipalFromOrigin(origin);
      if (Services.perms.testExactPermissionFromPrincipal(principal, "trackingprotection") == Services.perms.UNKNOWN_ACTION) {
        Services.perms.addFromPrincipal(principal, "trackingprotection", Services.perms.ALLOW_ACTION);
      }
    }
    Services.prefs.setIntPref("orbit.calls.exempted", 1);
  },

  sharing(tab = gBrowser.selectedTab) {
    const s = tab ? gBrowser.getTabSharingState(tab) : {};
    return { microphone: !!s.microphone, camera: !!s.camera, screen: !!s.screen };
  },

  principal() {
    const p = gBrowser.selectedBrowser?.contentPrincipal;
    return p && /^https?$/.test(p.URI?.scheme ?? "") ? p : null;
  },

  async devices() {
    if (this._hw && Date.now() - this._hw.at < 30_000) return this._hw;
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      this._hw = { at: Date.now(), microphone: list.some(d => d.kind == "audioinput"), camera: list.some(d => d.kind == "videoinput") };
    } catch {
      this._hw = { at: Date.now(), microphone: true, camera: true };
    }
    return this._hw;
  },

  state(principal, id) {
    return SitePermissions.getForPrincipal(principal, id, gBrowser.selectedBrowser).state;
  },

  ready(principal, hw) {
    const S = SitePermissions;
    const browser = gBrowser.selectedBrowser;
    return hw.microphone && this.state(principal, "microphone") == S.ALLOW && this.state(principal, "camera") == S.ALLOW &&
      (!ContentBlockingAllowList.canHandle(browser) || ContentBlockingAllowList.includes(browser));
  },

  async update() {
    if (!this.button) return;
    const principal = this.principal();
    this.button.hidden = !principal;
    if (!principal) return this.close();
    const h = Orbit.h.bind(Orbit);
    const tr = Orbit.tr.bind(Orbit);
    const S = SitePermissions;
    const live = this.sharing();
    const hw = await this.devices();
    if (this.principal()?.origin != principal.origin) return;
    const using = ["microphone", "camera", "screen"].filter(k => live[k]);
    const blocked = this.state(principal, "microphone") == S.BLOCK;
    const allowed = this.state(principal, "microphone") == S.ALLOW || this.state(principal, "camera") == S.ALLOW;
    const tone = using.length ? "live" : !hw.microphone || blocked ? "warn" : allowed ? "ok" : "";
    this.button.setAttribute("tone", tone);
    const icons = { microphone: "mic", camera: "video", screen: "monitor-up" };
    if (tone == "live") this.button.replaceChildren(h("i"), ...using.map(k => Orbit.icon(icons[k])));
    else if (tone == "warn") this.button.replaceChildren(Orbit.icon("mic-off"), h("span", {}, tr("Mic", "Micro")));
    else this.button.replaceChildren(Orbit.icon("mic"));
    const label = tone == "live" ? tr(`${principal.host} is using your devices`, `${principal.host} utilise tes appareils`)
      : tone == "warn" ? tr(`The microphone does not work on ${principal.host}`, `Le micro ne marche pas sur ${principal.host}`)
      : tr(`Microphone, camera and screen for ${principal.host}`, `Micro, caméra et écran pour ${principal.host}`);
    this.button.setAttribute("aria-label", label);
    this.button.setAttribute("tooltiptext", label);
    if (this.panel && this.panel.dataset.origin != principal.origin) this.close();
    else if (this.panel) this.render();
  },

  openWindowsSettings(page) {
    const exe = Services.dirsvc.get("WinD", Ci.nsIFile);
    exe.append("explorer.exe");
    const proc = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
    proc.init(exe);
    proc.runAsync([`ms-settings:privacy-${page}`], 1);
  },

  prepare() {
    const browser = gBrowser.selectedBrowser;
    const principal = this.principal();
    if (!principal) return;
    for (const id of ["microphone", "camera", "autoplay-media"]) {
      SitePermissions.setForPrincipal(principal, id, SitePermissions.ALLOW, SitePermissions.SCOPE_PERSISTENT, browser);
    }
    if (ContentBlockingAllowList.canHandle(browser) && !ContentBlockingAllowList.includes(browser)) ContentBlockingAllowList.add(browser);
    const site = principal.baseDomain || principal.host;
    let overrides = [];
    try {
      overrides = JSON.parse(Orbit.pref("privacy.fingerprintingProtection.granularOverrides", "[]")) || [];
    } catch {}
    if (!overrides.some(o => o.firstPartyDomain == site)) {
      overrides.push({ firstPartyDomain: site, overrides: "-AllTargets" });
      Services.prefs.setStringPref("privacy.fingerprintingProtection.granularOverrides", JSON.stringify(overrides));
    }
    browser.reload();
  },

  toggle() {
    if (this.panel) return this.close();
    const principal = this.principal();
    if (!principal) return;
    this.panel = Orbit.h("div", { id: "orbit-perms-panel", role: "dialog", "aria-label": Orbit.tr(`Permissions for ${principal.host}`, `Autorisations de ${principal.host}`) });
    this.panel.dataset.origin = principal.origin;
    document.body.append(this.panel);
    this.render();
    const r = this.button.getBoundingClientRect();
    this.panel.style.left = `${Math.max(8, Math.min(innerWidth - 428, r.left - 6))}px`;
    this.panel.style.top = `${Math.round(r.bottom + 10)}px`;
    this._outside = e => !this.panel?.contains(e.target) && !this.button.contains(e.target) && this.close();
    this._esc = e => e.key == "Escape" && (this.close(), this.button.focus());
    window.addEventListener("mousedown", this._outside, true);
    window.addEventListener("keydown", this._esc, true);
  },

  close() {
    if (!this.panel) return;
    window.removeEventListener("mousedown", this._outside, true);
    window.removeEventListener("keydown", this._esc, true);
    const panel = this.panel;
    this.panel = null;
    panel.setAttribute("closing", "true");
    setTimeout(() => panel.remove(), 140);
  },

  async render() {
    const panel = this.panel;
    const principal = this.principal();
    if (!panel || !principal) return;
    const h = Orbit.h.bind(Orbit);
    const tr = Orbit.tr.bind(Orbit);
    const S = SitePermissions;
    const browser = gBrowser.selectedBrowser;
    const live = this.sharing();
    const hw = await this.devices();
    if (panel != this.panel) return;
    const set = (id, state) => {
      if (state == S.UNKNOWN) S.removeFromPrincipal(principal, id, browser);
      else S.setForPrincipal(principal, id, state, S.SCOPE_PERSISTENT, browser);
    };
    const knob = on => h("span", { class: "orbit-perms-switch", on });
    const names = { microphone: tr("microphone", "micro"), camera: tr("camera", "caméra"), screen: tr("screen", "écran") };
    const using = ["microphone", "camera", "screen"].filter(k => live[k]);

    const tiles = this.DEVICES.map(([id, icon, en, fr]) => {
      const state = this.state(principal, id);
      const noHw = id in hw && !hw[id];
      let tone = "", status, corner;
      if (live[id]) [tone, status] = ["ok", id == "camera" ? tr("Allowed · in use", "Autorisée · en cours") : tr("Allowed · in use", "Autorisé · en cours")];
      else if (noHw) [tone, status] = ["warn", tr("Turned off by Windows", "Coupé par Windows")];
      else if (state == S.BLOCK) [tone, status] = ["bad", id == "camera" ? tr("Blocked", "Bloquée") : tr("Blocked", "Bloqué")];
      else if (state == S.ALLOW) [tone, status] = ["ok", id == "camera" ? tr("Allowed", "Autorisée") : tr("Allowed", "Autorisé")];
      else status = id == "screen" ? tr("Asked each time", "Demandé à chaque fois") : tr("Asks first", "Demande d'abord");
      if (state == S.BLOCK) corner = h("span", { class: "orbit-perms-corner" }, tr("Unblock", "Débloquer"));
      else if (id == "screen") corner = h("span", { class: "orbit-perms-corner dim" }, tr("Block", "Bloquer"));
      else corner = knob(state == S.ALLOW);
      const next = state == S.BLOCK ? S.UNKNOWN : id == "screen" ? S.BLOCK : state == S.ALLOW ? S.UNKNOWN : S.ALLOW;
      return h("button", { class: "orbit-perms-tile", tone, "aria-pressed": String(state == S.ALLOW), onclick: () => set(id, next) },
        h("span", { class: "orbit-perms-tile-top" }, Orbit.icon(icon), corner),
        h("b", {}, tr(en, fr)),
        h("span", { class: "orbit-perms-status" }, status));
    });

    const row = (id, icon, label, on, onText, offText, toggle) => h("div", { class: "orbit-perms-row" },
      Orbit.icon(icon), h("span", { class: "orbit-perms-row-label" }, label),
      h("span", { class: "orbit-perms-row-state", on }, on ? onText : offText),
      h("button", { class: "orbit-perms-toggle", role: "switch", "aria-checked": String(on), "aria-label": label, onclick: toggle }, knob(on)));
    const notif = this.state(principal, "desktop-notification");
    const sound = this.state(principal, "autoplay-media") == S.ALLOW;
    const ready = this.ready(principal, hw);
    const missing = ["microphone", "camera"].filter(k => !hw[k]);

    panel.replaceChildren(...[
      h("div", { class: "orbit-perms-head" },
        h("span", { class: "orbit-perms-site" }, (principal.host.replace(/^www\./, "")[0] ?? "?").toUpperCase()),
        h("div", {}, h("b", {}, principal.host), h("span", {}, tr("What this site can use", "Ce que ce site peut utiliser")))),
      using.length ? h("div", { class: "orbit-perms-banner", tone: "live" }, h("i"),
        h("span", {}, tr("Live: ", "En direct : ") + using.map(k => names[k]).join(tr(" and ", " et "))),
        h("button", { onclick: () => webrtcUI.clearPermissionsAndStopSharing(using, browser) }, tr("Stop all", "Tout couper"))) : null,
      missing.length ? h("div", { class: "orbit-perms-banner", tone: "warn" },
        h("div", { class: "orbit-perms-banner-body" }, Orbit.icon("triangle-alert"),
          h("div", {},
            h("b", {}, tr(`Windows blocks your ${missing.map(k => names[k]).join(" and ")}`, `Windows bloque ton ${missing.map(k => names[k]).join(" et ta ")}`)),
            h("span", {}, tr("No site can use it while access is turned off in Windows, or none is plugged in.",
              "Aucun site ne peut l'utiliser tant que l'accès est coupé dans Windows, ou qu'aucun n'est branché.")))),
        h("button", { onclick: () => this.openWindowsSettings(missing[0] == "camera" ? "webcam" : "microphone") }, tr("Open Windows settings", "Ouvrir les réglages Windows"))) : null,
      h("div", { class: "orbit-perms-tiles" }, ...tiles),
      h("div", { class: "orbit-perms-rows" },
        row("desktop-notification", "bell", tr("Notifications", "Notifications"), notif == S.ALLOW, tr("Allowed", "Autorisées"),
          notif == S.BLOCK ? tr("Blocked", "Bloquées") : tr("Asks first", "Demande d'abord"),
          () => set("desktop-notification", notif == S.ALLOW ? S.UNKNOWN : S.ALLOW)),
        row("autoplay-media", "volume-2", tr("Sound autoplay", "Son automatique"), sound, tr("On", "Activé"), tr("Muted until you click", "Muet jusqu'à ton clic"),
          () => set("autoplay-media", sound ? S.BLOCK : S.ALLOW))),
      ready ? null : h("div", { class: "orbit-perms-cta" },
        h("button", { class: "orbit-button primary", onclick: () => this.prepare() }, Orbit.icon("wrench"), tr("Get this site ready for calls", "Préparer ce site pour les appels")),
        h("p", {}, tr("Allows microphone and camera, and turns off here the protections that break calls. The page reloads.",
          "Autorise micro et caméra, et coupe ici les protections qui cassent les appels. La page se recharge."))),
      h("div", { class: "orbit-perms-foot" },
        ready ? Orbit.icon("check") : null,
        h("span", {}, ready ? tr("Ready for calls: Windows and protections OK", "Appels prêts : Windows et protections OK")
          : tr("Asks first = Orbit asks you the first time.", "Demande d'abord = Orbit te pose la question la première fois.")),
        h("button", { class: "orbit-link", onclick: () => (this.close(), openPreferences("privacy-permissions")) }, tr("All sites", "Tous les sites")))].filter(Boolean));
  },
};
