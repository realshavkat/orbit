/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Quick colors (like Zen's gradient picker): a field where up to three dots
// pick the space's colors (left-right = hue, top-bottom = light-dark), theme
// mode buttons, preset palettes, a wave for the background strength and a
// knob for the grain. Everything applies live.
var OrbitColors = {
  PRESETS: [
    ["#5b6cff", "#3a2bd0"], ["#f4efe6", "#d9cbb5"], ["#f3b6c9", "#e58aa7"], ["#d9b8ef", "#a77fd6"],
    ["#d5707a", "#8e2f45"], ["#ef8a6b", "#c4473a"], ["#e3cc7a", "#b9932f"], ["#5ee0a7", "#1f9e74"],
    ["#8b97b5", "#4b5670"], ["#2f7bff", "#14c2b0"], ["#ff8a3d", "#ef3b6b"], ["#22c58b", "#62c6ff"],
    ["#7c5cff", "#e0459b"], ["#2e9c56", "#b5e04a"], ["#f7b52c", "#ff6f7d"], ["#1b1b22", "#3b3b48"],
  ],

  hex(h, s, l) {
    s /= 100;
    l /= 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(c * 255).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  },

  // Field position (0..1, 0..1) -> color, and back (approximate, for presets).
  colorAt(x, y) {
    return this.hex(x * 360, 85 - y * 20, 80 - y * 52);
  },

  posOf(hex) {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(v => v / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let hue = 0;
    if (max != min) {
      const d = max - min;
      hue = max == r ? (g - b) / d + (g < b ? 6 : 0) : max == g ? (b - r) / d + 2 : (r - g) / d + 4;
      hue *= 60;
    }
    return { x: hue / 360, y: Math.min(1, Math.max(0, (0.8 - l) / 0.52)) };
  },

  toggle(anchor) {
    if (document.getElementById("orbit-colors")) return this.close();
    this.open(anchor);
  },

  open(anchor) {
    const h = Orbit.h.bind(Orbit);
    const p = Services.prefs;
    const space = OrbitSpaces.active;
    const theme = OrbitSpaces.theme(space);
    let dots = [theme.c1, theme.c2, theme.c3].filter(Boolean).map(c => this.posOf(c));
    let harmony = 0;

    const field = h("div", { class: "oc-field" });
    const hint = h("div", { class: "oc-hint" }, Orbit.tr("Click to add a color", "Clique pour ajouter une couleur"));
    // While a dot moves only the CSS variables change (one style write per
    // frame); the space is saved, and every window updated, on release.
    let frame = 0;
    const preview = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const colors = dots.map(d => this.colorAt(d.x, d.y));
        const root = document.documentElement.style;
        root.setProperty("--orbit-c1", colors[0]);
        root.setProperty("--orbit-c2", colors[1] ?? colors[0]);
        root.setProperty("--orbit-c3", colors[2] ?? colors[1] ?? colors[0]);
      });
    };
    const save = () => {
      const colors = dots.map(d => this.colorAt(d.x, d.y));
      Object.assign(space, { theme: "custom", c1: colors[0], c2: colors[1] ?? colors[0], c3: colors[2] ?? null });
      if (!space.c3) delete space.c3;
      OrbitSpaces.save();
      OrbitSpaces.update({ animate: false });
    };
    const draw = () => {
      field.querySelectorAll(".oc-dot").forEach(d => d.remove());
      hint.hidden = dots.length > 0;
      dots.forEach((d, i) => {
        const dot = h("span", { class: "oc-dot", primary: i == 0, style: `left:${d.x * 100}%;top:${d.y * 100}%;--c:${this.colorAt(d.x, d.y)}` });
        dot.addEventListener("pointerdown", e => {
          e.stopPropagation();
          dot.setPointerCapture(e.pointerId);
          const move = ev => {
            const r = field.getBoundingClientRect();
            d.x = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
            d.y = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
            dot.style.left = `${d.x * 100}%`;
            dot.style.top = `${d.y * 100}%`;
            dot.style.setProperty("--c", this.colorAt(d.x, d.y));
            preview();
          };
          dot.addEventListener("pointermove", move);
          dot.addEventListener("pointerup", () => {
            dot.removeEventListener("pointermove", move);
            save();
          }, { once: true });
        });
        field.append(dot);
      });
    };
    field.addEventListener("pointerdown", e => {
      if (dots.length >= 3) return;
      const r = field.getBoundingClientRect();
      dots.push({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
      draw();
      save();
    });
    field.append(hint);

    // Harmony: rebuild the other dots from the first one.
    const HARMONIES = [[1 / 12, -1 / 12], [0.5], [1 / 3, 2 / 3]];
    const actions = h("div", { class: "oc-actions" },
      h("button", { class: "orbit-icon-button", title: Orbit.tr("Add a color", "Ajouter une couleur"), onclick: e => {
        e.stopPropagation();
        if (dots.length >= 3) return;
        const base = dots[0] ?? { x: 0.65, y: 0.4 };
        dots.push({ x: (base.x + 0.15 * dots.length) % 1, y: base.y });
        draw();
        save();
      } }, Orbit.icon("plus")),
      h("button", { class: "orbit-icon-button", title: Orbit.tr("Remove a color", "Retirer une couleur"), onclick: e => {
        e.stopPropagation();
        if (dots.length > 1) dots.pop();
        draw();
        save();
      } }, Orbit.icon("x")),
      h("button", { class: "orbit-icon-button", title: Orbit.tr("Harmony", "Harmonie"), onclick: e => {
        e.stopPropagation();
        const base = dots[0] ?? { x: 0.65, y: 0.4 };
        harmony = (harmony + 1) % HARMONIES.length;
        dots = [base, ...HARMONIES[harmony].map(o => ({ x: (base.x + o + 1) % 1, y: base.y }))];
        draw();
        save();
      } }, Orbit.icon("sparkles")));
    for (const b of actions.children) b.addEventListener("pointerdown", e => e.stopPropagation());

    const scheme = Orbit.pref("browser.theme.toolbar-theme", 2);
    const modes = h("div", { class: "oc-modes" }, ...[[2, "sparkles", Orbit.tr("Automatic", "Automatique")], [1, "sun", Orbit.tr("Light", "Clair")],
      [0, "moon", Orbit.tr("Dark", "Sombre")]].map(([v, icon, title]) =>
      h("button", { class: "orbit-icon-button", title, active: v == scheme, onclick: e => {
        p.setIntPref("browser.theme.toolbar-theme", v);
        p.setIntPref("browser.theme.content-theme", v);
        for (const b of modes.children) b.toggleAttribute("active", b == e.currentTarget);
      } }, Orbit.icon(icon))));

    const strip = h("div", { class: "oc-presets" }, ...this.PRESETS.map(([a, b]) =>
      h("button", { class: "oc-preset", style: `--a:${a};--b:${b}`, onclick: () => {
        dots = [this.posOf(a), this.posOf(b)];
        draw();
        Object.assign(space, { theme: "custom", c1: a, c2: b });
        delete space.c3;
        OrbitSpaces.save();
        OrbitSpaces.update({ animate: false });
      } })));
    const scroll = d => strip.scrollBy({ left: d * 160, behavior: "smooth" });

    const panel = h("div", { id: "orbit-colors", class: "orbit-panel", role: "dialog", "aria-label": Orbit.tr("Colors", "Couleurs") },
      h("div", { class: "oc-box" }, modes, field, actions),
      h("div", { class: "oc-row" },
        h("button", { class: "orbit-icon-button", onclick: () => scroll(-1) }, Orbit.icon("chevron-right", "orbit-icon oc-prev")),
        strip,
        h("button", { class: "orbit-icon-button", onclick: () => scroll(1) }, Orbit.icon("chevron-right"))),
      h("div", { class: "oc-row oc-bottom" },
        this.wave(Orbit.pref("orbit.theme.intensity", 34), 80,
          v => document.documentElement.style.setProperty("--orbit-intensity", v / 100),
          v => p.setIntPref("orbit.theme.intensity", v), Orbit.tr("Background strength", "Intensité du fond")),
        this.knob(Orbit.pref("orbit.theme.grain", 16),
          v => document.documentElement.style.setProperty("--orbit-grain", v / 100),
          v => {
            p.setIntPref("orbit.theme.grain", v);
            if (v > 0 && !Orbit.pref("orbit.effects.grain", true)) p.setBoolPref("orbit.effects.grain", true);
          }, Orbit.tr("Grain", "Grain"))));
    draw();
    document.body.append(panel);
    const r = anchor?.getBoundingClientRect?.() ?? { left: 12, bottom: 60 };
    panel.style.left = `${Math.round(Math.min(Math.max(8, r.left), innerWidth - panel.offsetWidth - 8))}px`;
    panel.style.top = `${Math.round(Math.min(r.bottom + 6, innerHeight - panel.offsetHeight - 8))}px`;
    this._outside = e => !panel.contains(e.target) && !anchor?.contains?.(e.target) && this.close();
    this._key = e => e.key == "Escape" && this.close();
    window.addEventListener("mousedown", this._outside, true);
    window.addEventListener("keydown", this._key, true);
  },

  close() {
    window.removeEventListener("mousedown", this._outside, true);
    window.removeEventListener("keydown", this._key, true);
    const panel = document.getElementById("orbit-colors");
    if (!panel) return;
    panel.setAttribute("closing", "true");
    setTimeout(() => panel.remove(), 140);
  },

  // A slider drawn as a wave: the stronger, the taller the wave.
  // onInput: live (cheap) feedback; onCommit: once the pointer is released.
  wave(value, max, onInput, onCommit, label) {
    const h = Orbit.h.bind(Orbit);
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 240 40");
    const back = document.createElementNS(NS, "path");
    const front = document.createElementNS(NS, "path");
    back.setAttribute("class", "oc-wave-back");
    front.setAttribute("class", "oc-wave-front");
    svg.append(back, front);
    const el = h("div", { class: "oc-wave", role: "slider", tabindex: 0, title: label, "aria-label": label, "aria-valuemin": 0, "aria-valuemax": max });
    el.append(svg);
    const paint = () => {
      const amp = 3 + (value / max) * 13;
      let d = "";
      for (let x = 0; x <= 240; x += 4) d += `${x ? "L" : "M"}${x} ${20 + Math.sin((x / 240) * Math.PI * 12) * amp} `;
      back.setAttribute("d", d);
      front.setAttribute("d", d);
      front.style.clipPath = `inset(0 ${100 - (value / max) * 100}% 0 0)`;
      el.setAttribute("aria-valuenow", value);
    };
    const set = (v, commit) => {
      value = Math.round(Math.min(max, Math.max(0, v)));
      paint();
      onInput(value);
      if (commit) onCommit(value);
    };
    const pick = e => {
      const r = el.getBoundingClientRect();
      set(((e.clientX - r.left) / r.width) * max);
    };
    el.addEventListener("pointerdown", e => {
      el.setPointerCapture(e.pointerId);
      pick(e);
    });
    el.addEventListener("pointermove", e => el.hasPointerCapture(e.pointerId) && pick(e));
    el.addEventListener("pointerup", () => onCommit(value));
    el.addEventListener("keydown", e => {
      const d = { ArrowLeft: -2, ArrowRight: 2 }[e.key];
      if (d) set(value + d, true);
    });
    paint();
    return el;
  },

  // A dial: drag up or down (or scroll) to turn it.
  knob(value, onInput, onCommit, label) {
    const h = Orbit.h.bind(Orbit);
    const cap = h("span", { class: "oc-knob-cap" }, h("i"));
    const el = h("div", { class: "oc-knob", role: "slider", tabindex: 0, title: label, "aria-label": label, "aria-valuemin": 0, "aria-valuemax": 100 },
      ...Array.from({ length: 21 }, (_, i) => h("b", { style: `--a:${-135 + i * 13.5}deg` })), cap);
    const paint = () => {
      cap.style.transform = `rotate(${-135 + value * 2.7}deg)`;
      el.style.setProperty("--v", value);
      el.setAttribute("aria-valuenow", value);
      el.title = `${label} · ${value} %`;
    };
    const set = (v, commit) => {
      value = Math.round(Math.min(100, Math.max(0, v)));
      paint();
      onInput(value);
      if (commit) onCommit(value);
    };
    let start = null;
    el.addEventListener("pointerdown", e => {
      el.setPointerCapture(e.pointerId);
      start = { y: e.clientY, v: value };
    });
    el.addEventListener("pointermove", e => el.hasPointerCapture(e.pointerId) && start && set(start.v + (start.y - e.clientY) * 0.8));
    el.addEventListener("pointerup", () => onCommit(value));
    // Wheel: live, saved shortly after the last notch.
    let timer = 0;
    el.addEventListener("wheel", e => {
      e.preventDefault();
      set(value - Math.sign(e.deltaY) * 4);
      clearTimeout(timer);
      timer = setTimeout(() => onCommit(value), 300);
    }, { passive: false });
    el.addEventListener("keydown", e => {
      const d = { ArrowUp: 2, ArrowRight: 2, ArrowDown: -2, ArrowLeft: -2 }[e.key];
      if (d) set(value + d, true);
    });
    paint();
    return el;
  },
};
