const test = require("node:test")
const assert = require("node:assert")
const near = require("../testlib/near")
const { parseGpuAmd } = require("../testlib/load-model")

const GIB = 1073741824

test("parseGpuAmd converts the protocol lines", () => {
  const g = parseGpuAmd("gpu_busy 42\nvram_used 2147483648\nvram_total 8589934592\ngpu_temp 54250\n")
  assert.strictEqual(g.util, 42)
  near(g.vramUsedGb, 2)
  near(g.vramTotalGb, 8)
  near(g.tempC, 54.25)
})

test("parseGpuAmd returns null tempC when the temperature is missing or implausible", () => {
  const base = "gpu_busy 1\nvram_used " + GIB + "\nvram_total " + 2 * GIB + "\n"
  assert.strictEqual(parseGpuAmd(base).tempC, null)
  assert.strictEqual(parseGpuAmd(base + "gpu_temp 999000\n").tempC, null)
  assert.strictEqual(parseGpuAmd(base + "gpu_temp 150000\n").tempC, 150)
  assert.strictEqual(parseGpuAmd(base + "gpu_temp 150001\n").tempC, null)
})

test("parseGpuAmd returns null when a required field is missing", () => {
  const all = ["gpu_busy 1", "vram_used 5", "vram_total 9"]
  for (let i = 0; i < all.length; i++) {
    assert.strictEqual(parseGpuAmd(all.filter((_, j) => j !== i).join("\n")), null)
  }
  assert.strictEqual(parseGpuAmd(""), null)
  assert.strictEqual(parseGpuAmd(undefined), null)
})

test("parseGpuAmd rejects malformed values and zero total", () => {
  assert.strictEqual(parseGpuAmd("gpu_busy x\nvram_used 5\nvram_total 9\n"), null)
  assert.strictEqual(parseGpuAmd("gpu_busy 1abc\nvram_used 5\nvram_total 9\n"), null)
  assert.strictEqual(parseGpuAmd("gpu_busy 1\nvram_used 5\nvram_total 0\n"), null)
  assert.strictEqual(parseGpuAmd("gpu_busy 101\nvram_used 5\nvram_total 9\n"), null)
  assert.strictEqual(parseGpuAmd("gpu_busy 100\nvram_used 5\nvram_total 9\n").util, 100)
})

test("parseGpuAmd matches whole lines only and tolerates CRLF and spacing", () => {
  assert.strictEqual(parseGpuAmd("xgpu_busy 1\nvram_used 5\nvram_total 9\n"), null)
  assert.strictEqual(parseGpuAmd(" gpu_busy 1\nvram_used 5\nvram_total 9\n"), null)
  const g = parseGpuAmd("gpu_busy 7  \r\nvram_used 5\r\nvram_total 9\r\n")
  assert.strictEqual(g.util, 7)
})

test("parseGpuAmd uses the first GPU when keys repeat", () => {
  const g = parseGpuAmd("gpu_busy 10\nvram_used 1\nvram_total 2\ngpu_busy 90\nvram_used 5\nvram_total 9\n")
  assert.strictEqual(g.util, 10)
  near(g.vramTotalGb, 2 / GIB)
})
