.pragma library

// Pure parsing and math for the system monitor widget (no QML dependencies,
// so it can be unit tested with `node --test`).

/**
 * @typedef {{ total: number, idle: number }} CpuSample Jiffy counters from /proc/stat.
 * @typedef {{ totalGb: number, usedGb: number, pct: number }} Memory
 */

/**
 * Parses the first line of /proc/stat ("cpu  user nice system idle iowait ...")
 * into { total, idle } jiffy counters, or null if the line is not valid.
 * @param {unknown} line
 * @returns {CpuSample | null}
 */
function parseCpuLine(line) {
  if (typeof line !== "string" || line.indexOf("cpu ") !== 0) return null
  var f = line.trim().split(/\s+/).slice(1).map(Number)
  if (f.length < 4 || f.some(function(n) { return !isFinite(n) || n < 0 })) return null
  var idle = f[3] + (f[4] || 0)
  var total = f.reduce(function(a, b) { return a + b }, 0)
  return { total: total, idle: idle }
}

/**
 * CPU % between two samples, clamped to 0-100. Returns null when there is no
 * usable previous sample (first run, or counters that did not advance).
 * @param {CpuSample | null | undefined} prev
 * @param {CpuSample | null | undefined} cur
 * @returns {number | null}
 */
function cpuPercent(prev, cur) {
  if (!prev || !cur || cur.total <= prev.total) return null
  var pct = 100 * (1 - (cur.idle - prev.idle) / (cur.total - prev.total))
  return Math.max(0, Math.min(100, pct))
}

/**
 * Parses MemTotal / MemAvailable (kB) out of text containing /proc/meminfo
 * lines. Returns { totalGb, usedGb, pct } or null if either value is missing.
 * @param {unknown} text
 * @returns {Memory | null}
 */
function parseMemory(text) {
  var total = 0, avail = -1
  String(text).split("\n").forEach(function(line) {
    var m = /^(MemTotal|MemAvailable):\s+(\d+)/.exec(line)
    if (!m) return
    if (m[1] === "MemTotal") total = parseInt(m[2], 10)
    else avail = parseInt(m[2], 10)
  })
  if (total <= 0 || avail < 0 || avail > total) return null
  return {
    totalGb: total / 1048576,
    usedGb: (total - avail) / 1048576,
    pct: 100 * (total - avail) / total
  }
}

/**
 * Per-core counters from text containing "cpuN ..." lines (as in /proc/stat).
 * Returns an array indexed by core number; cores that are missing or invalid
 * are null.
 * @param {unknown} text
 * @returns {(CpuSample | null)[]}
 */
function parseCoreLines(text) {
  /** @type {(CpuSample | null | undefined)[]} */
  var out = []
  String(text).split("\n").forEach(function(line) {
    // One separator is enough: parseCpuLine trims and splits on any whitespace.
    var m = /^cpu(\d+)\s(.*)/.exec(line)
    if (m) out[parseInt(m[1], 10)] = parseCpuLine("cpu " + m[2])
  })
  // Array.from visits holes in a sparse array as undefined, so gaps become null.
  return Array.from(out, function(c) { return c || null })
}

/**
 * Usage % per core between two samples; 0 where a core has no usable delta.
 * @param {(CpuSample | null)[] | null | undefined} prev
 * @param {(CpuSample | null)[]} cur
 * @returns {number[]}
 */
function coreUsage(prev, cur) {
  return cur.map(function(sample, i) {
    var p = cpuPercent(prev ? prev[i] : null, sample)
    return p === null ? 0 : p
  })
}

/**
 * Reads a "temp <millidegrees>" line and returns degrees Celsius, or null when
 * it is missing or implausible (outside 0-150 C).
 * @param {unknown} text
 * @returns {number | null}
 */
function parseTemperature(text) {
  var m = /^temp (\d+)\s*$/m.exec(String(text))
  if (!m) return null
  var c = parseInt(m[1], 10) / 1000
  return c <= 150 ? c : null
}

/**
 * The refresh interval in ms from a user setting: a number between 500 and
 * 10000, falling back to 2000 for anything else.
 * @param {unknown} value
 * @returns {number}
 */
function clampInterval(value) {
  var n = Number(value)
  // Number(undefined) is NaN, so undefined needs no check of its own.
  if (value === null || value === "" || !isFinite(n)) return 2000
  return Math.max(500, Math.min(10000, Math.round(n)))
}
