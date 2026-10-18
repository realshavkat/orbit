/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Orbit default preferences. Included at the end of firefox.js so these win.

// ---- Orbit features -------------------------------------------------------
pref("orbit.view.compact", false);
pref("orbit.view.sidebar-width", 240);
pref("orbit.urlbar.replace-newtab", true);
pref("orbit.glance.enabled", true);
pref("orbit.spaces.data", "");
// Sleep (unload) background tabs idle for this many minutes. 0 = never,
// -1 = adaptive (15 min, 3 min while Windows reports low memory).
pref("orbit.tabs.unload-after-minutes", -1);
// Above this total (MB), the oldest idle tabs sleep. 0 = no limit.
pref("orbit.memory.budget-mb", 0);
pref("orbit.memory.eco", false);
pref("orbit.media.sidebar-player", true);
pref("orbit.user.name", "");
// Notifications Orbit may show (each can be turned off in Settings).
pref("orbit.notify.pin", true);
pref("orbit.notify.default", true);
pref("orbit.notify.update", true);
pref("orbit.notify.sleep", true);
pref("orbit.notify.tips", false);

// ---- Layout: native vertical tabs, always visible sidebar -----------------
pref("sidebar.revamp", true);
pref("sidebar.verticalTabs", true);
pref("sidebar.visibility", "always-show");
pref("sidebar.expandOnHover", false);
pref("sidebar.position_start", true);
pref("sidebar.main.tools", "");
pref("sidebar.new-sidebar.has-used", true);
pref("sidebar.verticalTabs.dragToPinPromo.dismissed", true);
pref("browser.toolbars.bookmarks.visibility", "never");
pref("browser.tabs.splitView.enabled", true);
pref("browser.tabs.groups.enabled", true);
pref("browser.tabs.hoverPreview.enabled", false);
pref("browser.compactmode.show", true);
pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);
pref("browser.startup.page", 3);
pref("browser.aboutwelcome.enabled", false);
pref("browser.startup.homepage_override.mstone", "ignore");
pref("browser.startup.homepage", "resource://orbit/home.html");
pref("trailhead.firstrun.didSeeAboutWelcome", true);
pref("browser.tabs.closeWindowWithLastTab", false);

// ---- Memory ----------------------------------------------------------------
// Fewer content processes, no spare preallocated process, no preloaded newtab.
pref("dom.ipc.processCount", 4);
pref("dom.ipc.processPrelaunch.enabled", false);
pref("browser.newtab.preload", false);
pref("browser.newtabpage.enabled", false);
pref("browser.tabs.unloadOnLowMemory", true);
// Keep at most 2 pages in the in-memory back/forward cache.
pref("browser.sessionhistory.max_total_viewers", 2);
pref("browser.sessionstore.interval", 60000);
pref("browser.sessionstore.max_tabs_undo", 10);
pref("image.mem.decode_bytes_at_a_time", 65536);
pref("image.mem.shared.unmap.min_expiration_ms", 30000);
pref("media.memory_cache_max_size", 32768);
// One process per site only where needed; a single process for isolated sites.
pref("fission.webContentIsolationStrategy", 2);
pref("dom.ipc.processCount.webIsolated", 1);
pref("image.mem.surfacecache.max_size_kb", 262144);
pref("browser.cache.memory.capacity", 32768);
pref("browser.sessionhistory.max_entries", 25);
// No built-in AI / ML features (they keep models and inference processes).
pref("browser.ml.enable", false);
// The assistant panel is a plain web view of the chosen chatbot (no local model).
pref("browser.ml.chat.enabled", true);
pref("browser.ml.chat.provider", "https://claude.ai/new");
pref("browser.ml.chat.shortcuts", false);
pref("browser.ml.chat.page", false);
pref("browser.ml.linkPreview.enabled", false);
pref("browser.tabs.groups.smart.enabled", false);
pref("extensions.ml.enabled", false);
pref("browser.smartwindow.aitab.enabled", false);
pref("extensions.pocket.enabled", false);

// ---- Privacy: no telemetry, studies or sponsored content ------------------
pref("toolkit.telemetry.enabled", false);
pref("toolkit.telemetry.unified", false);
pref("toolkit.telemetry.archive.enabled", false);
pref("datareporting.healthreport.uploadEnabled", false);
pref("datareporting.policy.dataSubmissionEnabled", false);
pref("datareporting.usage.uploadEnabled", false);
pref("app.shield.optoutstudies.enabled", false);
pref("app.normandy.enabled", false);
pref("browser.discovery.enabled", false);
pref("browser.urlbar.suggest.quicksuggest.sponsored", false);
pref("browser.urlbar.suggest.quicksuggest.nonsponsored", false);
pref("browser.newtabpage.activity-stream.showSponsored", false);
pref("browser.newtabpage.activity-stream.showSponsoredTopSites", false);
pref("browser.newtabpage.activity-stream.feeds.telemetry", false);
pref("browser.newtabpage.activity-stream.telemetry", false);
pref("browser.ping-centre.telemetry", false);
// Orbit asks itself, once, through its own dismissable notifications.
pref("browser.shell.checkDefaultBrowser", false);
pref("browser.startup.upgradeDialog.enabled", false);
pref("browser.shell.setDefaultBrowserUserChoice", true);
pref("browser.preferences.moreFromMozilla", false);
pref("browser.messaging-system.whatsNewPanel.enabled", false);
pref("browser.newtabpage.activity-stream.asrouter.userprefs.cfr.addons", false);
pref("browser.newtabpage.activity-stream.asrouter.userprefs.cfr.features", false);
pref("privacy.trackingprotection.enabled", true);
pref("privacy.trackingprotection.socialtracking.enabled", true);
pref("privacy.globalprivacycontrol.enabled", true);
// Orbit Blocker's companions: clean links, HTTPS first, no bounce tracking.
pref("privacy.query_stripping.enabled", true);
pref("privacy.query_stripping.enabled.pbmode", true);
pref("dom.security.https_first", true);
pref("privacy.bounceTrackingProtection.mode", 1);
// Orbit VPN (see orbit-vpn.js): off until a server is set.
pref("orbit.vpn.enabled", false);
pref("orbit.vpn.mode", "custom");
pref("orbit.vpn.server", "");

// ---- Picture-in-Picture --------------------------------------------------------
pref("media.videocontrols.picture-in-picture.playback-speed.enabled", true);
pref("media.videocontrols.picture-in-picture.enable-when-switching-tabs.enabled", true);
pref("media.videocontrols.picture-in-picture.display-text-tracks.enabled", true);
pref("media.videocontrols.picture-in-picture.keyboard-controls.enabled", true);

// ---- Look ------------------------------------------------------------------
pref("browser.theme.dark-private-windows", true);
pref("widget.windows.mica", true);
pref("widget.windows.mica.toplevel-backdrop", 2);
pref("browser.tabs.allow_transparent_browser", true);

// ---- Language ----------------------------------------------------------------
// Follow the OS language (bundled language packs live in the app scope).
pref("intl.locale.requested", "");
pref("extensions.autoDisableScopes", 11);
// Scan the app dir at startup so bundled language packs are picked up.

// ---- Orbit appearance (Settings sheet: gear in the sidebar, Ctrl+,) -------
pref("orbit.theme.intensity", 34);
pref("orbit.theme.radius", 7);
pref("orbit.view.gap", 8);
pref("orbit.effects.glass", false);
pref("orbit.effects.nebula", true);
pref("orbit.effects.grain", true);
pref("orbit.effects.animations", true);
pref("browser.theme.toolbar-theme", 0);

pref("orbit.theme.font", "Outfit");
pref("orbit.fonts.custom", "[]");
pref("extensions.startupScanScopes", 4);
// Only the profile and Orbit's own install dir may provide add-ons this way.
pref("extensions.sideloadScopes", 5);
