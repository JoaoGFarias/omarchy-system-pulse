const test = require("node:test")
const assert = require("node:assert")
const model = require("../testlib/load-model")

// The model runs in a vm context; JSON moves its results into this realm so
// deepStrictEqual compares prototypes fairly.
const parseFans = (text) => JSON.parse(JSON.stringify(model.parseFans(text)))

test("parseFans returns an empty list when there are no fans", () => {
  assert.deepStrictEqual(parseFans(""), [])
  assert.deepStrictEqual(parseFans("temp 5000\n"), [])
  assert.deepStrictEqual(parseFans(undefined), [])
})

test("parseFans labels a single fan with just the hwmon name", () => {
  assert.deepStrictEqual(parseFans("fan cros_ec 1 2400\n"), [{ label: "cros_ec", rpm: 2400 }])
})

test("parseFans numbers the labels when there are several fans", () => {
  const text = "fan acpi_fan 1 1800\nfan cros_ec 1 2400\nfan cros_ec 2 2500\n"
  assert.deepStrictEqual(parseFans(text), [
    { label: "acpi_fan #1", rpm: 1800 },
    { label: "cros_ec #1", rpm: 2400 },
    { label: "cros_ec #2", rpm: 2500 },
  ])
})

test("parseFans treats zero RPM as a valid idle fan", () => {
  assert.deepStrictEqual(parseFans("fan cros_ec 1 0\n"), [{ label: "cros_ec", rpm: 0 }])
})

test("parseFans skips non-numeric, negative and implausible readings", () => {
  const text = [
    "fan a 1 abc", "fan a 2 -5", "fan a 3 100001", "fan a 4 12x", "fan a 5 1.5",
    "fan a x 100", "fan a 6 ", "fan a 7 3000",
  ].join("\n")
  assert.deepStrictEqual(parseFans(text), [{ label: "a", rpm: 3000 }])
})

test("parseFans accepts 100000 RPM as the inclusive upper bound", () => {
  assert.deepStrictEqual(parseFans("fan a 1 100000\n"), [{ label: "a", rpm: 100000 }])
})

test("parseFans ignores lines that merely contain fan", () => {
  assert.deepStrictEqual(parseFans("xfan a 1 100\n fan a 1 100\n"), [])
  assert.deepStrictEqual(parseFans("fan a 1 100 extra\n"), [])
})

test("parseFans accepts CRLF and trailing whitespace, and a missing final newline", () => {
  assert.deepStrictEqual(parseFans("fan a 1 100  \r\nfan b 1 200"), [
    { label: "a #1", rpm: 100 },
    { label: "b #1", rpm: 200 },
  ])
})

test("parseFans keeps multi-digit fan indexes", () => {
  assert.deepStrictEqual(parseFans("fan a 10 100\nfan a 11 200\n"), [
    { label: "a #10", rpm: 100 },
    { label: "a #11", rpm: 200 },
  ])
})
