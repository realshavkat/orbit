/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Color picker (pipette): freezes the window into a snapshot, a loupe follows
// the pointer, a click gives the pixel's color as HEX, RGB, HSL and OKLCH.
// HEX goes to the clipboard at once; the last colors stay in a short history.
var OrbitPicker = {
  RECENT: "orbit.picker.recent",

  get formats() {
    return ChromeUtils.importESModule("resource://orbit/orbit-pure.mjs").colorFormats;
  },

  recent() {
    return Orbit.pref(this.RECENT, "").split(",").filter(c => /^#[0-9A-F]{6}$/.test(c));
  },

  async start() {
    if (document.getElementById("orbit-picker")) return;
    for (const el of document.querySelectorAll("#orbit-palette, #orbit-picked, #orbit-settings[closing]")) el.remove();
    // Let the closed overlays leave the screen before the snapshot.
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const scale = window.devicePixelRatio;
    let bitmap;
    try {
      // An explicit rect: without one the snapshot includes the window frame.
      bitmap = await window.browsingContext.currentWindowGlobal.drawSnapshot(new DOMRect(0, 0, innerWidth, innerHeight), scale, "white");
    } catch (e) {
      console.error("Orbit: color picker snapshot", e);
      return;
    }
    const h = Orbit.h.bind(Orbit);
    const W = bitmap.width;
    const H = bitmap.height;
    const shot = h("canvas", { width: W, height: H });
    const ctx = shot.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const ZOOM = 12;
    const CELLS = 11;
    const loupe = h("canvas", { width: ZOOM * CELLS, height: ZOOM * CELLS });
    const lctx = loupe.getContext("2d");
    lctx.imageSmoothingEnabled = false;
    const label = h("span", { class: "orbit-loupe-label" });
    const lens = h("div", { class: "orbit-loupe" }, loupe, label);
    const root = h("div", { id: "orbit-picker", tabindex: "-1" }, shot, lens);
    const at = e => [Math.min(W - 1, Math.max(0, Math.floor(e.clientX * scale))), Math.min(H - 1, Math.max(0, Math.floor(e.clientY * scale)))];
    const read = (x, y) => {
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      return this.formats(r, g, b);
    };
    const move = e => {
      const [x, y] = at(e);
      lctx.clearRect(0, 0, loupe.width, loupe.height);
      lctx.drawImage(shot, x - 5, y - 5, CELLS, CELLS, 0, 0, loupe.width, loupe.height);
      lctx.strokeStyle = "rgb(255 255 255 / .9)";
      lctx.lineWidth = 2;
      lctx.strokeRect(5 * ZOOM, 5 * ZOOM, ZOOM, ZOOM);
      const c = read(x, y);
      label.textContent = c.hex;
      lens.style.setProperty("--c", c.hex);
      // Beside the pointer, flipped near the right and bottom edges.
      const side = e.clientX + 24 + 150 > innerWidth ? -24 - 136 : 24;
      const down = e.clientY + 24 + 170 > innerHeight ? -24 - 166 : 24;
      lens.style.transform = `translate(${e.clientX + side}px, ${e.clientY + down}px)`;
    };
    const done = () => {
      root.remove();
      window.removeEventListener("keydown", key, true);
    };
    const key = e => {
      if (e.key != "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      done();
    };
    root.addEventListener("mousemove", move);
    root.addEventListener("contextmenu", e => {
      e.preventDefault();
      done();
    });
    root.addEventListener("mousedown", e => {
      if (e.button != 0) return;
      e.preventDefault();
      const c = read(...at(e));
      done();
      this.pick(c, e.clientX, e.clientY);
    });
    window.addEventListener("keydown", key, true);
    document.body.append(root);
    root.focus();
  },

  pick(c, x, y) {
    Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(c.hex);
    Services.prefs.setStringPref(this.RECENT, [c.hex, ...this.recent().filter(v => v != c.hex)].slice(0, 8).join(","));
    this.card(c, x, y);
  },

  // The picked color in every format; click a row to copy it.
  card(c, x, y) {
    document.getElementById("orbit-picked")?.remove();
    const h = Orbit.h.bind(Orbit);
    const copied = Orbit.tr("Copied", "Copié");
    const rows = [["HEX", c.hex], ["RGB", c.rgb], ["HSL", c.hsl], ["OKLCH", c.oklch]].map(([k, v]) => {
      const b = h("button", { class: "orbit-picked-row", title: Orbit.tr("Copy", "Copier") },
        h("span", { class: "orbit-picked-k" }, k), h("span", { class: "orbit-picked-v" }, v), Orbit.icon("copy"));
      b.addEventListener("click", () => {
        Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(v);
        b.querySelector(".orbit-picked-v").textContent = copied;
        setTimeout(() => (b.querySelector(".orbit-picked-v").textContent = v), 900);
      });
      return b;
    });
    const history = this.recent().map(hex => h("button", { class: "orbit-picked-dot", style: `--c:${hex}`, title: hex,
      onclick: () => {
        const n = parseInt(hex.slice(1), 16);
        this.card(this.formats(n >> 16, (n >> 8) & 255, n & 255), x, y);
      } }));
    const card = h("div", { id: "orbit-picked", class: "orbit-ctx", style: `--c:${c.hex}` },
      h("div", { class: "orbit-picked-head" }, h("span", { class: "orbit-picked-swatch" }),
        h("div", { class: "orbit-picked-title" }, h("b", {}, c.hex), h("span", {}, Orbit.tr("HEX copied", "HEX copié"))),
        h("button", { class: "orbit-icon-button", title: Orbit.tr("Pick another color", "Choisir une autre couleur"),
          onclick: () => this.start() }, Orbit.icon("pipette"))),
      ...rows, history.length > 1 ? h("div", { class: "orbit-picked-history" }, ...history) : null);
    document.body.append(card);
    const w = 260;
    card.style.left = `${Math.round(Math.min(Math.max(8, x + 12), innerWidth - w - 8))}px`;
    card.style.top = `${Math.round(Math.min(Math.max(8, y + 12), innerHeight - card.getBoundingClientRect().height - 8))}px`;
    const close = e => {
      if (e.type == "keydown" ? e.key != "Escape" : card.contains(e.target)) return;
      card.remove();
      window.removeEventListener("mousedown", close, true);
      window.removeEventListener("keydown", close, true);
    };
    window.addEventListener("mousedown", close, true);
    window.addEventListener("keydown", close, true);
  },
};
