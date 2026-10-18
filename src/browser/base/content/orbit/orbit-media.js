/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Sidebar mini player: the media playing in another tab (title, artist,
// artwork) with previous / play-pause / next, via the platform's
// MediaController. Event-driven only, no polling.
var OrbitMedia = {
  init() {
    if (!Orbit.pref("orbit.media.sidebar-player", true)) return;
    const h = Orbit.h.bind(Orbit);
    this.card = h("div", { id: "orbit-media", hidden: true },
      this.art = h("img", { class: "orbit-media-art", alt: "" }),
      h("button", { class: "orbit-media-text", onclick: () => this.tab && (gBrowser.selectedTab = this.tab) },
        this.title = h("span", { class: "orbit-media-title" }),
        this.sub = h("span", { class: "orbit-media-sub" })),
      h("button", { class: "orbit-icon-button", "aria-label": "Précédent", onclick: () => this.ctl()?.prevTrack() }, Orbit.icon("skip-back")),
      this.playBtn = h("button", { class: "orbit-icon-button", "aria-label": "Lecture", onclick: () => this.toggle() }, Orbit.icon("pause")),
      h("button", { class: "orbit-icon-button", "aria-label": "Suivant", onclick: () => this.ctl()?.nextTrack() }, Orbit.icon("skip-forward")));
    const footer = document.getElementById("orbit-sidebar-footer");
    footer.parentNode.insertBefore(this.card, footer);
    gBrowser.tabContainer.addEventListener("TabAttrModified", e => {
      if (e.detail.changed.some(a => a == "soundplaying" || a == "activemedia-blocked")) this.refresh();
    });
    gBrowser.tabContainer.addEventListener("TabSelect", () => this.refresh());
    gBrowser.tabContainer.addEventListener("TabClose", e => e.target == this.tab && setTimeout(() => this.refresh()));
  },

  ctl(tab = this.tab) {
    return tab?.linkedBrowser?.browsingContext?.mediaController ?? null;
  },

  refresh() {
    // Prefer the tab that is audibly playing; keep the last one while paused.
    const playing = gBrowser.tabs.find(t => t.soundPlaying);
    const next = playing ?? (this.tab && !this.tab.closing && this.ctl()?.isActive ? this.tab : null);
    if (next != this.tab) this.watch(next);
    this.render();
  },

  watch(tab) {
    const old = this.ctl();
    if (old && this._listener) {
      for (const t of ["metadatachange", "playbackstatechange", "deactivated"]) old.removeEventListener(t, this._listener);
    }
    this.tab = tab;
    const c = this.ctl();
    if (c) {
      this._listener ??= () => this.render();
      for (const t of ["metadatachange", "playbackstatechange", "deactivated"]) c.addEventListener(t, this._listener);
    }
  },

  toggle() {
    const c = this.ctl();
    if (!c) return;
    if (c.isPlaying) c.pause();
    else c.play();
    setTimeout(() => this.render(), 80);
  },

  render() {
    const c = this.ctl();
    // Short clips never activate the media controller; sound alone is enough.
    const visible = !!((c?.isActive || this.tab?.soundPlaying) && !this.tab.selected);
    this.card.hidden = !visible;
    if (!visible) return;
    let meta = null;
    try {
      meta = c.getMetadata();
    } catch {}
    this.title.textContent = meta?.title || this.tab.label;
    let host = "";
    try {
      host = this.tab.linkedBrowser.currentURI.host.replace(/^www\./, "");
    } catch {}
    this.sub.textContent = meta?.artist || host;
    const art = meta?.artwork?.at(-1)?.src;
    this.art.src = art && /^https:/.test(art) ? art : this.tab.getAttribute("image") || `${Orbit.BASE}icons/music.svg`;
    this.art.toggleAttribute("icon", !(art && /^https:/.test(art)));
    this.playBtn.replaceChildren(Orbit.icon((c.isPlaying || this.tab.soundPlaying) ? "pause" : "play"));
    this.playBtn.setAttribute("aria-label", (c.isPlaying || this.tab.soundPlaying) ? "Pause" : "Lecture");
  },
};
