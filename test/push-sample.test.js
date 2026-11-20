const test = require("node:test")
const assert = require("node:assert")
const { pushSample } = require("../testlib/load-model")

test("pushSample appends and returns a new array", () => {
  const buf = [1, 2]
  const out = pushSample(buf, 3, 5)
  assert.deepStrictEqual([...out], [1, 2, 3])
  assert.notStrictEqual(out, buf)
})

test("pushSample drops the oldest samples beyond max", () => {
  assert.deepStrictEqual([...pushSample([1, 2, 3], 4, 3)], [2, 3, 4])
  assert.deepStrictEqual([...pushSample([1, 2, 3, 4, 5], 6, 3)], [4, 5, 6])
  assert.deepStrictEqual([...pushSample([1, 2], 3, 3)], [1, 2, 3])
  assert.deepStrictEqual([...pushSample([], 1, 1)], [1])
})

test("pushSample never mutates its input", () => {
  const buf = [1, 2, 3]
  pushSample(buf, 4, 3)
  pushSample(buf, NaN, 3)
  assert.deepStrictEqual(buf, [1, 2, 3])
})

test("pushSample ignores non-finite values but still returns a copy", () => {
  for (const bad of [NaN, Infinity, -Infinity, undefined, null, "5"]) {
    const buf = [1, 2]
    const out = pushSample(buf, bad, 5)
    assert.deepStrictEqual([...out], [1, 2])
    assert.notStrictEqual(out, buf)
  }
})

test("pushSample accepts zero and negative numbers", () => {
  assert.deepStrictEqual([...pushSample([1], 0, 5)], [1, 0])
  assert.deepStrictEqual([...pushSample([1], -2, 5)], [1, -2])
})

test("pushSample with max below 1 yields an empty buffer", () => {
  assert.deepStrictEqual([...pushSample([1, 2], 3, 0)], [])
  assert.deepStrictEqual([...pushSample([1, 2], 3, -4)], [])
  assert.deepStrictEqual([...pushSample([1, 2], 3, NaN)], [])
})

test("pushSample truncates a non-integer max", () => {
  assert.deepStrictEqual([...pushSample([1, 2, 3], 4, 2.9)], [3, 4])
})

test("pushSample trims an already oversized buffer", () => {
  assert.deepStrictEqual([...pushSample([1, 2, 3, 4], NaN, 2)], [3, 4])
})
