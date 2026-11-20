const test = require("node:test")
const assert = require("node:assert")
const { formatUptime } = require("../testlib/load-model")

test("formatUptime shows seconds under a minute", () => {
  assert.strictEqual(formatUptime(0), "0s")
  assert.strictEqual(formatUptime(59), "59s")
})

test("formatUptime shows minutes under an hour", () => {
  assert.strictEqual(formatUptime(60), "1m")
  assert.strictEqual(formatUptime(3599), "59m")
})

test("formatUptime shows hours and minutes under a day", () => {
  assert.strictEqual(formatUptime(3600), "1h 0m")
  assert.strictEqual(formatUptime(86399), "23h 59m")
})

test("formatUptime shows days and hours from a day up", () => {
  assert.strictEqual(formatUptime(86400), "1d 0h")
  assert.strictEqual(formatUptime(90061), "1d 1h")
  assert.strictEqual(formatUptime(3 * 86400 + 4 * 3600 + 5), "3d 4h")
})

test("formatUptime truncates fractions and returns an empty string for invalid input", () => {
  assert.strictEqual(formatUptime(59.9), "59s")
  assert.strictEqual(formatUptime(-1), "")
  assert.strictEqual(formatUptime(NaN), "")
  assert.strictEqual(formatUptime(Infinity), "")
  assert.strictEqual(formatUptime("90061"), "1d 1h")
  assert.strictEqual(formatUptime(null), "")
  assert.strictEqual(formatUptime(""), "")
})
