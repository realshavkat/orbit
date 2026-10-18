/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Alt+click on a link asks the parent to show it in a Glance overlay.
export class OrbitGlanceChild extends JSWindowActorChild {
  handleEvent(event) {
    if (
      event.type != "click" || event.button != 0 || !event.isTrusted || !event.altKey ||
      event.ctrlKey || event.shiftKey || event.metaKey || event.defaultPrevented
    ) {
      return;
    }
    let node = event.composedTarget;
    if (node?.nodeType != 1) node = node?.parentElement;
    const link = node?.closest?.("a[href], area[href]");
    if (!link || !/^https?:/.test(link.href)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.sendAsyncMessage("Orbit:Glance", { href: link.href, x: event.screenX, y: event.screenY });
  }
}
