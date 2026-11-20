const test = require("node:test")
const assert = require("node:assert")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

// SysmonModel.js is a QML library script (it starts with `.pragma library`,
// which is not JavaScript), so strip that line and load it into a plain context.
const ctx = {}
vm.createContext(ctx)
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "SysmonModel.js"), "utf8").replace(/^\.pragma.*$/m, ""), ctx)
const { parseCpuLine, cpuPercent, parseMemory } = ctx

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`)

test("parseCpuLine sums all fields and counts iowait as idle", () => {
  const s = parseCpuLine("cpu  100 0 50 800 50 0 0 0 0 0")
  assert.deepStrictEqual({ ...s }, { total: 1000, idle: 850 })
})

test("parseCpuLine tolerates kernels with only four fields", () => {
  assert.deepStrictEqual({ ...parseCpuLine("cpu 10 0 10 80") }, { total: 100, idle: 80 })
})

test("parseCpuLine rejects per-core lines, junk and negatives", () => {
  assert.strictEqual(parseCpuLine("cpu0 1 2 3 4"), null)
  assert.strictEqual(parseCpuLine("cpu  a b c d"), null)
  assert.strictEqual(parseCpuLine("cpu  1 2 3"), null)
  assert.strictEqual(parseCpuLine("cpu  -1 0 0 5"), null)
  assert.strictEqual(parseCpuLine(undefined), null)
})

test("cpuPercent computes busy share between two samples", () => {
  near(cpuPercent({ total: 1000, idle: 800 }, { total: 1100, idle: 850 }), 50)
  near(cpuPercent({ total: 1000, idle: 800 }, { total: 1100, idle: 900 }), 0)
  near(cpuPercent({ total: 1000, idle: 800 }, { total: 1100, idle: 800 }), 100)
})

test("cpuPercent returns null without a usable previous sample", () => {
  assert.strictEqual(cpuPercent(null, { total: 10, idle: 5 }), null)
  assert.strictEqual(cpuPercent({ total: 10, idle: 5 }, { total: 10, idle: 5 }), null)
  assert.strictEqual(cpuPercent({ total: 10, idle: 5 }, { total: 5, idle: 2 }), null)
})

test("cpuPercent clamps to 0-100", () => {
  assert.strictEqual(cpuPercent({ total: 0, idle: 0 }, { total: 100, idle: 150 }), 0)
  assert.strictEqual(cpuPercent({ total: 0, idle: 100 }, { total: 100, idle: 0 }), 100)
})

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
