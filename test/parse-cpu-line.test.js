const test = require("node:test")
const assert = require("node:assert")
const { parseCpuLine } = require("../testlib/load-model")

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

test("parseCpuLine ignores trailing whitespace and newline", () => {
  const expected = { total: 1000, idle: 850 }
  assert.deepStrictEqual({ ...parseCpuLine("cpu  100 0 50 800 50 0 0 0 0 0 ") }, expected)
  assert.deepStrictEqual({ ...parseCpuLine("cpu  100 0 50 800 50 0 0 0 0 0\n") }, expected)
  assert.deepStrictEqual({ ...parseCpuLine("cpu 10 0 10 80  \t\n") }, { total: 100, idle: 80 })
})

test("parseCpuLine requires the line to start with 'cpu ' (no leading whitespace)", () => {
  assert.strictEqual(parseCpuLine(" cpu  100 0 50 800"), null)
})

test("parseCpuLine does not let trailing whitespace pad a short line to four fields", () => {
  assert.strictEqual(parseCpuLine("cpu  1 2 3 "), null)
  assert.strictEqual(parseCpuLine("cpu  1 2 3\n"), null)
})
