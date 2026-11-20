const test = require("node:test")
const assert = require("node:assert")
const near = require("../testlib/near")
const { cpuPercent } = require("../testlib/load-model")

test("cpuPercent computes busy share between two samples", () => {
  near(cpuPercent({ total: 1000, idle: 800 }, { total: 1100, idle: 850 }), 50)
  near(cpuPercent({ total: 1000, idle: 800 }, { total: 1100, idle: 900 }), 0)
  near(cpuPercent({ total: 1000, idle: 800 }, { total: 1100, idle: 800 }), 100)
})

test("cpuPercent returns null without a usable previous sample", () => {
  assert.strictEqual(cpuPercent(null, { total: 10, idle: 5 }), null)
  assert.strictEqual(cpuPercent({ total: 10, idle: 5 }, { total: 10, idle: 5 }), null)
  assert.strictEqual(cpuPercent({ total: 10, idle: 5 }, { total: 5, idle: 2 }), null)
})

test("cpuPercent clamps to 0-100", () => {
  assert.strictEqual(cpuPercent({ total: 0, idle: 0 }, { total: 100, idle: 150 }), 0)
  assert.strictEqual(cpuPercent({ total: 0, idle: 100 }, { total: 100, idle: 0 }), 100)
})
