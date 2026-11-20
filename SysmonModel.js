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

// ---- swap / load / uptime ----

/**
 * Parses SwapTotal / SwapFree (kB) out of text containing /proc/meminfo
 * lines. Returns { totalGb, usedGb, pct }, or null when either value is
 * missing or inconsistent, or when there is no swap at all (SwapTotal 0), so
 * the popup can hide the row.
 * @param {unknown} text
 * @returns {Memory | null}
 */
function parseSwap(text) {
  var total = 0, free = -1
  String(text).split("\n").forEach(function(line) {
    var m = /^(SwapTotal|SwapFree):\s+(\d+)/.exec(line)
    if (!m) return
    if (m[1] === "SwapTotal") total = parseInt(m[2], 10)
    else free = parseInt(m[2], 10)
  })
  if (total <= 0 || free < 0 || free > total) return null
  return {
    totalGb: total / 1048576,
    usedGb: (total - free) / 1048576,
    pct: 100 * (total - free) / total
  }
}

/**
 * The 1, 5 and 15 minute load averages from the start of /proc/loadavg
 * ("0.52 1.05 2.50 2/1234 56789"), or null when they are not three plain
 * non-negative numbers.
 * @param {unknown} text
 * @returns {number[] | null}
 */
function parseLoad(text) {
  var m = /^\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)(?:\s|$)/.exec(String(text))
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/**
 * Compact uptime from whole seconds, using the two largest units: "59s",
 * "5m", "1h 0m", "3d 4h". Fractions are truncated. Returns "" for negative or
 * non-finite input.
 * @param {unknown} seconds
 * @returns {string}
 */
function formatUptime(seconds) {
  var s = Math.floor(Number(seconds))
  if (seconds === null || seconds === "" || !isFinite(s) || s < 0) return ""
  var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60)
  if (d > 0) return d + "d " + h + "h"
  if (h > 0) return h + "h " + m + "m"
  if (m > 0) return m + "m"
  return s + "s"
}

// ---- history ----

/**
 * Appends a sample to a history buffer and returns a new array holding at most
 * the last `max` samples. The input is never mutated; a non-finite value is
 * ignored (the result is an unchanged copy).
 * @param {number[]} buf
 * @param {unknown} value
 * @param {number} max
 * @returns {number[]}
 */
function pushSample(buf, value, max) {
  var out = typeof value === "number" && isFinite(value) ? buf.concat([value]) : buf
  var keep = Math.max(0, Math.floor(max) || 0)
  return out.slice(out.length - Math.min(keep, out.length))
}

/**
 * How many samples cover about 60 seconds at the given refresh interval,
 * bounded to 10-120. Unusable intervals give 30 (the 2000 ms default).
 * @param {unknown} intervalMs
 * @returns {number}
 */
function historyLength(intervalMs) {
  var ms = Number(intervalMs)
  if (!(ms > 0) || !isFinite(ms)) return 30
  return Math.max(10, Math.min(120, Math.round(60000 / ms)))
}

// ---- processes ----

/**
 * @typedef {{ pid: number, name: string, cpu: number, mem: number }} ProcessInfo
 */

/**
 * How many processes to show from a user setting: an integer between 0 and
 * 15, falling back to 5 for anything else.
 * @param {unknown} value
 * @returns {number}
 */
function clampProcessCount(value) {
  var n = Number(value)
  if (value === null || value === "" || !isFinite(n)) return 5
  return Math.max(0, Math.min(15, Math.round(n)))
}

/**
 * Parses `ps -eo pid=,comm=,pcpu=,pmem= --sort=-pcpu` output into at most n
 * processes (n goes through clampProcessCount). The command name may contain
 * spaces; being untrusted, it has control characters removed and is cut to 24
 * characters. Malformed lines are skipped.
 * @param {unknown} text
 * @param {unknown} n
 * @returns {ProcessInfo[]}
 */
function parseProcesses(text, n) {
  /** @type {ProcessInfo[]} */
  var out = []
  String(text).split("\n").forEach(function(line) {
    var p = parseProcessLine(line)
    if (p) out.push(p)
  })
  return out.slice(0, clampProcessCount(n))
}

/**
 * One `ps` line as a process, or null when it is malformed. Control
 * characters (tab excepted, it is a separator) are dropped before parsing.
 * @param {string} line
 * @returns {ProcessInfo | null}
 */
function parseProcessLine(line) {
  var clean = line.replace(/[\x00-\x08\x0a-\x1f\x7f-\x9f]/g, "")
  var m = /^\s*(\d+)\s+(\S.*?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/.exec(clean)
  if (!m) return null
  return { pid: parseInt(m[1], 10), name: m[2].slice(0, 24), cpu: parseFloat(m[3]), mem: parseFloat(m[4]) }
}

// ---- gpu ----

/**
 * @typedef {{ util: number, vramUsedGb: number, vramTotalGb: number, tempC: number | null }} Gpu
 */

/**
 * Builds a Gpu from raw numbers, or null when util is not 0-100 or the VRAM
 * total is not positive. The temperature is optional: null when absent or
 * above 150 C (NaN also gives null).
 * @param {number} util
 * @param {number} usedGb
 * @param {number} totalGb
 * @param {number} tempC NaN when unknown.
 * @returns {Gpu | null}
 */
function makeGpu(util, usedGb, totalGb, tempC) {
  if (util > 100 || totalGb <= 0) return null
  return {
    util: util,
    vramUsedGb: usedGb,
    vramTotalGb: totalGb,
    tempC: tempC <= 150 ? tempC : null
  }
}

/**
 * Parses the AMD text protocol ("gpu_busy 42", "vram_used <bytes>",
 * "vram_total <bytes>", "gpu_temp <millidegrees>", one per line, first GPU
 * only). Returns null when busy or either VRAM value is missing; tempC is null
 * when the temperature is missing or implausible.
 * @param {unknown} text
 * @returns {Gpu | null}
 */
function parseGpuAmd(text) {
  var s = String(text)
  /** @param {string} key */
  function field(key) {
    var m = new RegExp("^" + key + " (\\d+)\\s*$", "m").exec(s)
    return m ? parseInt(m[1], 10) : null
  }
  var busy = field("gpu_busy")
  var used = field("vram_used")
  var total = field("vram_total")
  var temp = field("gpu_temp")
  if (busy === null || used === null || !total) return null
  return makeGpu(busy, used / 1073741824, total / 1073741824, temp === null ? NaN : temp / 1000)
}

/**
 * Parses the first line of `nvidia-smi --query-gpu=utilization.gpu,
 * memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits`
 * (memory in MiB). "[N/A]" is tolerated for the temperature only; any other
 * missing or malformed field gives null.
 * @param {unknown} text
 * @returns {Gpu | null}
 */
function parseGpuNvidia(text) {
  var line = String(text).split("\n").find(function(l) { return l.trim() !== "" })
  if (line === undefined) return null
  var f = line.split(",").map(function(p) { return p.trim() })
  if (f.length !== 4 || !f.slice(0, 3).every(function(p) { return /^\d+$/.test(p) }) || !/^(\d+|\[N\/A\])$/.test(f[3])) return null
  // parseInt("[N/A]") is NaN, which makeGpu turns into a null temperature.
  return makeGpu(parseInt(f[0], 10), parseInt(f[1], 10) / 1024, parseInt(f[2], 10) / 1024, parseInt(f[3], 10))
}

// ---- fans ----

/**
 * @typedef {{label: string, rpm: number}} Fan
 */

/**
 * Reads "fan <hwmonname> <index> <rpm>" lines into fans. Zero RPM is valid (an
 * idle fan); lines whose RPM is not a plain non-negative integer up to 100000
 * are skipped. The label is "name #index", or just the name when only one fan
 * was reported.
 * @param {unknown} text
 * @returns {Fan[]}
 */
function parseFans(text) {
  /** @type {{name: string, index: string, rpm: number}[]} */
  var found = []
  String(text).split("\n").forEach(function(line) {
    var m = /^fan (\S+) (\d+) (\d+)\s*$/.exec(line)
    if (m && parseInt(m[3], 10) <= 100000)
      found.push({ name: m[1], index: m[2], rpm: parseInt(m[3], 10) })
  })
  return found.map(function(f) {
    return { label: found.length === 1 ? f.name : f.name + " #" + f.index, rpm: f.rpm }
  })
}

// ---- io ----

/**
 * @typedef {{ rx: number, tx: number }} NetCounters Cumulative bytes received/sent.
 * @typedef {{ readBytes: number, writeBytes: number }} DiskCounters Cumulative bytes read/written.
 */

/**
 * Sums received/sent bytes over /proc/net/dev, skipping the loopback and
 * virtual interfaces (lo, veth*, docker*, br-*) and any malformed line.
 * @param {unknown} text
 * @returns {NetCounters}
 */
function parseNetDev(text) {
  var sum = { rx: 0, tx: 0 }
  String(text).split("\n").forEach(function(line) {
    var colon = line.indexOf(":")
    if (colon < 1) return
    var name = line.slice(0, colon).trim()
    if (name === "lo" || /^(veth|docker|br-)/.test(name)) return
    var f = line.slice(colon + 1).trim().split(/\s+/).map(Number)
    if (f.length < 9 || f.some(function(n) { return !isFinite(n) })) return
    sum.rx += f[0]
    sum.tx += f[8]
  })
  return sum
}

/**
 * Sums bytes read/written over /proc/diskstats for whole block devices only
 * (nvme0n1, sda, vda, xvda, mmcblk0; not their partitions, loop, ram or dm).
 * Sectors are 512 bytes regardless of the device.
 * @param {unknown} text
 * @returns {DiskCounters}
 */
function parseDiskstats(text) {
  var sum = { readBytes: 0, writeBytes: 0 }
  String(text).split("\n").forEach(function(line) {
    var f = line.trim().split(/\s+/)
    if (!/^(nvme\d+n\d+|(sd|vd|xvd)[a-z]+|mmcblk\d+)$/.test(f[2])) return
    var read = Number(f[5])
    var written = Number(f[9])
    if (!isFinite(read) || !isFinite(written)) return
    sum.readBytes += read * 512
    sum.writeBytes += written * 512
  })
  return sum
}

/**
 * Bytes per second between two cumulative counter values ms apart, or null
 * when the counter went backwards (reset or wrap) or the interval is unusable.
 * @param {number} prev
 * @param {number} cur
 * @param {number} ms
 * @returns {number | null}
 */
function rate(prev, cur, ms) {
  if (!isFinite(prev) || !isFinite(cur) || !(ms > 0) || cur < prev) return null
  return (cur - prev) * 1000 / ms
}

/**
 * Human readable throughput with 1024-based units, e.g. "1.5 MB/s".
 * Negative or non-finite input reads as "0 B/s".
 * @param {number} n bytes per second
 * @returns {string}
 */
function formatBytesPerSecond(n) {
  if (!isFinite(n) || n < 1) return "0 B/s"
  var units = ["B/s", "KB/s", "MB/s", "GB/s"]
  var i
  for (i = 0; i < 3 && n >= 1024; i++) n /= 1024
  return (i === 0 ? String(Math.round(n)) : n.toFixed(1)) + " " + units[i]
}

// ---- sections ----

/**
 * The lines under a "#name" marker line, up to the next marker, joined with
 * newlines. Empty when the marker is absent.
 * @param {unknown} text
 * @param {string} name
 * @returns {string}
 */
function section(text, name) {
  /** @type {string[]} */
  var out = []
  var inside = false
  String(text).split("\n").forEach(function(line) {
    if (line.charAt(0) === "#") inside = line === "#" + name
    else if (inside) out.push(line)
  })
  return out.join("\n")
}
