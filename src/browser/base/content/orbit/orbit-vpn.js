/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Orbit VPN: one switch that routes all browsing through a tunnel you
// choose: Tor, a VPN app's local proxy, or your own SOCKS5/HTTPS server.
// While on, DNS goes through the tunnel and WebRTC cannot leak the real IP;
// if the server stops answering nothing goes out (no fallback to direct).
var OrbitVPN = {
  WIDGET: "orbit-vpn-button",
  // Prefs set while the custom tunnel is on, restored when it goes off.
  TUNNEL_PREFS: ["network.proxy.type", "network.proxy.socks", "network.proxy.socks_port", "network.proxy.socks_version",
    "network.proxy.socks_remote_dns", "network.proxy.http", "network.proxy.http_port", "network.proxy.ssl",
    "network.proxy.ssl_port", "network.proxy.no_proxies_on", "media.peerconnection.ice.proxy_only_if_behind_proxy",
    "media.peerconnection.ice.default_address_only"],

  t(k) {
    const fr = Orbit.lang() == "fr";
    return {
      name: "Orbit VPN",
      on: Orbit.tr("Orbit VPN on", "Orbit VPN activé"),
      off: Orbit.tr("Orbit VPN off", "Orbit VPN désactivé"),
      onD: Orbit.tr("Browsing goes through {h}. Your IP address is hidden.", "Ta navigation passe par {h}. Ton adresse IP est masquée."),
      offD: Orbit.tr("Direct connection.", "Connexion directe."),
      noServer: Orbit.tr("Add a server first in Settings › Privacy.", "Ajoute d'abord un serveur dans Paramètres › Vie privée."),
      bad: Orbit.tr("Invalid address. Example: socks5://127.0.0.1:9050", "Adresse invalide. Exemple : socks5://127.0.0.1:9050"),
    }[k];
  },

  // One-click servers for the simple mode.
  PRESETS: [
    ["tor-browser", "socks5://127.0.0.1:9150"],
    ["tor", "socks5://127.0.0.1:9050"],
  ],

  init() {
    // Gecko's own (Mozilla-account) VPN is not part of Orbit.
    if (Orbit.pref("orbit.vpn.mode", "custom") != "custom") Services.prefs.setStringPref("orbit.vpn.mode", "custom");
    Services.prefs.clearUserPref("browser.ipProtection.enabled");
    if (CustomizableUI.getPlacementOfWidget("ipprotection-button")) CustomizableUI.removeWidgetFromArea("ipprotection-button");
    this.migrate();
    // App-wide widget: the first window creates it, later ones get "exists".
    try {
      CustomizableUI.createWidget({
        id: this.WIDGET,
        type: "button",
        defaultArea: CustomizableUI.AREA_NAVBAR,
        label: "Orbit VPN",
        tooltiptext: "Orbit VPN",
        onCommand: e => e.target.ownerGlobal.OrbitVPN.togglePanel(e.target),
      });
    } catch {}
    this.paint();
    this._obs = () => this.paint();
    Services.prefs.addObserver("orbit.vpn.enabled", this._obs);
    window.addEventListener("unload", () => Services.prefs.removeObserver("orbit.vpn.enabled", this._obs), { once: true });
  },

  // Only the first window applies saved state (prefs are global).
  migrate() {
    if (Orbit.pref("orbit.vpn.enabled", false) && Orbit.pref("network.proxy.type", 5) != 1) {
      this.apply(true, { quiet: true });
    }
  },

  paint(node = document.getElementById(this.WIDGET)) {
    if (!node) return;
    const on = Orbit.pref("orbit.vpn.enabled", false);
    node.toggleAttribute("orbit-on", on);
    node.setAttribute("tooltiptext", on ? this.t("on") : this.t("off"));
  },

  // ---- panel (toolbar button) ------------------------------------------------------
  P(k) {
    const fr = Orbit.lang() == "fr";
    return {
      on: Orbit.tr("Protected", "Protégé"), off: Orbit.tr("Not protected", "Non protégé"),
      onD: Orbit.tr("Your IP address is hidden", "Ton adresse IP est masquée"),
      offD: Orbit.tr("Sites can see your IP address", "Les sites voient ton adresse IP"),
      via: Orbit.tr("Via", "Via"), noServer: Orbit.tr("No server", "Aucun serveur"),
      check: Orbit.tr("Check my IP", "Vérifier mon IP"), checking: Orbit.tr("Checking…", "Vérification…"),
      ip: Orbit.tr("IP seen by sites: ", "IP visible par les sites : "), ipFail: Orbit.tr("Could not reach the check service.", "Impossible de joindre le service de vérification."),
      advanced: Orbit.tr("Advanced mode", "Mode avancé"), simple: Orbit.tr("Simple mode", "Mode simple"),
      choose: Orbit.tr("Pick a server to start:", "Choisis un serveur pour commencer :"),
      "tor-browser": Orbit.tr("Tor Browser running", "Tor Browser ouvert"), tor: Orbit.tr("Tor service", "Service Tor"),
      own: Orbit.tr("My server…", "Mon serveur…"),
      torD: Orbit.tr("Tor is free: start Tor Browser (or the Tor service), then turn Orbit VPN on.", "Tor est gratuit : lance Tor Browser (ou le service Tor) puis active Orbit VPN."),
      server: Orbit.tr("SERVER", "SERVEUR"),
      serverD: Orbit.tr("SOCKS5 or HTTPS: a VPS, Tor (socks5://127.0.0.1:9050) or a VPN app's proxy.", "SOCKS5 ou HTTPS : un VPS, Tor (socks5://127.0.0.1:9050) ou le proxy d'une appli VPN."),
      dns: Orbit.tr("DNS through the tunnel", "DNS dans le tunnel"), webrtc: Orbit.tr("Block WebRTC leaks", "Bloquer les fuites WebRTC"),
      bypass: Orbit.tr("EXCEPTIONS", "EXCEPTIONS"), bypassD: Orbit.tr("Sites that skip the VPN, comma separated.", "Sites qui ne passent pas par le VPN, séparés par des virgules."),
      kill: Orbit.tr("If the server stops answering, nothing goes through: your IP never leaks.", "Si le serveur ne répond plus, rien ne passe : aucune fuite de ton IP."),
    }[k];
  },

  togglePanel(anchor) {
    if (document.getElementById("orbit-vpn-panel")) return this.closePanel();
    this.openPanel(anchor);
  },

  openPanel(anchor) {
    const h = Orbit.h.bind(Orbit);
    const S = OrbitSettings;
    const p = Services.prefs;
    const panel = h("div", { id: "orbit-vpn-panel", class: "orbit-panel", role: "dialog", "aria-label": "Orbit VPN" });
    const render = () => {
      const on = Orbit.pref("orbit.vpn.enabled", false);
      const server = this.parse(Orbit.pref("orbit.vpn.server", ""));
      const adv = Orbit.pref("orbit.vpn.advanced", false);
      const ipLine = h("div", { class: "orbit-vpn-ip" });
      const children = [
        h("div", { class: "orbit-vpn-hero", on },
          h("div", { class: "orbit-vpn-shield" }, Orbit.icon(on ? "shield-check" : "shield")),
          h("div", { class: "orbit-vpn-state" },
            h("b", {}, on ? this.P("on") : this.P("off")),
            h("span", {}, on ? this.P("onD") : this.P("offD"))),
          S.switch(on, v => { this.apply(v); setTimeout(render, 50); })),
        h("div", { class: "orbit-vpn-row" },
          h("span", {}, `${this.P("via")} `, h("b", {}, server ? this.label(Orbit.pref("orbit.vpn.server", "")) : this.P("noServer"))),
          h("button", { class: "orbit-toast-link", onclick: () => this.checkIP(ipLine) }, this.P("check"))),
        ipLine,
      ];
      // Simple mode with no server yet: one-click choices.
      if (!server && !adv) {
        children.push(h("div", { class: "orbit-vpn-adv" },
          h("div", { class: "orbit-setting-desc" }, this.P("choose")),
          h("div", { class: "orbit-vpn-presets" },
            ...this.PRESETS.map(([key, url]) => h("button", { class: "orbit-edit-chip", onclick: () => {
              p.setStringPref("orbit.vpn.server", url);
              render();
            } }, this.P(key))),
            h("button", { class: "orbit-edit-chip", onclick: () => { p.setBoolPref("orbit.vpn.advanced", true); render(); } }, this.P("own"))),
          h("div", { class: "orbit-setting-desc" }, this.P("torD"))));
      }
      if (adv) {
        const input = h("input", {
          class: "orbit-input", placeholder: "socks5://127.0.0.1:9050", spellcheck: "false", value: Orbit.pref("orbit.vpn.server", ""),
          onchange: () => {
            const v = input.value.trim();
            const ok = !v || this.parse(v);
            input.toggleAttribute("invalid", !ok);
            if (!ok) return;
            p.setStringPref("orbit.vpn.server", v);
            if (Orbit.pref("orbit.vpn.enabled", false)) this.apply(true, { quiet: true });
            render();
          },
        });
        const bypass = h("input", {
          class: "orbit-input", spellcheck: "false", value: Orbit.pref("orbit.vpn.bypass", "localhost, 127.0.0.1"),
          onchange: () => {
            p.setStringPref("orbit.vpn.bypass", bypass.value.trim());
            if (Orbit.pref("orbit.vpn.enabled", false)) this.apply(true, { quiet: true });
          },
        });
        const reapply = () => Orbit.pref("orbit.vpn.enabled", false) && this.apply(true, { quiet: true });
        children.push(h("div", { class: "orbit-vpn-adv" },
          ...[
            h("div", { class: "orbit-sheet-kicker" }, this.P("server")), input,
            h("div", { class: "orbit-vpn-presets" }, ...this.PRESETS.map(([key, url]) => h("button", { class: "orbit-edit-chip", onclick: () => {
              p.setStringPref("orbit.vpn.server", url);
              if (Orbit.pref("orbit.vpn.enabled", false)) this.apply(true, { quiet: true });
              render();
            } }, this.P(key)))),
            h("div", { class: "orbit-setting-desc" }, this.P("serverD")),
            h("label", { class: "orbit-vpn-toggle" }, h("span", {}, this.P("dns")),
              S.switch(Orbit.pref("orbit.vpn.dns", true), v => { p.setBoolPref("orbit.vpn.dns", v); reapply(); })),
            h("label", { class: "orbit-vpn-toggle" }, h("span", {}, this.P("webrtc")),
              S.switch(Orbit.pref("orbit.vpn.webrtc", true), v => { p.setBoolPref("orbit.vpn.webrtc", v); reapply(); })),
            h("div", { class: "orbit-sheet-kicker" }, this.P("bypass")), bypass,
            h("div", { class: "orbit-setting-desc" }, this.P("bypassD")),
            h("div", { class: "orbit-vpn-note" }, Orbit.icon("shield"), h("span", {}, this.P("kill"))),
          ]));
      }
      children.push(h("div", { class: "orbit-vpn-foot" },
        h("span", {}, "Orbit VPN"),
        h("button", { class: "orbit-toast-link", onclick: () => { p.setBoolPref("orbit.vpn.advanced", !adv); render(); } },
          adv ? this.P("simple") : this.P("advanced"))));
      panel.replaceChildren(...children);
    };
    render();
    document.body.append(panel);
    const r = anchor.getBoundingClientRect();
    panel.style.top = `${Math.round(r.bottom + 6)}px`;
    panel.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`;
    anchor.setAttribute("open", "true");
    this._anchor = anchor;
    this._outside = e => !panel.contains(e.target) && !anchor.contains(e.target) && this.closePanel();
    this._key = e => e.key == "Escape" && this.closePanel();
    window.addEventListener("mousedown", this._outside, true);
    window.addEventListener("keydown", this._key, true);
  },

  closePanel() {
    window.removeEventListener("mousedown", this._outside, true);
    window.removeEventListener("keydown", this._key, true);
    this._anchor?.removeAttribute("open");
    const panel = document.getElementById("orbit-vpn-panel");
    if (!panel) return;
    panel.setAttribute("closing", "true");
    setTimeout(() => panel.remove(), 140);
  },

  label(url) {
    const preset = this.PRESETS.find(([, u]) => u == url);
    if (preset) return this.P(preset[0]);
    const s = this.parse(url);
    return s ? `${s.host}:${s.port}` : url;
  },

  // Asks a public "what is my IP" service, through the tunnel when it is on.
  async checkIP(line) {
    line.textContent = this.P("checking");
    try {
      const res = await fetch("https://api.ipify.org?format=json", { cache: "no-store", credentials: "omit" });
      const { ip } = await res.json();
      line.textContent = this.P("ip") + String(ip).slice(0, 45);
    } catch {
      line.textContent = this.P("ipFail");
    }
  },

  // "socks5://host:port" | "http(s)://host:port" -> { kind, host, port } or null.
  parse(text) {
    const m = /^(socks5?|socks4|https?):\/\/\[?([\w.-]+|[0-9a-f:]+)\]?:(\d{1,5})\/?$/i.exec((text ?? "").trim());
    if (!m || +m[3] < 1 || +m[3] > 65535) return null;
    return { kind: m[1].toLowerCase().startsWith("socks") ? (m[1] == "socks4" ? "socks4" : "socks5") : "http", host: m[2], port: +m[3] };
  },

  toggle() {
    this.apply(!Orbit.pref("orbit.vpn.enabled", false));
  },

  apply(on, { quiet = false } = {}) {
    const p = Services.prefs;
    if (on) {
      const server = this.parse(Orbit.pref("orbit.vpn.server", ""));
      if (!server) {
        if (!quiet) OrbitNotify.show({ kind: "vpn", icon: "shield", tone: "warm", title: this.t("name"), text: this.t("noServer"), timeout: 6000 });
        Services.prefs.setBoolPref("orbit.vpn.advanced", true);
        return;
      }
      // Remember the user's own proxy settings once, to restore them later.
      if (!Orbit.pref("orbit.vpn.saved", "")) {
        const saved = {};
        for (const k of this.TUNNEL_PREFS) if (p.prefHasUserValue(k)) saved[k] = Orbit.pref(k);
        p.setStringPref("orbit.vpn.saved", JSON.stringify(saved));
      }
      p.setIntPref("network.proxy.type", 1);
      // Only the sites listed in "bypass" skip the tunnel (local addresses by default).
      p.setStringPref("network.proxy.no_proxies_on", Orbit.pref("orbit.vpn.bypass", "localhost, 127.0.0.1"));
      if (server.kind == "http") {
        for (const k of ["http", "ssl"]) {
          p.setStringPref(`network.proxy.${k}`, server.host);
          p.setIntPref(`network.proxy.${k}_port`, server.port);
        }
        p.setStringPref("network.proxy.socks", "");
      } else {
        p.setStringPref("network.proxy.socks", server.host);
        p.setIntPref("network.proxy.socks_port", server.port);
        p.setIntPref("network.proxy.socks_version", server.kind == "socks4" ? 4 : 5);
        // DNS lookups go through the tunnel too (unless turned off in advanced mode).
        p.setBoolPref("network.proxy.socks_remote_dns", Orbit.pref("orbit.vpn.dns", true));
        p.setStringPref("network.proxy.http", "");
        p.setStringPref("network.proxy.ssl", "");
      }
      // No WebRTC leak of the real address.
      const webrtc = Orbit.pref("orbit.vpn.webrtc", true);
      p.setBoolPref("media.peerconnection.ice.proxy_only_if_behind_proxy", webrtc);
      p.setBoolPref("media.peerconnection.ice.default_address_only", webrtc);
      p.setBoolPref("orbit.vpn.enabled", true);
      if (!quiet) OrbitNotify.show({ kind: "vpn", icon: "shield", tone: "ok", title: this.t("on"), text: this.t("onD").replace("{h}", server.host), timeout: 4000 });
    } else {
      for (const k of this.TUNNEL_PREFS) p.clearUserPref(k);
      let saved = {};
      try {
        saved = JSON.parse(Orbit.pref("orbit.vpn.saved", "") || "{}");
      } catch {}
      for (const [k, v] of Object.entries(saved)) {
        if (typeof v == "boolean") p.setBoolPref(k, v);
        else if (typeof v == "number") p.setIntPref(k, v);
        else p.setStringPref(k, v);
      }
      p.clearUserPref("orbit.vpn.saved");
      p.setBoolPref("orbit.vpn.enabled", false);
      if (!quiet) OrbitNotify.show({ kind: "vpn", icon: "shield", title: this.t("off"), text: this.t("offD"), timeout: 3000 });
    }
  },
};
