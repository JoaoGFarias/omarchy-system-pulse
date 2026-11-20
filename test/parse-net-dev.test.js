const test = require("node:test")
const assert = require("node:assert")
const model = require("../testlib/load-model")
// The model runs in a vm context, so copy its result into this realm for deepStrictEqual.
const parseNetDev = (text) => ({ ...model.parseNetDev(text) })

const header = "Inter-|   Receive                                                |  Transmit\n" +
  " face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed\n"
const row = (name, rx, tx) => `${name}: ${rx} 1 0 0 0 0 0 0 ${tx} 1 0 0 0 0 0 0\n`

test("parseNetDev sums rx and tx over real interfaces and skips lo", () => {
  const text = header + row("    lo", 1000, 1000) + row("wlp192s0", 10, 20) + row("  eth0", 5, 7)
  assert.deepStrictEqual(parseNetDev(text), { rx: 15, tx: 27 })
})

test("parseNetDev skips veth, docker and br- interfaces", () => {
  const text = row("veth1a2b", 1, 1) + row("docker0", 2, 2) + row("br-abc", 4, 4) + row("eth0", 8, 16)
  assert.deepStrictEqual(parseNetDev(text), { rx: 8, tx: 16 })
})

test("parseNetDev keeps interfaces that merely contain a virtual prefix", () => {
  const text = row("myveth0", 1, 2) + row("xdocker", 4, 8) + row("br0", 16, 32) + row("lo0", 64, 128)
  assert.deepStrictEqual(parseNetDev(text), { rx: 85, tx: 170 })
})

test("parseNetDev reads a name glued to its first counter", () => {
  assert.deepStrictEqual(parseNetDev("eth0:123 1 0 0 0 0 0 0 456 1 0 0 0 0 0 0\n"), { rx: 123, tx: 456 })
})

test("parseNetDev ignores malformed lines and empty input", () => {
  assert.deepStrictEqual(parseNetDev(""), { rx: 0, tx: 0 })
  assert.deepStrictEqual(parseNetDev(header), { rx: 0, tx: 0 })
  assert.deepStrictEqual(parseNetDev(undefined), { rx: 0, tx: 0 })
  assert.deepStrictEqual(parseNetDev("eth0: 1 2 3\n"), { rx: 0, tx: 0 })
  assert.deepStrictEqual(parseNetDev("eth0: x 1 0 0 0 0 0 0 5 1 0 0 0 0 0 0\n"), { rx: 0, tx: 0 })
  assert.deepStrictEqual(parseNetDev("eth0: 1 1 0 0 0 0 0 0 5 1 0 0 0 0 0 x\n"), { rx: 0, tx: 0 })
})

test("parseNetDev accepts exactly nine counters", () => {
  assert.deepStrictEqual(parseNetDev("eth0: 1 1 0 0 0 0 0 0 5\n"), { rx: 1, tx: 5 })
})

test("parseNetDev parses this machine's real /proc/net/dev", { skip: process.platform !== "linux" }, () => {
  const text = require("node:fs").readFileSync("/proc/net/dev", "utf8")
  const r = parseNetDev(text)
  assert.ok(Number.isFinite(r.rx) && r.rx >= 0)
  assert.ok(Number.isFinite(r.tx) && r.tx >= 0)
})

test("parseNetDev handles the column padding of the real file", () => {
  assert.deepStrictEqual(parseNetDev("  eth0:   10    1  0  0  0  0  0  0   20    1  0  0  0  0  0  0\n"), { rx: 10, tx: 20 })
})

test("parseNetDev needs a non-empty interface name before the colon", () => {
  assert.deepStrictEqual(parseNetDev("1 1 0 0 0 0 0 0 5 1 0 0 0 0 0 0\n"), { rx: 0, tx: 0 })
  assert.deepStrictEqual(parseNetDev(": 1 1 0 0 0 0 0 0 5 1 0 0 0 0 0 0\n"), { rx: 0, tx: 0 })
  assert.deepStrictEqual(parseNetDev("e: 1 1 0 0 0 0 0 0 5 1 0 0 0 0 0 0\n"), { rx: 1, tx: 5 })
})
