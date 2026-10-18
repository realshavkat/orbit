# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
"""One-off: turns `fr ? "Bonjour" : "Hello"` ternaries into Orbit.tr("Hello", "Bonjour").

Usage: python tools/i18n_refactor.py src/browser/base/content/orbit/*.js
Prints, per file, how many ternaries it rewrote and any it could not.
"""
import re
import sys

STR = r'(?:"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)'
COND = r'(?:fr|Orbit\.lang\(\)\s*==\s*"fr")'
TERNARY = re.compile(rf'{COND}\s*\?\s*({STR})\s*:\s*({STR})', re.S)

for path in sys.argv[1:]:
    src = open(path, encoding="utf-8", newline="").read()
    out, n = TERNARY.subn(lambda m: f"Orbit.tr({m.group(2)}, {m.group(1)})", src)
    left = re.findall(rf'{COND}\s*\?', out)
    if n:
        open(path, "w", encoding="utf-8", newline="").write(out)
    print(f"{path}: {n} rewritten, {len(left)} left")
