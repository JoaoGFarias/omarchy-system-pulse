const test = require("node:test")
const assert = require("node:assert")
const model = require("../testlib/load-model")
// The model runs in a vm context, so copy its result into this realm for deepStrictEqual.
const parseDiskstats = (text) => ({ ...model.parseDiskstats(text) })

const row = (name, rd, wr) => ` 8 0 ${name} 1 2 ${rd} 4 5 6 ${wr} 8 0 9 10\n`

test("parseDiskstats converts 512-byte sectors of a whole device", () => {
  assert.deepStrictEqual(parseDiskstats(row("nvme0n1", 10, 20)), { readBytes: 5120, writeBytes: 10240 })
})

test("parseDiskstats sums whole devices of every supported kind", () => {
  const text = row("nvme0n1", 1, 2) + row("nvme1n2", 1, 2) + row("sda", 1, 2) + row("sdab", 1, 2) +
    row("vda", 1, 2) + row("xvda", 1, 2) + row("mmcblk0", 1, 2)
  assert.deepStrictEqual(parseDiskstats(text), { readBytes: 7 * 512, writeBytes: 14 * 512 })
})

test("parseDiskstats ignores partitions", () => {
  const text = row("nvme0n1p1", 9, 9) + row("sda1", 9, 9) + row("vda2", 9, 9) + row("mmcblk0p1", 9, 9)
  assert.deepStrictEqual(parseDiskstats(text), { readBytes: 0, writeBytes: 0 })
})

test("parseDiskstats ignores loop, ram, dm, zram and look-alike names", () => {
  const text = row("loop0", 9, 9) + row("ram0", 9, 9) + row("dm-0", 9, 9) + row("zram0", 9, 9) +
    row("sr0", 9, 9) + row("xsda", 9, 9) + row("sda_", 9, 9) + row("nvme0n1x", 9, 9) + row("nvme0", 9, 9) +
    row("mmcblk", 9, 9) + row("sd", 9, 9)
  assert.deepStrictEqual(parseDiskstats(text), { readBytes: 0, writeBytes: 0 })
})

test("parseDiskstats uses the sectors-read and sectors-written columns", () => {
  const text = "8 0 sda 100 200 3 400 500 600 7 800\n"
  assert.deepStrictEqual(parseDiskstats(text), { readBytes: 3 * 512, writeBytes: 7 * 512 })
})

test("parseDiskstats accepts exactly ten columns", () => {
  assert.deepStrictEqual(parseDiskstats("8 0 sda 1 2 3 4 5 6 7\n"), { readBytes: 1536, writeBytes: 3584 })
})

test("parseDiskstats ignores short, non-numeric and empty input", () => {
  assert.deepStrictEqual(parseDiskstats(""), { readBytes: 0, writeBytes: 0 })
  assert.deepStrictEqual(parseDiskstats(undefined), { readBytes: 0, writeBytes: 0 })
  assert.deepStrictEqual(parseDiskstats("8 0 sda 1 2 3 4 5 6\n"), { readBytes: 0, writeBytes: 0 })
  assert.deepStrictEqual(parseDiskstats("8 0 sda 1 2 x 4 5 6 7\n"), { readBytes: 0, writeBytes: 0 })
  assert.deepStrictEqual(parseDiskstats("8 0 sda 1 2 3 4 5 6 y\n"), { readBytes: 0, writeBytes: 0 })
})

test("parseDiskstats parses this machine's real /proc/diskstats", { skip: process.platform !== "linux" }, () => {
  const text = require("node:fs").readFileSync("/proc/diskstats", "utf8")
  const r = parseDiskstats(text)
  assert.ok(Number.isFinite(r.readBytes) && r.readBytes >= 0)
  assert.ok(Number.isFinite(r.writeBytes) && r.writeBytes >= 0)
})

test("parseDiskstats handles multi-digit device numbers and column padding", () => {
  const text = row("nvme10n12", 1, 2) + row("mmcblk12", 1, 2) + "   8    0 sda   1  2  3  4  5  6  7  8\n"
  assert.deepStrictEqual(parseDiskstats(text), { readBytes: 5 * 512, writeBytes: 11 * 512 })
})
