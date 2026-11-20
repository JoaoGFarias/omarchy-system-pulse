const test = require("node:test")
const assert = require("node:assert")
const near = require("../testlib/near")
const { parseGpuNvidia } = require("../testlib/load-model")

test("parseGpuNvidia converts MiB to GiB", () => {
  const g = parseGpuNvidia("35, 2048, 8192, 61\n")
  assert.strictEqual(g.util, 35)
  near(g.vramUsedGb, 2)
  near(g.vramTotalGb, 8)
  assert.strictEqual(g.tempC, 61)
})

test("parseGpuNvidia uses only the first GPU", () => {
  const g = parseGpuNvidia("10, 1024, 4096, 40\n90, 2048, 8192, 80\n")
  assert.strictEqual(g.util, 10)
  near(g.vramTotalGb, 4)
  assert.strictEqual(g.tempC, 40)
})

test("parseGpuNvidia skips leading blank lines and tolerates CRLF", () => {
  const g = parseGpuNvidia("\n  \r\n5,1024,2048,33\r\n")
  assert.strictEqual(g.util, 5)
  assert.strictEqual(g.tempC, 33)
})

test("parseGpuNvidia tolerates [N/A] temperature only", () => {
  const g = parseGpuNvidia("5, 1024, 2048, [N/A]\n")
  assert.strictEqual(g.tempC, null)
  assert.strictEqual(g.util, 5)
  assert.strictEqual(parseGpuNvidia("[N/A], 1024, 2048, 30\n"), null)
  assert.strictEqual(parseGpuNvidia("5, [N/A], 2048, 30\n"), null)
  assert.strictEqual(parseGpuNvidia("5, 1024, [N/A], 30\n"), null)
})

test("parseGpuNvidia rejects missing, malformed or implausible input", () => {
  assert.strictEqual(parseGpuNvidia(""), null)
  assert.strictEqual(parseGpuNvidia(undefined), null)
  assert.strictEqual(parseGpuNvidia("5, 1024, 2048\n"), null)
  assert.strictEqual(parseGpuNvidia("5, 1024, 2048, 30, 1\n"), null)
  assert.strictEqual(parseGpuNvidia("5, 1024, 0, 30\n"), null)
  assert.strictEqual(parseGpuNvidia("101, 1024, 2048, 30\n"), null)
  assert.strictEqual(parseGpuNvidia("100, 1024, 2048, 30\n").util, 100)
  assert.strictEqual(parseGpuNvidia("5, 1024, 2048, 151\n").tempC, null)
  assert.strictEqual(parseGpuNvidia("5, 1024, 2048, 150\n").tempC, 150)
  assert.strictEqual(parseGpuNvidia("5, 1x, 2048, 30\n"), null)
  assert.strictEqual(parseGpuNvidia("NVIDIA-SMI has failed\n"), null)
})

test("parseGpuNvidia requires every numeric field to be wholly digits", () => {
  assert.strictEqual(parseGpuNvidia("x5, 1024, 2048, 30\n"), null)
  assert.strictEqual(parseGpuNvidia("5x, 1024, 2048, 30\n"), null)
  assert.strictEqual(parseGpuNvidia("5, 1024, 2048, x30\n"), null)
  assert.strictEqual(parseGpuNvidia("5, 1024, 2048, 30x\n"), null)
  assert.strictEqual(parseGpuNvidia("5, 1024, 2048, [N/A]x\n"), null)
  assert.strictEqual(parseGpuNvidia("5, 1024, 2048, x[N/A]\n"), null)
  assert.strictEqual(parseGpuNvidia("5, 10 24, 2048, 30\n"), null)
})
