const test = require("node:test")
const assert = require("node:assert")
const near = require("../testlib/near")
const { parseSwap } = require("../testlib/load-model")

test("parseSwap computes used from SwapTotal and SwapFree", () => {
  const s = parseSwap("SwapTotal:       8388608 kB\nSwapFree:        2097152 kB\n")
  near(s.totalGb, 8)
  near(s.usedGb, 6)
  near(s.pct, 75)
})

test("parseSwap ignores other lines and handles fully free or fully used swap", () => {
  near(parseSwap("MemTotal: 5 kB\nSwapTotal: 1048576 kB\nSwapFree: 1048576 kB\nHugePages: 0").pct, 0)
  near(parseSwap("SwapTotal: 1048576 kB\nSwapFree: 0 kB").pct, 100)
})

test("parseSwap returns null for zero swap (the popup hides the row)", () => {
  assert.strictEqual(parseSwap("SwapTotal: 0 kB\nSwapFree: 0 kB"), null)
})

test("parseSwap returns null for missing or inconsistent values", () => {
  assert.strictEqual(parseSwap(""), null)
  assert.strictEqual(parseSwap(undefined), null)
  assert.strictEqual(parseSwap("SwapTotal: 100 kB"), null)
  assert.strictEqual(parseSwap("SwapFree: 100 kB"), null)
  assert.strictEqual(parseSwap("SwapTotal: 100 kB\nSwapFree: 200 kB"), null)
  assert.strictEqual(parseSwap("SwapTotal: abc kB\nSwapFree: 1 kB"), null)
})

test("parseSwap only accepts lines that start with the key", () => {
  assert.strictEqual(parseSwap("xSwapTotal: 100 kB\nSwapFree: 50 kB"), null)
})
