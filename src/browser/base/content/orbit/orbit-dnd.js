/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Sidebar drag and drop, replacing Gecko's tab dragging inside the sidebar.
// A floating card follows the pointer and says what the drop will do. In row
// lists (space-pinned tabs, the tab list, folders) a slot opens where the tab
// will land and the other rows make room; in the Essentials grid a bar shows
// the spot. Empty zones get a visible box while dragging.
var OrbitDnD = {
  THRESHOLD: 5,
  ROW: 34,

  t(k, arg = "") {
    return {
      essentials: Orbit.tr("Add to Essentials", "Ajouter aux favoris"),
      moveEssential: Orbit.tr("Move in Essentials", "Déplacer dans les favoris"),
      kept: Orbit.tr("Pin in {s}", "Épingler dans {s}"),
      moveKept: Orbit.tr("Move in pinned", "Déplacer dans les épinglés"),
      list: Orbit.tr("Move to tabs", "Mettre dans les onglets"),
      reorder: Orbit.tr("Move here", "Déplacer ici"),
      folder: Orbit.tr("Put in “{s}”", "Mettre dans « {s} »"),
      space: Orbit.tr("Move to {s}", "Déplacer vers {s}"),
      dzEssentials: Orbit.tr("Essentials", "Favoris"),
      dzKept: Orbit.tr("Pinned in {s}", "Épinglés dans {s}"),
      folderPin: Orbit.tr("Pin folder in {s}", "Épingler le dossier dans {s}"),
    }[k].replace("{s}", arg);
  },

  init() {
    const box = document.getElementById("vertical-tabs");
    if (!box) return;
    // Gecko's own drag would fight this one inside the sidebar.
    window.addEventListener("dragstart", e => {
      if (this.press || this.drag || this.source(e.composedTarget ?? e.target) || this.source(e.target)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);
    box.addEventListener("pointerdown", e => this.down(e), true);
  },

  // What a press on `el` would drag: a tab, or a folder by its label.
  source(el) {
    if (el?.nodeType == Node.TEXT_NODE) el = el.parentElement;
    if (!el?.closest?.("#vertical-tabs")) return null;
    if (el.closest(".tab-close-button, .orbit-rename, input")) return null;
    const label = el.closest(".tab-group-label-container");
    if (label) return label.closest("tab-group");
    return el.closest(".tabbrowser-tab");
  },

  down(e) {
    if (e.button != 0 || e.ctrlKey || e.shiftKey || e.metaKey || this.drag) return;
    const item = this.source(e.target);
    if (!item) return;
    this.press = { item, x: e.clientX, y: e.clientY };
    this._move = ev => this.move(ev);
    this._up = ev => this.up(ev);
    this._key = ev => ev.key == "Escape" && this.end(false);
    window.addEventListener("pointermove", this._move, true);
    window.addEventListener("pointerup", this._up, true);
    window.addEventListener("pointercancel", this._up, true);
    window.addEventListener("keydown", this._key, true);
  },

  move(e) {
    if (!this.drag) {
      if (Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) < this.THRESHOLD) return;
      this.start();
    }
    this.pointer = { x: e.clientX, y: e.clientY };
    this.ghost.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 10}px)`;
    this.update();
  },

  up(e) {
    if (!this.drag) return this.cleanup();
    e.preventDefault();
    e.stopPropagation();
    // The click that follows a drag must not select or toggle anything.
    const swallow = ev => { ev.preventDefault(); ev.stopPropagation(); };
    window.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", swallow, true), 0);
    this.end(true);
  },

  start() {
    const h = Orbit.h.bind(Orbit);
    const item = this.press.item;
    const isGroup = item.localName == "tab-group";
    const drag = (this.drag = {
      item,
      isGroup,
      tabs: isGroup ? [] : item.multiselected ? gBrowser.selectedTabs : [item],
      kind: isGroup ? "folder" : !item.pinned ? "tab" : OrbitKept.isKept(item) ? "kept" : "essential",
    });
    const moving = isGroup ? [item] : drag.tabs;
    const root = document.documentElement;
    root.setAttribute("orbit-dragging", drag.kind == "essential" ? "pinned" : "tab");
    root.setAttribute("orbit-dnd", drag.kind);
    for (const t of moving) t.setAttribute("orbit-drag-source", "true");
    const icon = isGroup ? `${Orbit.BASE}icons/folder.svg` : item.getAttribute("image") || "chrome://global/skin/icons/defaultFavicon.svg";
    const title = moving.length > 1 ? `${item.label} +${moving.length - 1}` : item.label;
    this.action = h("span", { class: "orbit-dnd-action" });
    this.ghost = h("div", { id: "orbit-dnd-ghost" },
      h("img", { src: icon, alt: "" }),
      h("div", {}, h("b", {}, title), this.action));
    this.line = h("div", { id: "orbit-dnd-line", hidden: true });
    // The landing slot previews the row: icon and title, at its future place.
    this.slot = h("div", { id: "orbit-dnd-slot", hidden: true }, h("img", { src: icon, alt: "" }), h("span", {}, title));
    document.body.append(this.slot, this.line, this.ghost);

    // Empty zones (once the dragged items left them) get a box for the drag.
    const tabsEl = gBrowser.tabContainer;
    const pinned = document.getElementById("pinned-tabs-container");
    const others = t => !moving.includes(t);
    this.zones = [];
    if (!isGroup && !gBrowser.tabs.some(t => t.pinned && !OrbitKept.isKept(t) && others(t))) {
      const dz = h("div", { id: "orbit-dz-essentials", class: "orbit-dz" }, Orbit.icon("star"), h("span", {}, this.t("dzEssentials")));
      tabsEl.insertBefore(dz, pinned);
      this.zones.push(dz);
    }
    if (!gBrowser.tabs.some(t => t.getAttribute(OrbitKept.KEY) == OrbitSpaces.activeId && others(t))) {
      const dz = h("div", { id: "orbit-dz-kept", class: "orbit-dz" }, Orbit.icon("pin"),
        h("span", {}, this.t("dzKept", OrbitSpaces.active?.name ?? "")));
      pinned.after(dz);
      this.zones.push(dz);
    }
    this.snapshot();
    for (const dz of this.zones) dz.animate([{ opacity: 0, transform: "scaleY(.6)" }, { opacity: 1, transform: "none" }],
      { duration: 180, easing: "cubic-bezier(.2,.9,.25,1)" });
    this.scroller = setInterval(() => this.autoScroll(), 16);
  },

  autoScroll() {
    if (!this.pointer) return;
    const list = document.getElementById("tabbrowser-arrowscrollbox");
    const r = list?.getBoundingClientRect();
    if (!r || this.pointer.x < r.left || this.pointer.x > r.right) return;
    const edge = 36;
    const dy = this.pointer.y < r.top + edge && this.pointer.y > r.top - 10 ? -8 : this.pointer.y > r.bottom - edge && this.pointer.y < r.bottom + 10 ? 8 : 0;
    if (dy) {
      list.scrollbox.scrollTop += dy;
      this.update();
    }
  },

  // ---- targeting -------------------------------------------------------------------
  // Rects as laid out, without the shift this drag applied.
  // Where `el` sits once this drag's gap is in place: its position measured at
  // drag start (animations never skew it), the list's scroll since, and the
  // gap if `el` comes after it.
  rect(el) {
    let n = this.nat.get(el);
    if (!n) {
      const r = el.getBoundingClientRect();
      n = { top: r.top, height: r.height, left: r.left, width: r.width, inList: el.id != "tabbrowser-arrowscrollbox" && !!el.closest?.("#tabbrowser-arrowscrollbox") };
      this.nat.set(el, n);
    }
    let top = n.top;
    if (n.inList) top -= this.listScroll() - this.scroll0;
    const m = this.margin;
    if (m && m.el != el ? m.el.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING && !m.el.contains(el) : m?.side == "margin-top") {
      top += m.px;
    }
    return { top, bottom: top + n.height, height: n.height, left: n.left, width: n.width, right: n.left + n.width };
  },

  listScroll() {
    return document.getElementById("tabbrowser-arrowscrollbox")?.scrollbox?.scrollTop ?? 0;
  },

  // Positions without any gap, for every row the drag can aim at.
  snapshot() {
    this.nat = new Map();
    this.scroll0 = this.listScroll();
    const els = [...this.keptRows(), ...gBrowser.visibleTabs.filter(t => !t.pinned && !this.isMoving(t)),
      ...gBrowser.tabContainer.querySelectorAll("tab-group, .tab-group-label-container"),
      document.getElementById("tabbrowser-arrowscrollbox")];
    for (const el of els) this.rect(el);
  },

  isMoving(el) {
    return el == this.drag.item || this.drag.tabs.includes(el);
  },

  keptRows() {
    return [...document.querySelectorAll("#pinned-tabs-container .tabbrowser-tab[orbit-kept]:not([orbit-elsewhere])")]
      .filter(t => !this.isMoving(t));
  },

  // Visible top-level entries of the current space's list (tabs and folders).
  listItems() {
    const out = [];
    for (const t of gBrowser.visibleTabs) {
      if (t.pinned || t.closing || this.isMoving(t)) continue;
      const item = t.group ?? t;
      if (!out.includes(item) && !this.isMoving(item)) out.push(item);
    }
    return out;
  },

  // Index among `rows` where y falls (by row middles).
  indexAt(rows, y) {
    const i = rows.findIndex(r => y < this.rect(r).top + this.rect(r).height / 2);
    return i < 0 ? rows.length : i;
  },

  update() {
    const { x, y } = this.pointer;
    const el = document.elementFromPoint(x, y);
    const target = el ? this.resolve(el, x, y) : null;
    this.target = target;
    for (const z of document.querySelectorAll("[orbit-dz-over]")) z.removeAttribute("orbit-dz-over");
    this.ghost.toggleAttribute("none", !target);
    this.action.textContent = target?.label ?? "";
    target?.zone?.setAttribute("orbit-dz-over", "true");
    this.line.hidden = !target?.line;
    if (target?.line) {
      const { left, top, width, height } = target.line;
      Object.assign(this.line.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
    }
    this.openSlot(target?.rows ? target : null);
  },

  // Rows from `index` on move down; the slot fills the gap.
  // The gap is real layout (a margin on one row), so containers grow and what
  // follows moves down; rows glide to their new place (FLIP on transform).
  openSlot(target) {
    let margin = null;
    let slot = null;
    if (target) {
      const { rows, index, anchor } = target;
      const pitch = rows.length > 1 ? this.nat.get(rows[1])?.top - this.nat.get(rows[0])?.top || this.ROW + 2 : this.ROW + 2;
      if (index < rows.length) margin = { el: rows[index], side: "margin-top", px: pitch };
      else if (rows.length) margin = { el: rows.at(-1), side: "margin-bottom", px: pitch };
      const box = rows[0] ? this.rect(rows[0]) : anchor;
      if (box) slot = { left: box.left, width: box.width, height: pitch - 2 };
      this._slotAt = () => index < rows.length ? this.rect(rows[index]).top - pitch + 1
        : rows.length ? this.rect(rows.at(-1)).bottom + 1 : box.top;
    }
    const same = this.margin?.el == margin?.el && this.margin?.side == margin?.side;
    if (!same) {
      const moved = [...this.nat.keys()];
      const old = moved.map(el => el.getBoundingClientRect().top);
      this.setMargin(null);
      this.setMargin(margin);
      if (!window.gReduceMotion) {
        moved.forEach((el, i) => {
          const d = old[i] - el.getBoundingClientRect().top;
          if (Math.abs(d) > 0.5 && el.localName != "arrowscrollbox") {
            el.animate([{ transform: `translateY(${d}px)` }, { transform: "none" }], { duration: 170, easing: "cubic-bezier(.2,.9,.25,1)" });
          }
        });
      }
    }
    if (slot) slot.top = this._slotAt();
    const list = this.rect(document.getElementById("tabbrowser-arrowscrollbox"));
    // A slot scrolled out of the tab list is not drawn over the rest of the sidebar.
    const clipped = slot && target.inList && (slot.top < list.top - 4 || slot.top + slot.height > list.top + list.height + 4);
    this.slot.hidden = !slot || clipped;
    if (slot && !clipped) {
      Object.assign(this.slot.style, { left: `${slot.left}px`, top: `${slot.top}px`, width: `${slot.width}px`, height: `${slot.height}px` });
    }
  },

  setMargin(m) {
    if (!m) {
      this.margin?.el.style.removeProperty(this.margin.side);
      this.margin = null;
      return;
    }
    m.el.style.setProperty(m.side, `${m.px}px`, "important");
    this.margin = m;
  },

  // Returns { type, label, zone?, ref?, before?, line?, rows?, index?, group? } or null.
  resolve(el, x, y) {
    const drag = this.drag;
    const space = OrbitSpaces.active?.name ?? "";
    const vLine = (r, before) => ({ left: (before ? r.left : r.right) - 1.5, top: r.top + 6, width: 3, height: r.height - 12 });
    const pinnedBox = document.getElementById("pinned-tabs-container");
    const listBox = document.getElementById("tabbrowser-arrowscrollbox");

    const spaceBtn = el.closest(".orbit-space-button");
    if (spaceBtn) {
      const s = OrbitSpaces.byId(spaceBtn.dataset.spaceId);
      if (drag.isGroup || !s || s.id == OrbitSpaces.activeId) return null;
      return { type: "space", ref: s.id, label: this.t("space", s.name), zone: spaceBtn };
    }
    if (el.closest("#orbit-dz-essentials")) {
      return { type: "essentials", label: this.t("essentials"), zone: el.closest("#orbit-dz-essentials") };
    }
    const keptLabel = drag.isGroup ? this.t("folderPin", space) : drag.kind == "kept" ? this.t("moveKept") : this.t("kept", space);
    if (el.closest("#orbit-dz-kept")) {
      return { type: "kept", label: keptLabel, zone: el.closest("#orbit-dz-kept") };
    }

    // Pinned area: the Essentials grid, then the space's pinned rows below it.
    if (el.closest("#pinned-tabs-container")) {
      const rows = this.keptRows();
      const tile = el.closest(".tabbrowser-tab");
      // Where the rows start without the gap: the gap must not move this line,
      // or the target flips between the grid and the rows at every frame.
      const rowsTop = rows[0] ? this.nat.get(rows[0])?.top ?? this.rect(rows[0]).top : null;
      const inRows = OrbitKept.isKept(tile) || (rowsTop != null && y >= rowsTop - 3) || drag.isGroup;
      if (!inRows) {
        const label = drag.kind == "essential" ? this.t("moveEssential") : this.t("essentials");
        if (!tile || this.isMoving(tile)) return { type: "essentials", label, zone: pinnedBox };
        const r = tile.getBoundingClientRect();
        const before = x < r.left + r.width / 2;
        return { type: "essentials", ref: tile, before, label, line: vLine(r, before) };
      }
      if (drag.isGroup) return { type: "kept", label: keptLabel, zone: pinnedBox };
      return { type: "kept", label: keptLabel, rows, index: this.indexAt(rows, y) };
    }

    // Tab list (with folders), the space header and the empty space below.
    if (!el.closest("#tabbrowser-arrowscrollbox, #orbit-sidebar-header, #tabs-newtab-button, #vertical-tabs")) return null;
    const rows = this.listItems();
    const listLabel = drag.kind == "tab" || drag.isGroup ? this.t("reorder") : this.t("list");
    if (el.closest("#orbit-sidebar-header, #tabs-newtab-button")) {
      return { type: "list", label: listLabel, rows, index: 0, inList: true, anchor: this.rect(listBox) };
    }
    if (!drag.isGroup) {
      for (const g of rows) {
        if (g.localName != "tab-group") continue;
        const gr = this.rect(g);
        if (y < gr.top || y > gr.bottom) continue;
        const lab = g.querySelector(".tab-group-label-container");
        const labBottom = lab ? this.rect(lab).bottom : gr.top + this.ROW;
        if (y <= labBottom || g.collapsed) {
          return { type: "folder", ref: g, label: this.t("folder", g.label || "…"), zone: lab };
        }
        // Inside an open folder: a spot between its tabs.
        const inner = g.tabs.filter(t => t.visible !== false && !t.hidden && !this.isMoving(t));
        const after = rows.slice(rows.indexOf(g) + 1);
        return { type: "group", group: g, label: this.t("folder", g.label || "…"), rows: inner, index: this.indexAt(inner, y),
          after, inList: true, anchor: { left: gr.left + 12, width: gr.width - 12, top: labBottom + 2 } };
      }
    }
    return { type: "list", label: listLabel, rows, index: this.indexAt(rows, y), inList: true, anchor: this.rect(listBox) };
  },

  // ---- drop --------------------------------------------------------------------------
  end(drop) {
    const target = drop ? this.target : null;
    const drag = this.drag;
    const items = drag ? (drag.isGroup ? [drag.item] : drag.tabs) : [];
    // FLIP from the slot (or the item's place) to the final spot.
    const from = !this.slot?.hidden ? this.slot.getBoundingClientRect() : null;
    this.cleanup();
    if (!target || !drag) return;
    const before = new Map(items.map(it => [it, from ?? it.getBoundingClientRect()]));
    try {
      this.apply(drag, target);
    } catch (e) {
      console.error("Orbit drag", e);
    }
    if (window.gReduceMotion) return;
    requestAnimationFrame(() => {
      for (const it of items) {
        const a = before.get(it);
        const b = it.getBoundingClientRect();
        if (!b.width || !a.width) continue;
        it.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: "none" }],
          { duration: 240, easing: "cubic-bezier(.2,.9,.25,1)" });
      }
    });
  },

  // Turns "index among rows" into "before/after a row".
  spot(target) {
    const { rows, index } = target;
    if (!rows?.length) return null;
    return index < rows.length ? { ref: rows[index], before: true } : { ref: rows.at(-1), before: false };
  },

  apply(drag, target) {
    if (drag.isGroup) return this.applyGroup(drag.item, target);
    const tabs = drag.tabs;
    const spot = target.rows ? this.spot(target) : target.ref ? { ref: target.ref, before: target.before } : null;
    switch (target.type) {
      case "space":
        for (const t of tabs) if (t.pinned) gBrowser.unpinTab(t);
        OrbitSpaces.moveTabs(tabs, target.ref);
        break;
      case "essentials":
        for (const t of tabs) {
          if (OrbitKept.isKept(t)) OrbitKept.forget(t);
          if (!t.pinned) gBrowser.pinTab(t);
        }
        this.place(tabs, spot);
        for (const t of tabs) OrbitKept.pop(t);
        OrbitKept.sync();
        break;
      case "kept":
        for (const t of tabs) if (!OrbitKept.isKept(t)) OrbitKept.set(t, true);
        this.place(tabs, spot);
        break;
      case "folder":
        for (const t of tabs) {
          if (t.pinned) gBrowser.unpinTab(t);
          gBrowser.moveTabToExistingGroup(t, target.ref);
        }
        if (target.ref.collapsed) target.ref.collapsed = false;
        break;
      case "group":
        for (const t of tabs) if (t.pinned) gBrowser.unpinTab(t);
        if (spot) this.place(tabs, spot);
        else for (const t of tabs) gBrowser.moveTabToExistingGroup(t, target.group);
        break;
      case "list":
        for (const t of tabs) if (t.pinned) gBrowser.unpinTab(t);
        // Rows are top-level entries, so this never lands inside a folder.
        if (spot) this.place(tabs, spot);
        OrbitSpaces.syncVisibility();
        break;
    }
  },

  place(tabs, spot) {
    if (!spot?.ref) return;
    if (spot.before) gBrowser.moveTabsBefore(tabs, spot.ref);
    else gBrowser.moveTabsAfter(tabs, spot.ref);
  },

  applyGroup(group, target) {
    if (target.type == "kept") {
      OrbitFolders.setMeta(group.id, { pinned: OrbitSpaces.activeId });
      const first = this.listItems()[0];
      if (first) gBrowser.moveTabBefore(group, first);
      OrbitSpaces.syncVisibility();
      return;
    }
    const spot = target.type == "list" && this.spot(target);
    if (spot) {
      if (spot.before) gBrowser.moveTabBefore(group, spot.ref);
      else gBrowser.moveTabAfter(group, spot.ref);
      OrbitSpaces.syncVisibility();
    }
  },

  cleanup() {
    window.removeEventListener("pointermove", this._move, true);
    window.removeEventListener("pointerup", this._up, true);
    window.removeEventListener("pointercancel", this._up, true);
    window.removeEventListener("keydown", this._key, true);
    clearInterval(this.scroller);
    this.press = null;
    if (!this.drag) return;
    const root = document.documentElement;
    root.removeAttribute("orbit-dragging");
    root.removeAttribute("orbit-dnd");
    this.setMargin(null);
    this.nat = new Map();
    for (const el of document.querySelectorAll("[orbit-drag-source], [orbit-dz-over]")) {
      el.removeAttribute("orbit-drag-source");
      el.removeAttribute("orbit-dz-over");
    }
    this.ghost?.remove();
    this.line?.remove();
    this.slot?.remove();
    for (const z of this.zones ?? []) z.remove();
    this.zones = [];
    this.drag = null;
    this.target = null;
    this.pointer = null;
  },
};
