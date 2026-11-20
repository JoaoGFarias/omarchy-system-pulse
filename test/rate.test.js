const test = require("node:test")
const assert = require("node:assert")
const near = require("../testlib/near")
const { rate } = require("../testlib/load-model")

test("rate is bytes per second for the given interval", () => {
  near(rate(1000, 3000, 2000), 1000)
  near(rate(0, 500, 500), 1000)
  assert.strictEqual(rate(100, 100, 1000), 0)
})

test("rate is null when the counter went backwards", () => {
  assert.strictEqual(rate(2000, 1999, 1000), null)
})

test("rate is null for an unusable interval", () => {
  assert.strictEqual(rate(0, 10, 0), null)
  assert.strictEqual(rate(0, 10, -5), null)
  assert.strictEqual(rate(0, 10, NaN), null)
})

test("rate is null for non-finite counters", () => {
  assert.strictEqual(rate(NaN, 10, 1000), null)
  assert.strictEqual(rate(0, NaN, 1000), null)
  assert.strictEqual(rate(0, Infinity, 1000), null)
  assert.strictEqual(rate(-Infinity, 10, 1000), null)
})
