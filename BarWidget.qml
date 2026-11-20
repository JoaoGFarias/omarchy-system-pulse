import QtQuick
import Quickshell.Io
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "SysmonModel.js" as Model

BarWidget {
  id: root
  moduleName: "joao.sysmon"
  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  property real cpu: 0
  property real memUsedGb: 0
  property real memTotalGb: 0
  property real memPct: 0
  property real tempC: -1
  property var coreLoads: []
  property var prevSample: null
  property var prevCores: []
  property bool popupOpen: false
  property var swap: null
  property var load: null
  property string uptime: ""
  property var gpu: null
  property var fans: []
  property var cpuHistory: []
  property var memHistory: []
  property var procs: []
  property var prevNet: null
  property var prevDisk: null
  property real prevIoAt: 0
  property real netRx: -1
  property real netTx: -1
  property real diskRead: -1
  property real diskWrite: -1

  // Refresh interval in ms. Set it with:
  //   omarchy bar set joao.sysmon interval 1000 --json
  readonly property int pollInterval: Model.clampInterval(root.setting("interval", 2000))

  // Rows in the "top processes" list: omarchy bar set joao.sysmon processes 8 --json
  // (0 hides the list, maximum 15).
  function processCount() { return Model.clampProcessCount(root.setting("processes", 5)) }

  function close() { popupOpen = false }
  function togglePopup() { popupOpen = !popupOpen }

  // Command-line control, e.g. for a keybinding or the verify script:
  //   omarchy-shell joao.sysmon toggle
  //   omarchy-shell joao.sysmon close
  ShellIpc {
    target: "joao.sysmon"

    function toggle(): void { root.broadcast("togglePopup") }
    function close(): void { root.broadcast("close") }
  }
  function openBtop() {
    popupOpen = false
    if (root.bar) root.bar.run("omarchy-launch-or-focus-tui btop")
  }

  Commons.Translations { id: strings; directory: Qt.resolvedUrl("i18n") }

  function parse(out) {
    var lines = out.split("\n")
    var cur = Model.parseCpuLine(lines[0])
    if (cur) {
      var pct = Model.cpuPercent(prevSample, cur)
      if (pct !== null) cpu = pct
      prevSample = cur
    }
    var cores = Model.parseCoreLines(out)
    if (prevCores.length > 0) coreLoads = Model.coreUsage(prevCores, cores)
    prevCores = cores
    var t = Model.parseTemperature(out)
    tempC = t === null ? -1 : t
    var mem = Model.parseMemory(out)
    if (mem) {
      memTotalGb = mem.totalGb
      memUsedGb = mem.usedGb
      memPct = mem.pct
    }
    var keep = Model.historyLength(pollInterval)
    cpuHistory = Model.pushSample(cpuHistory, cpu, keep)
    memHistory = Model.pushSample(memHistory, memPct, keep)
    swap = Model.parseSwap(out)
    load = Model.parseLoad(Model.section(out, "load"))
    uptime = Model.formatUptime(Model.section(out, "uptime"))
    gpu = Model.parseGpuAmd(Model.section(out, "gpu")) || Model.parseGpuNvidia(Model.section(out, "gpunv"))
    fans = Model.parseFans(Model.section(out, "fans"))
    parseIo(out)
  }

  // Network and disk throughput from counter deltas between two polls.
  function parseIo(out) {
    var now = Date.now()
    var net = Model.parseNetDev(Model.section(out, "net"))
    var disk = Model.parseDiskstats(Model.section(out, "disk"))
    var ms = now - prevIoAt
    var v
    if (prevNet) {
      v = Model.rate(prevNet.rx, net.rx, ms); netRx = v === null ? -1 : v
      v = Model.rate(prevNet.tx, net.tx, ms); netTx = v === null ? -1 : v
      v = Model.rate(prevDisk.readBytes, disk.readBytes, ms); diskRead = v === null ? -1 : v
      v = Model.rate(prevDisk.writeBytes, disk.writeBytes, ms); diskWrite = v === null ? -1 : v
    }
    prevNet = net
    prevDisk = disk
    prevIoAt = now
  }

  Process {
    id: proc
    command: ["sh", "-c",
      "grep -E '^cpu' /proc/stat; " +
      "grep -E '^(MemTotal|MemAvailable|SwapTotal|SwapFree):' /proc/meminfo; " +
      "for h in /sys/class/hwmon/hwmon*; do " +
      "case $(cat $h/name 2>/dev/null) in " +
      "k10temp|coretemp|zenpower) echo \"temp $(cat $h/temp1_input 2>/dev/null)\"; break;; " +
      "esac; done; " +
      "echo '#load'; cat /proc/loadavg; " +
      "echo '#uptime'; cut -d. -f1 /proc/uptime; " +
      "echo '#gpu'; for d in /sys/class/drm/card*/device; do " +
      "[ -r $d/gpu_busy_percent ] || continue; " +
      "echo \"gpu_busy $(cat $d/gpu_busy_percent)\"; " +
      "echo \"vram_used $(cat $d/mem_info_vram_used)\"; " +
      "echo \"vram_total $(cat $d/mem_info_vram_total)\"; " +
      "for t in $d/hwmon/hwmon*/temp1_input; do [ -r $t ] && echo \"gpu_temp $(cat $t)\" && break; done; " +
      "break; done; " +
      "echo '#gpunv'; command -v nvidia-smi >/dev/null && nvidia-smi " +
      "--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits 2>/dev/null; " +
      "echo '#fans'; for f in /sys/class/hwmon/hwmon*/fan*_input; do [ -r $f ] || continue; " +
      "n=${f##*/fan}; n=${n%_input}; " +
      "printf 'fan %s %s %s\\n' \"$(tr -d ' \\n' < ${f%/*}/name 2>/dev/null)\" $n \"$(cat $f 2>/dev/null)\"; done; " +
      "echo '#net'; cat /proc/net/dev; " +
      "echo '#disk'; cat /proc/diskstats"]
    stdout: StdioCollector { onStreamFinished: root.parse(text) }
  }

  // Top processes: polled only while the card is open, so the idle bar stays cheap.
  // (ps %CPU is each process's lifetime average, not its instantaneous load.)
  Process {
    id: psProc
    command: ["sh", "-c", "ps -eo pid=,comm=,pcpu=,pmem= --sort=-pcpu | head -n 16"]
    stdout: StdioCollector { onStreamFinished: root.procs = Model.parseProcesses(text, root.processCount()) }
  }

  Timer {
    interval: root.pollInterval
    running: root.popupOpen && root.processCount() > 0
    repeat: true
    triggeredOnStart: true
    onTriggered: if (!psProc.running) psProc.running = true
  }

  Timer {
    interval: root.pollInterval
    running: true
    repeat: true
    triggeredOnStart: true
    onTriggered: if (!proc.running) proc.running = true
  }

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: "󰍛 " + Math.round(root.cpu) + "%  󰘚 " + Math.round(root.memPct) + "%"
    active: root.cpu > 90 || root.memPct > 90
    tooltipText: strings.t("tooltip")
      .replace("%1", Commons.I18n.formatNumber(root.cpu, 0))
      .replace("%2", Commons.I18n.formatNumber(root.memPct, 0))
      .replace("%3", Commons.I18n.formatNumber(root.memUsedGb, 1))
      .replace("%4", Commons.I18n.formatNumber(root.memTotalGb, 1))
    onPressed: function(mouseButton) {
      if (mouseButton === Qt.RightButton) root.openBtop()
      else root.popupOpen = !root.popupOpen
    }
  }

  component Caption: Text {
    textFormat: Text.PlainText
    color: Qt.darker(Commons.Color.popups.text, 1.4)
    font.family: Style.font.family
    font.pixelSize: Style.font.caption
  }

  // A thin bar chart of recent 0-100 samples, newest on the right.
  component Spark: Item {
    id: spark
    property var values: []
    property int slots: 30
    height: Style.space(24)
    Row {
      anchors.right: parent.right
      anchors.bottom: parent.bottom
      height: parent.height
      spacing: Style.space(1)
      Repeater {
        model: spark.values
        Item {
          width: Math.max(1, (spark.width - Style.space(1) * (spark.slots - 1)) / spark.slots)
          height: spark.height
          Rectangle {
            anchors.bottom: parent.bottom
            width: parent.width
            height: Math.max(Style.space(1), parent.height * Math.min(100, modelData) / 100)
            color: Commons.Color.accent
          }
        }
      }
    }
  }

  PopupCard {
    id: popup
    anchorItem: root
    bar: root.bar
    owner: root
    open: root.popupOpen
    contentWidth: popup.fittedContentWidth(Style.space(300))
    contentHeight: popup.fittedContentHeight(column.implicitHeight)

    Column {
      id: column
      width: parent.width
      spacing: Style.space(10)

      Text {
        textFormat: Text.PlainText
        text: strings.t("popup.title")
        color: Commons.Color.popups.text
        font.family: Style.font.family
        font.pixelSize: Style.font.subtitle
        font.bold: true
      }

      Row {
        spacing: Style.space(16)
        Text {
          textFormat: Text.PlainText
          text: strings.t("popup.cpu").replace("%1", Commons.I18n.formatNumber(root.cpu, 0))
          color: Commons.Color.popups.text
          font.family: Style.font.family
          font.pixelSize: Style.font.body
        }
        Text {
          visible: root.tempC >= 0
          textFormat: Text.PlainText
          text: strings.t("popup.temperature").replace("%1", Commons.I18n.formatNumber(root.tempC, 0))
          color: root.tempC >= 85 ? Commons.Color.urgent : Commons.Color.popups.text
          font.family: Style.font.family
          font.pixelSize: Style.font.body
        }
      }

      // One vertical bar per hardware thread, filled from the bottom.
      Grid {
        id: coreGrid
        width: parent.width
        visible: root.coreLoads.length > 0
        columns: Math.max(1, Math.min(12, root.coreLoads.length))
        spacing: Style.space(3)
        readonly property real cellWidth: (width - spacing * (columns - 1)) / columns

        Repeater {
          model: root.coreLoads
          Rectangle {
            width: coreGrid.cellWidth
            height: Style.space(32)
            radius: Style.space(2)
            color: Qt.rgba(Commons.Color.popups.text.r, Commons.Color.popups.text.g, Commons.Color.popups.text.b, 0.12)
            Rectangle {
              anchors.bottom: parent.bottom
              width: parent.width
              height: Math.max(Style.space(1), parent.height * Math.min(100, modelData) / 100)
              radius: parent.radius
              color: modelData > 90 ? Commons.Color.urgent : Commons.Color.accent
            }
          }
        }
      }

      Text {
        visible: root.coreLoads.length > 0
        textFormat: Text.PlainText
        text: strings.t("popup.cores")
        color: Qt.darker(Commons.Color.popups.text, 1.4)
        font.family: Style.font.family
        font.pixelSize: Style.font.caption
      }

      Text {
        textFormat: Text.PlainText
        text: strings.t("popup.memory")
          .replace("%1", Commons.I18n.formatNumber(root.memUsedGb, 1))
          .replace("%2", Commons.I18n.formatNumber(root.memTotalGb, 1))
          .replace("%3", Commons.I18n.formatNumber(root.memPct, 0))
        color: Commons.Color.popups.text
        font.family: Style.font.family
        font.pixelSize: Style.font.body
      }

      Spark { width: parent.width; slots: Model.historyLength(root.pollInterval); values: root.cpuHistory }
      Caption { text: strings.t("popup.historyCpu") }
      Spark { width: parent.width; slots: Model.historyLength(root.pollInterval); values: root.memHistory }
      Caption { text: strings.t("popup.historyMemory") }

      Caption {
        visible: root.swap !== null
        text: root.swap ? strings.t("popup.swap")
          .replace("%1", Commons.I18n.formatNumber(root.swap.usedGb, 1))
          .replace("%2", Commons.I18n.formatNumber(root.swap.totalGb, 1)) : ""
      }
      Caption {
        visible: root.load !== null
        text: root.load ? strings.t("popup.load")
          .replace("%1", Commons.I18n.formatNumber(root.load[0], 2))
          .replace("%2", Commons.I18n.formatNumber(root.load[1], 2))
          .replace("%3", Commons.I18n.formatNumber(root.load[2], 2)) : ""
      }
      Caption {
        visible: root.uptime !== ""
        text: strings.t("popup.uptime").replace("%1", root.uptime)
      }
      Caption {
        visible: root.gpu !== null
        text: root.gpu ? strings.t("popup.gpu")
          .replace("%1", Commons.I18n.formatNumber(root.gpu.util, 0))
          .replace("%2", Commons.I18n.formatNumber(root.gpu.vramUsedGb, 1))
          .replace("%3", Commons.I18n.formatNumber(root.gpu.vramTotalGb, 1))
          + (root.gpu.tempC !== null ? "  " + Commons.I18n.formatNumber(root.gpu.tempC, 0) + " °C" : "") : ""
      }
      Caption {
        visible: root.fans.length > 0
        text: root.fans.map(function(f) { return strings.t("popup.fan").replace("%1", f.label).replace("%2", f.rpm) }).join("  ")
      }
      Caption {
        visible: root.netRx >= 0 && root.netTx >= 0
        text: strings.t("popup.network")
          .replace("%1", Model.formatBytesPerSecond(root.netRx))
          .replace("%2", Model.formatBytesPerSecond(root.netTx))
      }
      Caption {
        visible: root.diskRead >= 0 && root.diskWrite >= 0
        text: strings.t("popup.disk")
          .replace("%1", Model.formatBytesPerSecond(root.diskRead))
          .replace("%2", Model.formatBytesPerSecond(root.diskWrite))
      }

      Caption { visible: root.procs.length > 0; text: strings.t("popup.processes") }
      Repeater {
        model: root.procs
        Row {
          spacing: Style.space(8)
          Text {
            width: Style.space(150)
            elide: Text.ElideRight
            textFormat: Text.PlainText
            text: modelData.name
            color: Commons.Color.popups.text
            font.family: Style.font.family
            font.pixelSize: Style.font.caption
          }
          Caption { text: strings.t("popup.procLine").replace("%1", modelData.cpu.toFixed(1)).replace("%2", modelData.mem.toFixed(1)) }
        }
      }

      Text {
        textFormat: Text.PlainText
        text: strings.t("popup.btop")
        color: Commons.Color.accent
        font.family: Style.font.family
        font.pixelSize: Style.font.body
        MouseArea {
          anchors.fill: parent
          cursorShape: Qt.PointingHandCursor
          onClicked: root.openBtop()
        }
      }
    }
  }
}
