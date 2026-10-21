/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class OrbitDownloadsChild extends JSWindowActorChild {
  send(type, detail) {
    const win = this.contentWindow;
    if (!win || win.closed) return;
    win.document.dispatchEvent(new win.CustomEvent(type, { detail: Cu.cloneInto(detail, win) }));
  }

  async handleEvent(event) {
    if (event.type == "OrbitDownloads:Act") {
      const { id, action } = event.detail ?? {};
      await this.sendQuery("OrbitDownloads:Act", { id: Number(id), action: String(action) });
      return;
    }
    if (event.type != "OrbitDownloads:Ready") return;
    const data = await this.sendQuery("OrbitDownloads:Get");
    if (data) this.send("OrbitDownloads:Data", data);
  }

  receiveMessage(msg) {
    if (msg.name == "OrbitDownloads:Changed") this.send("OrbitDownloads:Changed", msg.data);
    else if (msg.name == "OrbitDownloads:Removed") this.send("OrbitDownloads:Removed", msg.data);
  }
}
