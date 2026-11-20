const test = require("node:test")
const assert = require("node:assert")
const near = require("../testlib/near")
const { parseTemperature } = require("../testlib/load-model")

test("parseTemperature converts millidegrees and rejects nonsense", () => {
  near(parseTemperature("MemTotal: 1 kB\ntemp 54250\n"), 54.25)
  assert.strictEqual(parseTemperature("temp \n"), null)
  assert.strictEqual(parseTemperature("nothing"), null)
  assert.strictEqual(parseTemperature("temp 999000"), null)
})

test("parseTemperature finds the temp line among other lines", () => {
  const text = "cpu  1 2 3 4\ntemp 54250\nMemTotal: 1 kB\n"
  near(parseTemperature(text), 54.25)
})

test("parseTemperature ignores lines that merely contain temp", () => {
  assert.strictEqual(parseTemperature("xtemp 5000\n"), null)
  assert.strictEqual(parseTemperature(" temp 5000\n"), null)
  assert.strictEqual(parseTemperature("cpu 1\nxtemp 5000\nMemTotal: 1 kB\n"), null)
})

test("parseTemperature rejects trailing junk after the number", () => {
  assert.strictEqual(parseTemperature("temp 5000abc\n"), null)
  assert.strictEqual(parseTemperature("temp 5000 abc\n"), null)
})

test("parseTemperature accepts a bare line and trailing whitespace", () => {
  near(parseTemperature("temp 54250"), 54.25)
  near(parseTemperature("temp 54250  "), 54.25)
  near(parseTemperature("temp 54250\r\nMemTotal: 1 kB\r\n"), 54.25)
  near(parseTemperature("temp 54250  \ncpu 1\n"), 54.25)
})

test("parseTemperature treats 150 C as the inclusive upper bound", () => {
  assert.strictEqual(parseTemperature("temp 150000\n"), 150)
  assert.strictEqual(parseTemperature("temp 150001\n"), null)
})
