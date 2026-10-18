// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// node tools/check-orbit.mjs
import assert from "node:assert/strict";
import { contentRange, parseProxy, resolveOrbitURL, zipOffset } from "../src/browser/base/content/orbit/orbit-pure.mjs";

assert.deepEqual(parseProxy("socks5://127.0.0.1:9050"), { kind: "socks5", host: "127.0.0.1", port: 9050 });
assert.deepEqual(parseProxy("https://proxy.example:443"), { kind: "http", host: "proxy.example", port: 443 });
assert.equal(parseProxy("socks5://user:pass@127.0.0.1:9050"), null);
assert.equal(parseProxy("http://evil"), null);
assert.equal(parseProxy("socks5://127.0.0.1:0"), null);

assert.equal(contentRange("bytes 0-0/100", 0, 0, 100), true);
assert.equal(contentRange("bytes 4-7/8", 4, 7, 8), true);
assert.equal(contentRange("bytes 0-3/8", 4, 7, 8), false);
assert.equal(contentRange("bytes 4-7/9", 4, 7, 8), false);
assert.equal(contentRange("bytes 4-7/*", 4, 7, 8), true);

function u32(n) {
  return [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255];
}
const crx3 = new Uint8Array([0x43, 0x72, 0x32, 0x34, ...u32(3), ...u32(4), 0, 0, 0, 0]);
assert.equal(zipOffset(crx3), 16);
const crx2 = new Uint8Array([0x43, 0x72, 0x32, 0x34, ...u32(2), ...u32(2), ...u32(3)]);
assert.equal(zipOffset(crx2), 21);
assert.equal(zipOffset(new Uint8Array([0x50, 0x4b, 0x03, 0x04])), 0);
assert.throws(() => zipOffset(new Uint8Array([1, 2, 3, 4, 0, 0, 0, 0])));

assert.equal(resolveOrbitURL("orbit://home"), "orbit:home");
assert.equal(resolveOrbitURL("orbit:preferences#privacy"), "about:preferences#privacy");
assert.equal(resolveOrbitURL("orbit://credits"), "orbit:about");
assert.equal(resolveOrbitURL("https://example.com"), null);

console.log("orbit checks ok");
