/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function () {
  const doc = document;
  if (doc.documentElement.hasAttribute("orbit-pip")) return;
  doc.documentElement.setAttribute("orbit-pip", "true");
  const link = doc.createElementNS("http://www.w3.org/1999/xhtml", "link");
  link.rel = "stylesheet";
  link.href = "chrome://orbit/content/orbit-pip.css";
  doc.head.append(link);
})();
