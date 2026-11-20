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

  // Refresh interval in ms. Set it with:
  //   omarchy bar set joao.sysmon interval 1000 --json
  readonly property int pollInterval: Model.clampInterval(root.setting("interval", 2000))

  function close() { popupOpen = false }
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
  }

  Process {
    id: proc
    command: ["sh", "-c",
      "grep -E '^cpu' /proc/stat; " +
      "grep -E '^(MemTotal|MemAvailable):' /proc/meminfo; " +
      "for h in /sys/class/hwmon/hwmon*; do " +
      "case $(cat $h/name 2>/dev/null) in " +
      "k10temp|coretemp|zenpower) echo \"temp $(cat $h/temp1_input 2>/dev/null)\"; break;; " +
      "esac; done"]
    stdout: StdioCollector { onStreamFinished: root.parse(text) }
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
