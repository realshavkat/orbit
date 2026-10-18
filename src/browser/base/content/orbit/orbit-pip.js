/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Loaded into each Picture-in-Picture window (see OrbitPiP in orbit.js):
// Orbit styling, S/M/L size presets and magnetic screen corners.
(function () {
  const doc = document;
  if (doc.documentElement.hasAttribute("orbit-pip")) return;
  doc.documentElement.setAttribute("orbit-pip", "true");

  const link = doc.createElementNS("http://www.w3.org/1999/xhtml", "link");
  link.rel = "stylesheet";
  link.href = "chrome://orbit/content/orbit-pip.css";
  doc.head.append(link);

  // ---- size presets (keep the video's aspect ratio) ----
  const SIZES = { S: 320, M: 480, L: 720 };
  const bar = doc.createElement("div");
  bar.id = "orbit-pip-sizes";
  bar.className = "control-item";
  for (const [label, width] of Object.entries(SIZES)) {
    const b = doc.createElement("button");
    b.textContent = label;
    b.setAttribute("aria-label", `${label} ${width}px`);
    b.addEventListener("click", () => {
      const ratio = window.innerWidth / Math.max(1, window.innerHeight);
      const w = Math.min(width, screen.availWidth - 32);
      window.resizeTo(w, Math.round(w / ratio));
      for (const o of bar.children) o.toggleAttribute("active", o == b);
      setTimeout(snap, 50);
    });
    bar.append(b);
  }
  doc.getElementById("controls")?.append(bar);

  // ---- magnetic corners: after a move settles, snap if near an edge ----
  const MARGIN = 16;
  const RANGE = 56;
  function snap() {
    const L = screen.availLeft, T = screen.availTop;
    const R = L + screen.availWidth, B = T + screen.availHeight;
    const w = window.outerWidth, h = window.outerHeight;
    let x = window.screenX, y = window.screenY;
    if (x - L < RANGE) x = L + MARGIN;
    else if (R - (x + w) < RANGE) x = R - w - MARGIN;
    if (y - T < RANGE) y = T + MARGIN;
    else if (B - (y + h) < RANGE) y = B - h - MARGIN;
    if (x != window.screenX || y != window.screenY) window.moveTo(x, y);
  }
  let last = [window.screenX, window.screenY];
  let moving = false;
  const timer = setInterval(() => {
    const now = [window.screenX, window.screenY];
    if (now[0] != last[0] || now[1] != last[1]) {
      moving = true;
    } else if (moving) {
      moving = false;
      snap();
    }
    last = now;
  }, 300);
  window.addEventListener("unload", () => clearInterval(timer), { once: true });
})();
