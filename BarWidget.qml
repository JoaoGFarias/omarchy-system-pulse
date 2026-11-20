import QtQuick
import Quickshell.Io
import qs.Commons
import qs.Commons as Commons
import qs.Ui

BarWidget {
  id: root
  moduleName: "joao.sysmon"
  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  property real cpu: 0
  property real memUsedGb: 0
  property real memTotalGb: 0
  property real memPct: 0
  property real prevTotal: 0
  property real prevIdle: 0

  Commons.Translations { id: strings; directory: Qt.resolvedUrl("i18n") }

  function parse(out) {
    var lines = out.split("\n")
    var memTotal = 0, memAvail = 0
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i]
      if (l.indexOf("cpu ") === 0) {
        var f = l.trim().split(/\s+/).slice(1).map(Number)
        var idle = f[3] + (f[4] || 0)
        var total = f.reduce(function(a, b) { return a + b }, 0)
        if (prevTotal > 0 && total > prevTotal)
          cpu = 100 * (1 - (idle - prevIdle) / (total - prevTotal))
        prevTotal = total
        prevIdle = idle
      } else if (l.indexOf("MemTotal:") === 0) {
        memTotal = parseInt(l.split(/\s+/)[1])
      } else if (l.indexOf("MemAvailable:") === 0) {
        memAvail = parseInt(l.split(/\s+/)[1])
      }
    }
    if (memTotal > 0) {
      memTotalGb = memTotal / 1048576
      memUsedGb = (memTotal - memAvail) / 1048576
      memPct = 100 * (memTotal - memAvail) / memTotal
    }
  }

  Process {
    id: proc
    command: ["sh", "-c", "head -n1 /proc/stat; grep -E '^(MemTotal|MemAvailable):' /proc/meminfo"]
    stdout: StdioCollector { onStreamFinished: root.parse(text) }
  }

  Timer {
    interval: 2000
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
      if (root.bar) root.bar.run("omarchy-launch-or-focus-tui btop")
    }
  }
}
