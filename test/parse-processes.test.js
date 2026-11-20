const test = require("node:test")
const assert = require("node:assert")
const model = require("../testlib/load-model")

// The model runs in a vm context, so its arrays have another realm's prototypes.
const parseProcesses = (text, n) => JSON.parse(JSON.stringify(model.parseProcesses(text, n)))

const ps = [
  "    1 systemd          0.1  0.2",
  " 2345 Web Content     35.5  4.25",
  "  999 bash             0.0  0.0",
].join("\n")

test("parseProcesses reads pid, name, cpu and mem, keeping ps order", () => {
  assert.deepStrictEqual(parseProcesses(ps, 10), [
    { pid: 1, name: "systemd", cpu: 0.1, mem: 0.2 },
    { pid: 2345, name: "Web Content", cpu: 35.5, mem: 4.25 },
    { pid: 999, name: "bash", cpu: 0, mem: 0 },
  ])
})

test("parseProcesses keeps names with several spaces and tabs", () => {
  assert.strictEqual(parseProcesses("5 a b  c 1.0 2.0", 5)[0].name, "a b  c")
  assert.strictEqual(parseProcesses("5\tx\t1.0\t2.0", 5)[0].name, "x")
})

test("parseProcesses limits to n, clamping n like clampProcessCount", () => {
  assert.strictEqual(parseProcesses(ps, 2).length, 2)
  assert.strictEqual(parseProcesses(ps, 1).length, 1)
  assert.strictEqual(parseProcesses(ps, 0).length, 0)
  assert.strictEqual(parseProcesses(ps, -4).length, 0)
  assert.strictEqual(parseProcesses(ps, undefined).length, 3)
  const many = Array.from({ length: 30 }, (_, i) => `${i + 1} p 1.0 1.0`).join("\n")
  assert.strictEqual(parseProcesses(many, 99).length, 15)
  assert.strictEqual(parseProcesses(many, undefined).length, 5)
  assert.strictEqual(parseProcesses(many, "").length, 5)
})

test("parseProcesses returns [] for empty or non-string-like output", () => {
  assert.deepStrictEqual(parseProcesses("", 5), [])
  assert.deepStrictEqual(parseProcesses("\n\n", 5), [])
  assert.deepStrictEqual(parseProcesses(null, 5), [])
  assert.deepStrictEqual(parseProcesses(undefined, 5), [])
})

test("parseProcesses skips malformed lines without counting them", () => {
  const text = [
    "garbage",
    "x name 1.0 2.0",
    "12 name abc 2.0",
    "12 name 1.0 abc",
    "12 name 1.0",
    "12 1.0 2.0",
    "-4 name 1.0 2.0",
    "7 name -1.0 2.0",
    "7 name 1.0 -2.0",
    "7 name 1. 2.0",
    "7 name 1.0 2.0 extra",
    "42 ok 1.5 2.5",
  ].join("\n")
  assert.deepStrictEqual(parseProcesses(text, 5), [
    { pid: 42, name: "ok", cpu: 1.5, mem: 2.5 },
  ])
  assert.deepStrictEqual(parseProcesses("bad\n1 a 1 1\n2 b 1 1", 1), [{ pid: 1, name: "a", cpu: 1, mem: 1 }])
})

test("parseProcesses accepts CRLF endings and leading blank lines", () => {
  assert.deepStrictEqual(parseProcesses("\r\n3 z 1.0 2.0\r\n", 5), [{ pid: 3, name: "z", cpu: 1, mem: 2 }])
})

test("parseProcesses caps names at 24 characters", () => {
  const long = "x".repeat(100)
  assert.strictEqual(parseProcesses(`1 ${long} 1.0 1.0`, 5)[0].name, "x".repeat(24))
  assert.strictEqual(parseProcesses(`1 ${"y".repeat(24)} 1.0 1.0`, 5)[0].name, "y".repeat(24))
})

test("parseProcesses strips control characters from names", () => {
  assert.strictEqual(parseProcesses("1 a\x1b[31mb\x07c\x7fd\x85e 1.0 1.0", 5)[0].name, "a[31mbcde")
  assert.strictEqual(parseProcesses("1 \x00\x1f\x9f 1.0 1.0", 5).length, 0)
  assert.strictEqual(parseProcesses("1 \x01 a\x01 1.0 1.0", 5)[0].name, "a")
  assert.strictEqual(parseProcesses("1 \x1f\x9fq 1.0 1.0", 5)[0].name, "q")
  assert.strictEqual(parseProcesses("1 ~ 1.0 1.0", 5)[0].name, "~")
  assert.strictEqual(parseProcesses("1  ¡ 1.0 1.0", 5)[0].name, "¡")
})

test("parseProcesses handles ps column padding and multi-digit decimals", () => {
  assert.deepStrictEqual(parseProcesses("  123   some name   10.55   12.75  ", 5), [
    { pid: 123, name: "some name", cpu: 10.55, mem: 12.75 },
  ])
  assert.deepStrictEqual(parseProcesses("12  n  100  100", 5), [{ pid: 12, name: "n", cpu: 100, mem: 100 }])
  assert.deepStrictEqual(parseProcesses("7 n 1.25 3.5", 5), [{ pid: 7, name: "n", cpu: 1.25, mem: 3.5 }])
})
