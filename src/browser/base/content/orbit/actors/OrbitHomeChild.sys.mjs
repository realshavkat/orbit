/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The home page asks for its data with an "OrbitHome:Ready" event; the
// parent answers and the data comes back as an "OrbitHome:Data" event. Page
// actions ("OrbitHome:AddTile", "OrbitHome:RemoveTile") go to the parent.
export class OrbitHomeChild extends JSWindowActorChild {
  async handleEvent(event) {
    const win = this.contentWindow;
    if (event.type == "OrbitHome:AddTile") {
      await this.sendQuery("OrbitHome:AddTile");
    } else if (event.type == "OrbitHome:RemoveTile") {
      const url = String(event.detail ?? "");
      await this.sendQuery("OrbitHome:RemoveTile", { url });
    } else if (event.type != "OrbitHome:Ready") {
      return;
    }
    const data = await this.sendQuery("OrbitHome:Get");
    if (!data || win.closed) return;
    win.document.dispatchEvent(new win.CustomEvent("OrbitHome:Data", { detail: Cu.cloneInto(data, win) }));
  }
}
