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
