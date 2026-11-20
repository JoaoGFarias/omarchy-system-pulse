const test = require("node:test")
const assert = require("node:assert")
const { parseLoad } = require("../testlib/load-model")

test("parseLoad reads the three averages from /proc/loadavg", () => {
  assert.deepStrictEqual([...parseLoad("0.52 1.05 2.50 2/1234 56789\n")], [0.52, 1.05, 2.5])
})

test("parseLoad accepts surrounding whitespace and bare numbers", () => {
  assert.deepStrictEqual([...parseLoad("  3 4 5  ")], [3, 4, 5])
  assert.deepStrictEqual([...parseLoad("0.00 0.00 0.00")], [0, 0, 0])
})

test("parseLoad returns null for malformed input", () => {
  assert.strictEqual(parseLoad(""), null)
  assert.strictEqual(parseLoad(undefined), null)
  assert.strictEqual(parseLoad("0.5 1.0"), null)
  assert.strictEqual(parseLoad("a b c"), null)
  assert.strictEqual(parseLoad("0.5 1.0 x"), null)
  assert.strictEqual(parseLoad("-1 0 0"), null)
  assert.strictEqual(parseLoad("1e3 0 0"), null)
  assert.strictEqual(parseLoad("x 0.5 1.0 2.0"), null)
})

test("parseLoad handles multi-digit values and repeated whitespace", () => {
  assert.deepStrictEqual([...parseLoad("12.5  34.25   56.75 1/2 3")], [12.5, 34.25, 56.75])
  assert.deepStrictEqual([...parseLoad("10\t20\t30")], [10, 20, 30])
})
