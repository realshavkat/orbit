/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Orbit VPN: one switch that routes all browsing through an encrypted
// tunnel. Two providers:
//  - "mozilla": the free VPN built into Gecko (IP Protection, Mozilla's
//    servers, needs a Mozilla account; Orbit only shows its panel),
//  - "custom": your own SOCKS5 or HTTPS proxy (a VPS, Tor, a VPN app's proxy).
// While on, DNS goes through the tunnel and WebRTC cannot leak the real IP.
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
      on: fr ? "Orbit VPN activé" : "Orbit VPN on",
      off: fr ? "Orbit VPN désactivé" : "Orbit VPN off",
      onD: fr ? "Ta navigation passe par {h}. Ton adresse IP est masquée." : "Browsing goes through {h}. Your IP address is hidden.",
      offD: fr ? "Connexion directe." : "Direct connection.",
      noServer: fr ? "Ajoute d'abord un serveur dans Paramètres › Vie privée." : "Add a server first in Settings › Privacy.",
      bad: fr ? "Adresse invalide. Exemple : socks5://127.0.0.1:9050" : "Invalid address. Example: socks5://127.0.0.1:9050",
      mozilla: fr ? "Ouvre le panneau du VPN de Mozilla pour te connecter." : "Opening Mozilla's VPN panel to sign in.",
    }[k];
  },

  init() {
    this.migrate();
    // App-wide widget: the first window creates it, later ones get "exists".
    try {
      CustomizableUI.createWidget({
        id: this.WIDGET,
        type: "button",
        defaultArea: CustomizableUI.AREA_NAVBAR,
        label: "Orbit VPN",
        tooltiptext: "Orbit VPN",
        onCommand: e => e.target.ownerGlobal.OrbitVPN.toggle(),
      });
    } catch {}
    this.paint();
    this._obs = () => this.paint();
    Services.prefs.addObserver("orbit.vpn.enabled", this._obs);
    window.addEventListener("unload", () => Services.prefs.removeObserver("orbit.vpn.enabled", this._obs), { once: true });
  },

  // Only the first window applies saved state (prefs are global).
  migrate() {
    if (Orbit.pref("orbit.vpn.enabled", false) && Orbit.pref("orbit.vpn.mode", "custom") == "custom" &&
        Orbit.pref("network.proxy.type", 5) != 1) {
      this.apply(true, { quiet: true });
    }
  },

  paint(node = document.getElementById(this.WIDGET)) {
    if (!node) return;
    const on = Orbit.pref("orbit.vpn.enabled", false);
    node.toggleAttribute("orbit-on", on);
    node.setAttribute("tooltiptext", on ? this.t("on") : this.t("off"));
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
    const mode = Orbit.pref("orbit.vpn.mode", "custom");
    if (mode == "mozilla") {
      p.setBoolPref("browser.ipProtection.enabled", true);
      p.setBoolPref("orbit.vpn.enabled", false);
      if (!quiet) OrbitNotify.show({ kind: "vpn", icon: "shield", title: this.t("name"), text: this.t("mozilla"), timeout: 5000 });
      setTimeout(() => document.getElementById("ipprotection-button")?.click(), 300);
      return;
    }
    if (on) {
      const server = this.parse(Orbit.pref("orbit.vpn.server", ""));
      if (!server) {
        if (!quiet) OrbitNotify.show({ kind: "vpn", icon: "shield", tone: "warm", title: this.t("name"), text: this.t("noServer"), timeout: 6000 });
        OrbitSettings.open("privacy");
        return;
      }
      // Remember the user's own proxy settings once, to restore them later.
      if (!Orbit.pref("orbit.vpn.saved", "")) {
        const saved = {};
        for (const k of this.TUNNEL_PREFS) if (p.prefHasUserValue(k)) saved[k] = Orbit.pref(k);
        p.setStringPref("orbit.vpn.saved", JSON.stringify(saved));
      }
      p.setIntPref("network.proxy.type", 1);
      p.setStringPref("network.proxy.no_proxies_on", "");
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
        // DNS lookups go through the tunnel too.
        p.setBoolPref("network.proxy.socks_remote_dns", true);
        p.setStringPref("network.proxy.http", "");
        p.setStringPref("network.proxy.ssl", "");
      }
      // No WebRTC leak of the real address.
      p.setBoolPref("media.peerconnection.ice.proxy_only_if_behind_proxy", true);
      p.setBoolPref("media.peerconnection.ice.default_address_only", true);
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
