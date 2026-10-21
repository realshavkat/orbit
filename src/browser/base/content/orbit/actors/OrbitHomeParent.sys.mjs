/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
  SearchService: "moz-src:///toolkit/components/search/SearchService.sys.mjs",
});

const HOME = "resource://orbit/home.html";
const TILES_PREF = "orbit.home.tiles";

function pref(name, fallback) {
  try {
    return Services.prefs.getStringPref(name, fallback);
  } catch {
    return fallback;
  }
}

function pinnedTiles() {
  try {
    return JSON.parse(pref(TILES_PREF, "[]")).filter(t => /^https?:\/\//.test(t.url));
  } catch {
    return [];
  }
}

export class OrbitHomeParent extends JSWindowActorParent {
  async receiveMessage(msg) {
    if (!this.manager.documentURI?.spec.startsWith(HOME)) return null;
    const win = this.browsingContext.topChromeWindow;
    switch (msg.name) {
      case "OrbitHome:AddTile": {
        const fr = Services.locale.appLocaleAsBCP47.startsWith("fr");
        const input = { value: "https://" };
        const ok = Services.prompt.prompt(win, fr ? "Ajouter un raccourci" : "Add a shortcut",
          fr ? "Adresse du site :" : "Site address:", input, null, {});
        let url;
        try {
          url = new URL(/^https?:\/\//.test(input.value) ? input.value : `https://${input.value}`);
        } catch {}
        if (ok && url && /^https?:$/.test(url.protocol)) {
          const tiles = pinnedTiles().filter(t => t.url != url.origin);
          tiles.push({ url: url.origin, title: url.hostname.replace(/^www\./, "").split(".")[0] });
          Services.prefs.setStringPref(TILES_PREF, JSON.stringify(tiles.slice(-6)));
        }
        return null;
      }
      case "OrbitHome:RemoveTile": {
        const hidden = new Set(JSON.parse(pref("orbit.home.hidden", "[]")));
        hidden.add(msg.data.url);
        Services.prefs.setStringPref(TILES_PREF, JSON.stringify(pinnedTiles().filter(t => t.url != msg.data.url)));
        Services.prefs.setStringPref("orbit.home.hidden", JSON.stringify([...hidden].slice(-50)));
        return null;
      }
      case "OrbitHome:Get":
        return this.data(win);
    }
    return null;
  }

  async data(win) {
    let search = "https://www.google.com/search?q={q}";
    try {
      const engine = lazy.SearchService.defaultEngine;
      search = engine.getSubmission("{q}").uri.spec.replace("%7Bq%7D", "{q}");
    } catch {}
    return {
      name: pref("orbit.user.name", ""),
      lang: Services.locale.appLocaleAsBCP47.split("-")[0],
      search,
      assistants: ChromeUtils.importESModule("resource://orbit/orbit-pure.mjs").ASSISTANTS.map(a => [a.name, a.url]),
      tiles: await this.tiles(),
      blocked: await this.blockedToday(),
      slept: this.sleepingTabs(win),
    };
  }

  async tiles() {
    const hidden = new Set(JSON.parse(pref("orbit.home.hidden", "[]")));
    const out = pinnedTiles().map(t => ({ ...t, pinned: true }));
    const seen = new Set(out.map(t => new URL(t.url).hostname.replace(/^www\./, "")));
    try {
      const db = await lazy.PlacesUtils.promiseDBConnection();
      const rows = await db.executeCached(
        `SELECT url, title FROM moz_places WHERE hidden = 0 AND frecency > 0 AND url LIKE 'http%'
         ORDER BY frecency DESC LIMIT 40`);
      for (const r of rows) {
        if (out.length >= 5) break;
        const u = new URL(r.getResultByName("url"));
        const host = u.hostname.replace(/^www\./, "");
        if (seen.has(host) || hidden.has(u.origin)) continue;
        seen.add(host);
        const title = (r.getResultByName("title") || host).split(/ [-|–·] /)[0].slice(0, 40);
        out.push({ url: u.origin, title });
      }
    } catch {}
    return out.slice(0, 5);
  }

  async blockedToday() {
    try {
      const db = Cc["@mozilla.org/tracking-db-service;1"].getService(Ci.nsITrackingDBService);
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const rows = await db.getEventsByDateRange(start.getTime(), Date.now());
      return rows.reduce((n, r) => n + r.getResultByName("count"), 0);
    } catch {
      return 0;
    }
  }

  sleepingTabs() {
    let n = 0;
    for (const w of Services.wm.getEnumerator("navigator:browser")) {
      for (const tab of w.gBrowser.tabs) if (!tab.linkedPanel || tab.hasAttribute("pending")) n++;
    }
    return n;
  }
}
