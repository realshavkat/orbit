/* Orbit Blocker only runs in Orbit: anywhere else it removes itself.
 * GPL-3.0 like the add-on. */
"use strict";
browser.runtime.getBrowserInfo().then(info => {
  if (!/^Orbit/.test(info.name)) browser.management.uninstallSelf({ showConfirmDialog: false });
});
