const test = require("node:test")
const assert = require("node:assert")
const { section } = require("../testlib/load-model")

test("returns the lines under the marker", () => {
  assert.strictEqual(section("#a\n1\n2\n#b\n3", "a"), "1\n2")
})

test("stops at the next marker and finds later sections", () => {
  assert.strictEqual(section("#a\n1\n#b\n3\n4", "b"), "3\n4")
})

test("ignores lines before any marker", () => {
  assert.strictEqual(section("x\n#a\n1", "a"), "1")
})

test("missing marker gives an empty string", () => {
  assert.strictEqual(section("#a\n1", "z"), "")
})

test("does not match a marker that only starts with the name", () => {
  assert.strictEqual(section("#ab\n1", "a"), "")
})

test("a later marker for another name ends the section", () => {
  assert.strictEqual(section("#a\n1\n#c\n2", "a"), "1")
})

test("non-string input gives an empty string", () => {
  assert.strictEqual(section(null, "a"), "")
})
