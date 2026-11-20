const test = require("node:test")
const assert = require("node:assert")
const { clampProcessCount } = require("../testlib/load-model")

test("clampProcessCount keeps the setting between 0 and 15", () => {
  assert.strictEqual(clampProcessCount(0), 0)
  assert.strictEqual(clampProcessCount(1), 1)
  assert.strictEqual(clampProcessCount("7"), 7)
  assert.strictEqual(clampProcessCount(15), 15)
  assert.strictEqual(clampProcessCount(16), 15)
  assert.strictEqual(clampProcessCount(-3), 0)
  assert.strictEqual(clampProcessCount(2.6), 3)
})

test("clampProcessCount falls back to 5 for unusable values", () => {
  for (const bad of [undefined, null, "", "abc", NaN, Infinity, -Infinity]) assert.strictEqual(clampProcessCount(bad), 5)
})
