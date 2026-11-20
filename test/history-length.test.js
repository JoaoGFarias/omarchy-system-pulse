const test = require("node:test")
const assert = require("node:assert")
const { historyLength } = require("../testlib/load-model")

test("historyLength is 60 s worth of samples, rounded", () => {
  assert.strictEqual(historyLength(2000), 30)
  assert.strictEqual(historyLength(1000), 60)
  assert.strictEqual(historyLength(3000), 20)
  assert.strictEqual(historyLength(1700), 35) // 35.29
  assert.strictEqual(historyLength(1600), 38) // 37.5 rounds up
})

test("historyLength is bounded to 10-120 inclusive", () => {
  assert.strictEqual(historyLength(500), 120)
  assert.strictEqual(historyLength(100), 120)
  assert.strictEqual(historyLength(600), 100)
  assert.strictEqual(historyLength(5000), 12)
  assert.strictEqual(historyLength(6000), 10)
  assert.strictEqual(historyLength(10000), 10)
  assert.strictEqual(historyLength(60000), 10)
  assert.strictEqual(historyLength(480), 120)
  assert.strictEqual(historyLength(520), 115)
})

test("historyLength falls back to 30 for unusable intervals", () => {
  for (const bad of [0, -5, NaN, Infinity, undefined, null, "abc"]) assert.strictEqual(historyLength(bad), 30)
})
