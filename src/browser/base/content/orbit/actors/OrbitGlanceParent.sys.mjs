/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class OrbitGlanceParent extends JSWindowActorParent {
  receiveMessage({ name, data }) {
    if (name != "Orbit:Glance") return;
    // Content processes are untrusted: only accept plain http(s) URLs.
    let url;
    try {
      url = new URL(data?.href);
    } catch {
      return;
    }
    if (url.protocol != "http:" && url.protocol != "https:") return;
    const browser = this.browsingContext.top.embedderElement;
    (browser?.documentGlobal ?? browser?.ownerGlobal)?.OrbitGlance?.open(url.href, this.manager.documentPrincipal, {
      x: Number(data.x) || 0,
      y: Number(data.y) || 0,
    });
  }
}
