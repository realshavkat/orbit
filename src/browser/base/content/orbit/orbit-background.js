/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Window background: Orbit's liquid gradient (default), a picture, a looping
// video or a plain color. Files are copied into <profile>/orbit-backgrounds.
// A video pauses whenever the window is inactive or minimized.
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

  apply() {
    const root = document.documentElement;
    const type = Orbit.pref("orbit.background.type", "liquid");
    const file = Orbit.pref("orbit.background.file", "");
    document.getElementById("orbit-bg")?.remove();
    document.getElementById("orbit-bg-dim")?.remove();
    root.style.setProperty("--orbit-bg-dim", String(Orbit.pref("orbit.background.dim", 35) / 100));
    root.style.setProperty("--orbit-bg-color", Orbit.pref("orbit.background.color", "#0b0b14"));
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

  // Picks a picture or a video and makes it the background.
  async choose() {
    const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    const fr = Orbit.lang() == "fr";
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
    // Only the current background is kept on disk.
    const old = Orbit.pref("orbit.background.file", "");
    if (old) await IOUtils.remove(PathUtils.join(this.dir, old), { ignoreAbsent: true });
    Services.prefs.setStringPref("orbit.background.file", name);
    Services.prefs.setStringPref("orbit.background.type", type);
    return true;
  },
};
