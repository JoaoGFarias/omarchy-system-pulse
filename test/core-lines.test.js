const test = require("node:test")
const assert = require("node:assert")
const near = require("../testlib/near")
const { parseCoreLines, coreUsage } = require("../testlib/load-model")

test("parseCoreLines indexes cores and skips the aggregate line", () => {
  const cores = parseCoreLines("cpu  9 9 9 9\ncpu0 10 0 10 80\ncpu1 20 0 20 60\nintr 5")
  assert.strictEqual(cores.length, 2)
  assert.deepStrictEqual({ ...cores[0] }, { total: 100, idle: 80 })
  assert.deepStrictEqual({ ...cores[1] }, { total: 100, idle: 60 })
})

test("parseCoreLines fills gaps with null and returns [] for no cores", () => {
  const cores = parseCoreLines("cpu0 10 0 10 80\ncpu2 1 1 1 1")
  assert.strictEqual(cores.length, 3)
  assert.strictEqual(cores[1], null)
  assert.strictEqual(parseCoreLines("MemTotal: 1 kB").length, 0)
})

test("coreUsage computes per core and falls back to 0", () => {
  const prev = [{ total: 100, idle: 80 }, null]
  const cur = [{ total: 200, idle: 130 }, { total: 10, idle: 5 }]
  const u = coreUsage(prev, cur)
  near(u[0], 50)
  assert.strictEqual(u[1], 0)
  assert.deepStrictEqual([...coreUsage(null, cur)], [0, 0])
})

// Realistic /proc/stat: two-space aggregate line, cpu0..cpu23, then other keys.
function procStat(cores) {
  const lines = ["cpu  9999 9 9999 99999 9 9 9 0 0 0"]
  for (let i = 0; i < cores; i++) lines.push(`cpu${i} ${i + 1} 0 ${i + 1} ${100 + i} 0 0 0 0 0 0`)
  lines.push("intr 12345 cpu3 1 2 3 4", "ctxt 99", "btime 1")
  return lines.join("\n")
}

test("parseCoreLines handles core indexes of 10 and above (24 threads)", () => {
  const cores = parseCoreLines(procStat(24))
  assert.strictEqual(cores.length, 24)
  for (let i = 0; i < 24; i++) {
    assert.deepStrictEqual({ ...cores[i] }, { total: 2 * (i + 1) + 100 + i, idle: 100 + i }, `cpu${i}`)
  }
})

test("parseCoreLines does not mistake a high index for its leading digit", () => {
  const cores = parseCoreLines("cpu12 1 0 1 8")
  assert.strictEqual(cores.length, 13)
  assert.strictEqual(cores[1], null)
  assert.deepStrictEqual({ ...cores[12] }, { total: 10, idle: 8 })
})

test("parseCoreLines only accepts lines that start with cpuN", () => {
  const cores = parseCoreLines("xcpu0 1 2 3 4\n intr cpu3 1 2 3 4\nintr cpu3 1 2 3 4\ncpu1 10 0 10 80")
  assert.strictEqual(cores.length, 2)
  assert.strictEqual(cores[0], null)
  assert.deepStrictEqual({ ...cores[1] }, { total: 100, idle: 80 })
})

test("parseCoreLines tolerates repeated whitespace after the label", () => {
  const cores = parseCoreLines("cpu0   10 0 10 80\ncpu1\t20 0 20 60")
  assert.deepStrictEqual({ ...cores[0] }, { total: 100, idle: 80 })
  assert.deepStrictEqual({ ...cores[1] }, { total: 100, idle: 60 })
})
