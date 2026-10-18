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

// ---- Speed: results and pages show up sooner ---------------------------------
// Address bar results with no artificial delay.
pref("browser.urlbar.delay", 0);
// More parallel connections and longer-lived DNS/TLS caches.
pref("network.http.max-persistent-connections-per-server", 10);
pref("network.http.speculative-parallel-limit", 10);
pref("network.dnsCacheEntries", 1000);
pref("network.dnsCacheExpiration", 3600);
pref("network.ssl_tokens_cache_capacity", 10240);
// Paint the page as soon as content arrives.
pref("content.notify.interval", 100000);
pref("gfx.webrender.all", true);
// Restored tabs load only when opened (fast start, little memory).
pref("browser.sessionstore.restore_on_demand", true);
pref("browser.sessionstore.restore_pinned_tabs_on_demand", true);

// ---- Security against profile theft --------------------------------------------
// Windows sign-in before showing or exporting a saved password.
pref("signon.management.page.os-auth.locked.enabled", true);

pref("orbit.downloads.turbo", true);
pref("orbit.downloads.connections", 8);

// ---- Security hardening (on by default, keeps every site working) -----------
// Phishing: show internationalized look-alike domains as punycode.
pref("network.IDN_show_punycode", true);
// No JavaScript inside PDF files (a classic exploit path).
pref("pdfjs.enableScripting", false);
// Revoked certificates are caught locally (CRLite) without leaking visits.
pref("security.pki.crlite_mode", 2);
// Full certificate details on error pages; "Not secure" on HTTP pages.
pref("browser.xul.error_pages.expert_bad_cert", true);
pref("security.insecure_connection_text.enabled", true);
// Other sites only learn the origin you came from, never the full address.
pref("network.http.referer.XOriginTrimmingPolicy", 2);
// No login prompts from third-party images (phishing trick).
pref("network.auth.subresource-http-auth-allow", 1);
// Fingerprinting protection in every window, no battery or ping tracking.
pref("privacy.fingerprintingProtection", true);
pref("dom.battery.enabled", false);
pref("browser.send_pings", false);
// Fewer background calls home; downloads are checked locally only.
pref("network.captive-portal-service.enabled", false);
pref("network.connectivity-service.enabled", false);
pref("browser.safebrowsing.downloads.remote.enabled", false);
pref("browser.tabs.crashReporting.sendReport", false);
// No TLS early data (replayable requests).
pref("security.tls.enable_0rtt_data", false);
pref("network.http.http3.enable_0rtt", false);
// Encrypted DNS with fallback (Cloudflare through Mozilla's resolver).
pref("network.trr.mode", 2);
pref("network.trr.uri", "https://mozilla.cloudflare-dns.com/dns-query");
// Ask where to save new file types instead of opening them silently.
pref("browser.download.always_ask_before_handling_new_types", true);
pref("orbit.security.fortress", false);

// ---- Speed (networking and rendering) ---------------------------------------------
pref("network.http.pacing.requests.enabled", false);
pref("network.http.max-connections", 1800);
pref("network.http.max-persistent-connections-per-proxy", 48);
pref("gfx.content.skia-font-cache-size", 32);

pref("orbit.performance.preset", "venus");
