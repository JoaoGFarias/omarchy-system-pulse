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
  property var prevSample: null

  Commons.Translations { id: strings; directory: Qt.resolvedUrl("i18n") }

  function parse(out) {
    var lines = out.split("\n")
    var cur = Model.parseCpuLine(lines[0])
    if (cur) {
      var pct = Model.cpuPercent(prevSample, cur)
      if (pct !== null) cpu = pct
      prevSample = cur
    }
    var mem = Model.parseMemory(out)
    if (mem) {
      memTotalGb = mem.totalGb
      memUsedGb = mem.usedGb
      memPct = mem.pct
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
