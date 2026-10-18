#!/bin/sh
# Dev helper: kill the dev browser, relaunch with Marionette, wait for it.
cd "$(dirname "$0")/.."
powershell -NoProfile -c "Get-CimInstance Win32_Process -Filter \"name='firefox.exe'\" | ? { \$_.ExecutablePath -like '*Orbit\.dev*' } | % { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }" 2>/dev/null
sleep 1
node tools/dev.mjs --marionette "$@" > .dev/log.txt 2>&1
for i in $(seq 1 90); do node tools/mn.mjs eval "return typeof OrbitSpaces" 2>/dev/null | grep -q object && break; sleep 1; done
sleep 2
