/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
      folderUnpin: Orbit.tr("Unpin folder", "Désépingler le dossier"),
      tabUnpin: Orbit.tr("Unpin tab", "Désépingler l'onglet"),
    }[k].replace("{s}", arg);
  },

  init() {
    const box = document.getElementById("vertical-tabs");
    if (!box) return;
    window.addEventListener("dragstart", e => {
      if (this.press || this.drag || this.source(e.composedTarget ?? e.target) || this.source(e.target)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);
    box.addEventListener("pointerdown", e => this.down(e), true);
  },

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
    const near = Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) < 12;
    if (near && (!this.target || this.target.type == "noop" || this.target.ref == this.drag.item)) return this.end(false);
    e.preventDefault();
    e.stopPropagation();
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
      kind: isGroup ? "folder" : OrbitKept.isKept(item) ? "kept" : item.pinned ? "essential" : "tab",
    });
    const moving = isGroup ? [item] : drag.tabs;
    if (isGroup) {
      drag.pinned = !!OrbitFolders.meta[item.id]?.pinned;
      if (!item.collapsed) {
        drag.reopen = true;
        item.collapsed = true;
        item.getBoundingClientRect();
      }
    }
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
    this.slot = h("div", { id: "orbit-dnd-slot", hidden: true }, h("img", { src: icon, alt: "" }), h("span", {}, title));
    document.body.append(this.slot, this.line, this.ghost);

    const tabsEl = gBrowser.tabContainer;
    const pinned = document.getElementById("pinned-tabs-container");
    const others = t => !moving.includes(t);
    this.zones = [];
    if (!isGroup && !gBrowser.tabs.some(t => t.pinned && !OrbitKept.isKept(t) && others(t))) {
      const dz = h("div", { id: "orbit-dz-essentials", class: "orbit-dz" }, Orbit.icon("star"), h("span", {}, this.t("dzEssentials")));
      tabsEl.insertBefore(dz, pinned);
      this.zones.push(dz);
    }
    if (!OrbitFolders.zoneRows().some(r => !moving.includes(r))) {
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

  snapshot() {
    this.nat = new Map();
    this.scroll0 = this.listScroll();
    const els = [...gBrowser.visibleTabs.filter(t => !t.pinned && !this.isMoving(t)),
      ...gBrowser.tabContainer.querySelectorAll("tab-group, .tab-group-label-container"),
      document.getElementById("tabbrowser-arrowscrollbox")];
    for (const el of els) this.rect(el);
  },

  isMoving(el) {
    return el == this.drag.item || this.drag.tabs.includes(el);
  },

  listItems() {
    const out = [];
    for (const t of gBrowser.tabs) {
      if (t.localName != "tab" || t.pinned || t.closing || t.hidden || this.isMoving(t)) continue;
      const item = t.group ?? t.splitview ?? t;
      if (!out.includes(item) && !this.isMoving(item)) out.push(item);
    }
    return out;
  },

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

  openSlot(target) {
    let margin = null;
    let slot = null;
    if (target) {
      const { rows, index, anchor, tail } = target;
      const pitch = rows.length > 1 ? this.nat.get(rows[1])?.top - this.nat.get(rows[0])?.top || this.ROW + 2 : this.ROW + 2;
      const after = tail ? rows[index - 1] : index < rows.length ? null : rows.at(-1);
      if (after) margin = { el: after, side: "margin-bottom", px: pitch };
      else if (index < rows.length) margin = { el: rows[index], side: "margin-top", px: pitch };
      const box = rows[0] ? this.rect(rows[0]) : anchor;
      if (box) slot = { left: box.left, width: box.width, height: pitch - 2 };
      this._slotAt = () => after ? this.rect(after).bottom + 1 : index < rows.length ? this.rect(rows[index]).top - pitch + 1 : box.top;
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

    if (el.closest("#pinned-tabs-container")) {
      if (drag.isGroup) return { type: "kept", label: keptLabel, zone: pinnedBox };
      const tile = el.closest(".tabbrowser-tab");
      const label = drag.kind == "essential" ? this.t("moveEssential") : this.t("essentials");
      if (!tile || this.isMoving(tile)) return { type: "essentials", label, zone: pinnedBox };
      const r = tile.getBoundingClientRect();
      const before = x < r.left + r.width / 2;
      return { type: "essentials", ref: tile, before, label, line: vLine(r, before) };
    }

    if (!el.closest("#tabbrowser-arrowscrollbox, #orbit-sidebar-header, #tabs-newtab-button, #vertical-tabs")) return null;
    const rows = this.listItems();
    const header = document.getElementById("orbit-sidebar-header");
    const onHeader = !!el.closest("#orbit-sidebar-header, #tabs-newtab-button");
    const zoneCount = rows.filter(r => OrbitFolders.isZoneRow(r)).length;
    let index = onHeader ? zoneCount : this.indexAt(rows, y);
    let pinned = index < zoneCount;
    if (index == zoneCount && zoneCount && !onHeader && header?.closest("#tabbrowser-arrowscrollbox")) {
      const hr = this.rect(header);
      pinned = y < hr.top + hr.height / 2;
    }
    const was = drag.isGroup ? drag.pinned : drag.kind == "kept";
    const label = pinned
      ? (was ? this.t("reorder") : drag.isGroup ? this.t("folderPin", space) : this.t("kept", space))
      : was ? (drag.isGroup ? this.t("folderUnpin") : this.t("tabUnpin")) : drag.kind == "essential" ? this.t("list") : this.t("reorder");
    return { type: "list", pinned, label, rows, index, tail: pinned && index == zoneCount && index > 0, inList: true, anchor: this.rect(listBox) };
  },

  end(drop) {
    const target = drop ? this.target : null;
    const drag = this.drag;
    const items = drag ? (drag.isGroup ? [drag.item] : drag.tabs) : [];
    const from = !this.slot?.hidden ? this.slot.getBoundingClientRect() : null;
    this.cleanup();
    const reopen = () => drag?.reopen && drag.item.isConnected && (drag.item.collapsed = false);
    if (!target || !drag) return reopen();
    const before = new Map(items.map(it => [it, from ?? it.getBoundingClientRect()]));
    try {
      this.apply(drag, target);
    } catch (e) {
      console.error("Orbit drag", e);
    }
    reopen();
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

  spot(target) {
    const { rows, index, tail } = target;
    if (!rows?.length) return null;
    if (tail) return { ref: rows[index - 1], before: false };
    return index < rows.length ? { ref: rows[index], before: true } : { ref: rows.at(-1), before: false };
  },

  apply(drag, target) {
    if (drag.isGroup) return this.applyGroup(drag.item, target);
    const tabs = drag.tabs;
    const spot = target.rows ? this.spot(target) : target.ref ? { ref: target.ref, before: target.before } : null;
    switch (target.type) {
      case "space":
        for (const t of tabs) {
          OrbitKept.mark(t, false);
          if (t.pinned) gBrowser.unpinTab(t);
        }
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
        for (const t of tabs) OrbitKept.set(t, true);
        break;
      case "folder":
        for (const t of tabs) {
          OrbitKept.mark(t, false);
          if (t.pinned) gBrowser.unpinTab(t);
          gBrowser.moveTabToExistingGroup(t, target.ref);
        }
        if (target.ref.collapsed) target.ref.collapsed = false;
        break;
      case "group":
        for (const t of tabs) {
          OrbitKept.mark(t, false);
          if (t.pinned) gBrowser.unpinTab(t);
        }
        if (spot) this.place(tabs, spot);
        else for (const t of tabs) gBrowser.moveTabToExistingGroup(t, target.group);
        break;
      case "list":
        for (const t of tabs) {
          if (target.pinned) OrbitKept.mark(t, true);
          else {
            OrbitKept.mark(t, false);
            if (t.pinned) gBrowser.unpinTab(t);
          }
        }
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
    const current = OrbitFolders.meta[group.id]?.pinned;
    if (target.type == "kept") {
      const zone = OrbitFolders.zoneRows().filter(r => r != group);
      const first = OrbitFolders.rows().find(r => r != group);
      OrbitFolders.setMeta(group.id, { pinned: current || OrbitSpaces.activeId });
      if (zone.length) gBrowser.moveTabAfter(group, zone.at(-1));
      else if (first) gBrowser.moveTabBefore(group, first);
      OrbitSpaces.syncVisibility();
      return;
    }
    if (target.type != "list") return;
    if (target.pinned != null) OrbitFolders.setMeta(group.id, { pinned: target.pinned ? current || OrbitSpaces.activeId : null });
    const spot = this.spot(target);
    if (spot) {
      if (spot.before) gBrowser.moveTabBefore(group, spot.ref);
      else gBrowser.moveTabAfter(group, spot.ref);
    }
    OrbitSpaces.syncVisibility();
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
