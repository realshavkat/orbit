/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class OrbitMediaChild extends JSWindowActorChild {
  receiveMessage(msg) {
    const media = [...this.document.querySelectorAll("video, audio")];
    if (msg.name == "OrbitMedia:SetVolume") {
      const v = Math.min(1, Math.max(0, Number(msg.data?.v) || 0));
      for (const m of media) {
        m.volume = v;
        if (v > 0) m.muted = false;
      }
      return null;
    }
    if (msg.name == "OrbitMedia:GetVolume") {
      const m = media.find(e => !e.paused) ?? media[0];
      return m ? (m.muted ? 0 : m.volume) : null;
    }
    return null;
  }
}
