const test = require("node:test")
const assert = require("node:assert")
const { clampInterval } = require("../testlib/load-model")

test("clampInterval keeps the setting between 500 and 10000 ms", () => {
  assert.strictEqual(clampInterval(1000), 1000)
  assert.strictEqual(clampInterval("1500"), 1500)
  assert.strictEqual(clampInterval(10), 500)
  assert.strictEqual(clampInterval(60000), 10000)
  for (const bad of [undefined, null, "", "abc", NaN, Infinity]) assert.strictEqual(clampInterval(bad), 2000)
})
