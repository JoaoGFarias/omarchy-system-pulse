const test = require("node:test")
const assert = require("node:assert")
const { formatBytesPerSecond: f } = require("../testlib/load-model")

test("formatBytesPerSecond uses whole bytes below 1 KB", () => {
  assert.strictEqual(f(1), "1 B/s")
  assert.strictEqual(f(512), "512 B/s")
  assert.strictEqual(f(1023), "1023 B/s")
})

test("formatBytesPerSecond scales through KB, MB and GB with one decimal", () => {
  assert.strictEqual(f(1024), "1.0 KB/s")
  assert.strictEqual(f(1536), "1.5 KB/s")
  assert.strictEqual(f(1.5 * 1024 * 1024), "1.5 MB/s")
  assert.strictEqual(f(2.25 * 1024 ** 3), "2.3 GB/s")
})

test("formatBytesPerSecond stays in GB for huge values", () => {
  assert.strictEqual(f(2048 * 1024 ** 3), "2048.0 GB/s")
})

test("formatBytesPerSecond reads zero, negative and non-finite as 0 B/s", () => {
  assert.strictEqual(f(0), "0 B/s")
  assert.strictEqual(f(0.4), "0 B/s")
  assert.strictEqual(f(-5), "0 B/s")
  assert.strictEqual(f(NaN), "0 B/s")
  assert.strictEqual(f(Infinity), "0 B/s")
})
