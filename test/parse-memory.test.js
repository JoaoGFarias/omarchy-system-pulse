const test = require("node:test")
const assert = require("node:assert")
const near = require("../testlib/near")
const { parseMemory } = require("../testlib/load-model")

test("parseMemory uses MemAvailable, not MemFree", () => {
  const m = parseMemory("MemTotal:       16777216 kB\nMemAvailable:    4194304 kB\n")
  near(m.totalGb, 16)
  near(m.usedGb, 12)
  near(m.pct, 75)
})

test("parseMemory ignores other lines and handles missing or odd data", () => {
  assert.strictEqual(parseMemory("MemTotal: 100 kB"), null)
  assert.strictEqual(parseMemory(""), null)
  assert.strictEqual(parseMemory("MemTotal: 100 kB\nMemAvailable: 200 kB"), null)
  assert.strictEqual(parseMemory("MemTotal: 0 kB\nMemAvailable: 0 kB"), null)
  near(parseMemory("cpu  1 2 3 4\nMemTotal: 1048576 kB\nMemAvailable: 524288 kB").pct, 50)
})

const MEMINFO = (extra) => [
  "MemTotal:       16777216 kB",
  "MemFree:         1048576 kB",
  extra,
  "SwapTotal:       8388608 kB",
  ""
].join("\n")

test("parseMemory only matches keys at the start of a line", () => {
  // Decoys with a prefix must not override the real MemTotal / MemAvailable.
  const text = [
    "SwapMemTotal:    1048576 kB",
    "MemTotal:       16777216 kB",
    "HugeMemAvailable: 16777216 kB",
    "MemAvailable:    4194304 kB",
    "  MemTotal:      1048576 kB"
  ].join("\n")
  const m = parseMemory(text)
  near(m.totalGb, 16)
  near(m.usedGb, 12)
  near(m.pct, 75)
  // A prefixed key alone is not a valid reading.
  assert.strictEqual(parseMemory("XMemTotal: 100 kB\nXMemAvailable: 50 kB"), null)
})

test("parseMemory reports 100% used when MemAvailable is 0", () => {
  const m = parseMemory(MEMINFO("MemAvailable:             0 kB"))
  near(m.totalGb, 16)
  near(m.usedGb, 16)
  near(m.pct, 100)
})

test("parseMemory reports 0% used when MemAvailable equals MemTotal", () => {
  const m = parseMemory(MEMINFO("MemAvailable:      16777216 kB"))
  near(m.totalGb, 16)
  near(m.usedGb, 0)
  near(m.pct, 0)
})
