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
