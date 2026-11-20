// Loads SysmonModel.js for Node. The file is a QML library script: it starts
// with `.pragma library`, which is not JavaScript, so that line is replaced by
// a comment of the same length (coverage reports character offsets, so the
// script must stay byte-for-byte the same length as the real file). The script is run with the file's own URL as its
// filename so Node's coverage and Stryker attribute results to the real file.
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const { pathToFileURL } = require("node:url")

const file = process.env.SYSMON_MODEL || path.join(__dirname, "..", "SysmonModel.js")
const source = fs.readFileSync(file, "utf8").replace(/^\.pragma.*$/m, (m) => "//" + " ".repeat(m.length - 2))
// `process` is exposed because Stryker's instrumented code reads the active
// mutant from process.env.
const ctx = { process }
vm.createContext(ctx)
new vm.Script(source, { filename: pathToFileURL(file).href }).runInContext(ctx)

module.exports = ctx
