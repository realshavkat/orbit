# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
"""Build Orbit Blocker from an uBlock Origin Lite release.

Orbit Blocker is uBO Lite (GPL-3.0, Raymond Hill) with Orbit's name and
icons and stricter defaults: anti-spyware URLs, cookie banners and public
sites probing the local network are blocked out of the box. The add-on stays
GPL-3.0: its license and full source ship inside the .xpi.

Usage: python tools/orbit_blocker.py <uBOLite.xpi> <out-dir>
"""
import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ADDON_ID = "orbit-blocker@orbit.app"
NAME = "Orbit Blocker"
# Lists enabled by default on top of uBO Lite's own defaults.
EXTRA_LISTS = {"adguard-spyware-url", "annoyances-cookies", "block-lan"}
ICONS = ROOT / "assets" / "blocker"
POPUP = ICONS / "popup"
# Orbit's popup layer (simple / advanced mode) and the font it uses.
EXTRA_FILES = {
    "css/orbit-popup.css": POPUP / "orbit-popup.css",
    "js/orbit-popup.js": POPUP / "orbit-popup.js",
    "fonts/Outfit.ttf": ROOT / "src/browser/base/content/orbit/fonts/Outfit.ttf",
}

NOTICE = f"""{NAME} is a modified version of uBlock Origin Lite by Raymond Hill
(https://github.com/uBlockOrigin/uBOL-home), licensed under GPL-3.0 (LICENSE.txt).
Changes for Orbit: name, icons, add-on id, an Orbit-styled popup with a simple
and an advanced mode (css/orbit-popup.css, js/orbit-popup.js), and extra filter
lists enabled by default ({", ".join(sorted(EXTRA_LISTS))}). The complete source is this package.
"""


def patch(name, data):
    if name.startswith("META-INF/"):
        return None  # the Mozilla signature no longer matches; Orbit loads it unsigned
    if name == "manifest.json":
        m = json.loads(data)
        m["name"] = m["short_name"] = NAME
        m["author"] = "Raymond Hill (uBO Lite), Orbit"
        m["browser_specific_settings"]["gecko"]["id"] = ADDON_ID
        m["browser_specific_settings"]["gecko"].pop("update_url", None)
        return json.dumps(m, indent=2, ensure_ascii=False).encode()
    if re.fullmatch(r"_locales/[^/]+/messages\.json", name):
        msgs = json.loads(data)
        # Every string that names the add-on (titles, dashboard...) says Orbit Blocker.
        for msg in msgs.values():
            m = msg.get("message", "")
            msg["message"] = m.replace("uBlock Origin Lite", NAME).replace("uBO Lite", NAME)
        if "extName" in msgs:
            msgs["extName"]["message"] = NAME
        return json.dumps(msgs, indent=1, ensure_ascii=False).encode()
    if name == "rulesets/ruleset-details.json":
        details = json.loads(data)
        for r in details:
            if r["id"] in EXTRA_LISTS:
                r["enabled"] = True
        return json.dumps(details, ensure_ascii=False).encode()
    m = re.fullmatch(r"img/icon_(\d+)(_off)?\.png", name)
    if m:
        return (ICONS / f"{'off' if m.group(2) else 'on'}-{m.group(1)}.png").read_bytes()
    if name == "img/ublock.svg":
        return (ICONS / "shield-on.svg").read_bytes()
    if name == "popup.html":
        data = data.replace(b"</head>", b'<link rel="stylesheet" href="css/orbit-popup.css">\n</head>')
        data = data.replace(b"</body>", b'<script src="js/orbit-popup.js" type="module"></script>\n</body>')
    if name.endswith(".html"):
        return data.replace(b"uBO Lite", NAME.encode()).replace(b"uBlock Origin Lite", NAME.encode())
    return data


def main(src, out_dir):
    out = Path(out_dir) / f"{ADDON_ID}.xpi"
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            if info.is_dir():
                continue
            data = patch(info.filename, zin.read(info.filename))
            if data is not None:
                zout.writestr(info.filename, data)
        for arc, path in EXTRA_FILES.items():
            zout.writestr(arc, path.read_bytes())
        zout.writestr("NOTICE-ORBIT.txt", NOTICE)
    # Self-check: the result loads as Orbit Blocker with the extra lists on.
    with zipfile.ZipFile(out) as z:
        m = json.loads(z.read("manifest.json"))
        assert m["browser_specific_settings"]["gecko"]["id"] == ADDON_ID and m["name"] == NAME
        on = {r["id"] for r in json.loads(z.read("rulesets/ruleset-details.json")) if r.get("enabled")}
        assert EXTRA_LISTS <= on, on
        assert not any(n.startswith("META-INF/") for n in z.namelist())
        assert b"orbit-popup.js" in z.read("popup.html")
    print(out)


if __name__ == "__main__":
    main(*sys.argv[1:3])
