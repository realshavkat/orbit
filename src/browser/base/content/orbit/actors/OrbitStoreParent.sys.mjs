/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Store pages ask, Orbit decides: every request is checked against the page
// it comes from and the id's format; files are only ever fetched from fixed
// official addresses built from the id, never from what the page says.
const HOSTS = {
  "OrbitStore:Chrome": ["chromewebstore.google.com", "chrome.google.com"],
  "OrbitStore:ModInstall": ["zen-browser.app"],
  "OrbitStore:ModRemove": ["zen-browser.app"],
  "OrbitStore:ModState": ["zen-browser.app"],
};

export class OrbitStoreParent extends JSWindowActorParent {
  async receiveMessage(msg) {
    let host = "";
    try {
      host = this.manager.documentURI?.host ?? "";
    } catch {}
    if (!HOSTS[msg.name]?.includes(host)) return null;
    const win = this.browsingContext.topChromeWindow;
    if (!win?.OrbitMods || !win.OrbitChromeExt) return null;
    const id = String(msg.data?.id ?? "");
    if (msg.name == "OrbitStore:Chrome") {
      if (!/^[a-p]{32}$/.test(id)) return false;
      return win.OrbitChromeExt.install(id).then(() => true, () => false);
    }
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return false;
    if (msg.name == "OrbitStore:ModInstall") await win.OrbitMods.installZen(id).catch(e => console.error("Orbit mods", e));
    if (msg.name == "OrbitStore:ModRemove") await win.OrbitMods.remove(id).catch(e => console.error("Orbit mods", e));
    return win.OrbitMods.isInstalled(id);
  }
}
