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

NOTICE = f"""{NAME} is a modified version of uBlock Origin Lite by Raymond Hill
(https://github.com/uBlockOrigin/uBOL-home), licensed under GPL-3.0 (LICENSE.txt).
Changes for Orbit: name, icons, add-on id, and extra filter lists enabled by
default ({", ".join(sorted(EXTRA_LISTS))}). The complete source is this package.
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
        zout.writestr("NOTICE-ORBIT.txt", NOTICE)
    # Self-check: the result loads as Orbit Blocker with the extra lists on.
    with zipfile.ZipFile(out) as z:
        m = json.loads(z.read("manifest.json"))
        assert m["browser_specific_settings"]["gecko"]["id"] == ADDON_ID and m["name"] == NAME
        on = {r["id"] for r in json.loads(z.read("rulesets/ruleset-details.json")) if r.get("enabled")}
        assert EXTRA_LISTS <= on, on
        assert not any(n.startswith("META-INF/") for n in z.namelist())
    print(out)


if __name__ == "__main__":
    main(*sys.argv[1:3])
