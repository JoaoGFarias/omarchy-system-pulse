.pragma library

// Pure parsing and math for the system monitor widget (no QML dependencies,
// so it can be unit tested with `node --test`).

// Parses the first line of /proc/stat ("cpu  user nice system idle iowait ...")
// into { total, idle } jiffy counters, or null if the line is not valid.
function parseCpuLine(line) {
  if (typeof line !== "string" || line.indexOf("cpu ") !== 0) return null
  var f = line.trim().split(/\s+/).slice(1).map(Number)
  if (f.length < 4 || f.some(function(n) { return !isFinite(n) || n < 0 })) return null
  var idle = f[3] + (f[4] || 0)
  var total = f.reduce(function(a, b) { return a + b }, 0)
  return { total: total, idle: idle }
}

// CPU % between two samples, clamped to 0-100. Returns null when there is no
// usable previous sample (first run, or counters that did not advance).
function cpuPercent(prev, cur) {
  if (!prev || !cur || cur.total <= prev.total) return null
  var pct = 100 * (1 - (cur.idle - prev.idle) / (cur.total - prev.total))
  return Math.max(0, Math.min(100, pct))
}

// Parses MemTotal / MemAvailable (kB) out of text containing /proc/meminfo
// lines. Returns { totalGb, usedGb, pct } or null if either value is missing.
function parseMemory(text) {
  var total = 0, avail = -1
  var lines = String(text).split("\n")
  for (var i = 0; i < lines.length; i++) {
    var m = /^(MemTotal|MemAvailable):\s+(\d+)/.exec(lines[i])
    if (!m) continue
    if (m[1] === "MemTotal") total = parseInt(m[2], 10)
    else avail = parseInt(m[2], 10)
  }
  if (total <= 0 || avail < 0 || avail > total) return null
  return {
    totalGb: total / 1048576,
    usedGb: (total - avail) / 1048576,
    pct: 100 * (total - avail) / total
  }
}

// Per-core counters from text containing "cpuN ..." lines (as in /proc/stat).
// Returns an array indexed by core number; cores that are missing or invalid
// are null.
function parseCoreLines(text) {
  var out = []
  var lines = String(text).split("\n")
  for (var i = 0; i < lines.length; i++) {
    var m = /^cpu(\d+)\s+(.*)$/.exec(lines[i])
    if (!m) continue
    var c = parseCpuLine("cpu " + m[2])
    out[parseInt(m[1], 10)] = c
  }
  for (var j = 0; j < out.length; j++) if (out[j] === undefined) out[j] = null
  return out
}

// Usage % per core between two samples; 0 where a core has no usable delta.
function coreUsage(prev, cur) {
  var out = []
  for (var i = 0; i < cur.length; i++) {
    var p = prev && i < prev.length ? cpuPercent(prev[i], cur[i]) : null
    out.push(p === null ? 0 : p)
  }
  return out
}

// Reads a "temp <millidegrees>" line and returns degrees Celsius, or null when
// it is missing or implausible (outside 0-150 C).
function parseTemperature(text) {
  var m = /^temp (\d+)\s*$/m.exec(String(text))
  if (!m) return null
  var c = parseInt(m[1], 10) / 1000
  return c >= 0 && c <= 150 ? c : null
}

// The refresh interval in ms from a user setting: a number between 500 and
// 10000, falling back to 2000 for anything else.
function clampInterval(value) {
  var n = Number(value)
  if (value === null || value === undefined || value === "" || !isFinite(n)) return 2000
  return Math.max(500, Math.min(10000, Math.round(n)))
}
