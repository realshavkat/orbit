/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var OrbitBackground = {
  DIR: "orbit-backgrounds",
  IMAGE: ["png", "jpg", "jpeg", "webp", "gif", "avif"],
  VIDEO: ["mp4", "webm", "mov", "m4v"],

  get dir() {
    return PathUtils.join(PathUtils.profileDir, this.DIR);
  },

  init() {
    this.apply();
    const obs = () => this.apply();
    Services.prefs.addObserver("orbit.background.", obs);
    window.addEventListener("unload", () => Services.prefs.removeObserver("orbit.background.", obs), { once: true });
    const playPause = () => {
      const v = document.getElementById("orbit-bg");
      if (v?.localName != "video") return;
      const idle = document.documentElement.matches(":-moz-window-inactive") || window.windowState == window.STATE_MINIMIZED;
      if (idle) v.pause();
      else v.play().catch(() => {});
    };
    for (const type of ["activate", "deactivate", "sizemodechange"]) window.addEventListener(type, () => setTimeout(playPause, 0));
  },

  FRAMES: [0, 16, 32, 64],

  fit() {
    return {
      fit: ["cover", "contain", "fill"].includes(Orbit.pref("orbit.background.fit", "cover")) ? Orbit.pref("orbit.background.fit", "cover") : "cover",
      x: Orbit.pref("orbit.background.x", 50),
      y: Orbit.pref("orbit.background.y", 50),
      zoom: Orbit.pref("orbit.background.zoom", 100),
      blur: Orbit.pref("orbit.background.blur", 0),
      frame: Orbit.pref("orbit.background.frame", 0),
    };
  },

  applyFit() {
    const root = document.documentElement;
    const { fit, x, y, zoom, blur, frame } = this.fit();
    root.style.setProperty("--orbit-bg-fit", fit);
    root.style.setProperty("--orbit-bg-pos", `${x}% ${y}%`);
    root.style.setProperty("--orbit-bg-zoom", String(zoom / 100 + (blur ? blur / 200 : 0)));
    root.style.setProperty("--orbit-bg-blur", `${blur}px`);
    root.style.setProperty("--orbit-frame", `${frame}px`);
    root.toggleAttribute("orbit-frame", frame > 0);
  },

  apply() {
    const root = document.documentElement;
    const type = Orbit.pref("orbit.background.type", "liquid");
    const file = Orbit.pref("orbit.background.file", "");
    this.applyFit();
    root.style.setProperty("--orbit-bg-dim", String(Orbit.pref("orbit.background.dim", 35) / 100));
    root.style.setProperty("--orbit-bg-color", Orbit.pref("orbit.background.color", "#0b0b14"));
    const key = `${type}|${file}`;
    if (key == this._key) return;
    this._key = key;
    document.getElementById("orbit-bg")?.remove();
    document.getElementById("orbit-bg-dim")?.remove();
    let effective = type;
    if ((type == "image" || type == "video") && file) {
      const url = Services.io.newFileURI(new FileUtils.File(PathUtils.join(this.dir, file))).spec;
      const el = type == "video"
        ? Orbit.h("video", { id: "orbit-bg", src: url, autoplay: true, loop: true, muted: true, playsinline: true })
        : Orbit.h("img", { id: "orbit-bg", src: url, alt: "" });
      if (type == "video") el.muted = true;
      document.body.prepend(el, Orbit.h("div", { id: "orbit-bg-dim" }));
    } else if (type != "color") {
      effective = "liquid";
    }
    root.setAttribute("orbit-bg", effective);
  },

  url() {
    const file = Orbit.pref("orbit.background.file", "");
    return file ? Services.io.newFileURI(new FileUtils.File(PathUtils.join(this.dir, file))).spec : null;
  },

  async choose() {
    const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    fp.init(window.browsingContext, Orbit.tr("Choose a background", "Choisir un fond"), Ci.nsIFilePicker.modeOpen);
    fp.appendFilter(Orbit.tr("Images and videos", "Images et vidéos"), [...this.IMAGE, ...this.VIDEO].map(e => `*.${e}`).join(";"));
    const result = await new Promise(r => fp.open(r));
    if (result != Ci.nsIFilePicker.returnOK) return false;
    const ext = fp.file.leafName.split(".").pop().toLowerCase();
    const type = this.VIDEO.includes(ext) ? "video" : this.IMAGE.includes(ext) ? "image" : null;
    if (!type) return false;
    await IOUtils.makeDirectory(this.dir, { ignoreExisting: true });
    const name = `background-${Date.now()}.${ext}`;
    await IOUtils.copy(fp.file.path, PathUtils.join(this.dir, name));
    const old = Orbit.pref("orbit.background.file", "");
    if (old) await IOUtils.remove(PathUtils.join(this.dir, old), { ignoreAbsent: true });
    Services.prefs.setStringPref("orbit.background.file", name);
    Services.prefs.setStringPref("orbit.background.type", type);
    return true;
  },
};
