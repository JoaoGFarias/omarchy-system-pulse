# System Pulse (omarchy-sysmon)

![CPU and memory in the Omarchy bar with the details card open: CPU temperature, a load bar per thread, and memory usage](preview.png)

A bar widget for the [Omarchy](https://omarchy.org/) shell that shows live CPU and memory usage, with a details card for everything else.

- CPU % and memory % in the bar, refreshed every 2 seconds by default; urgent color above 90%
- Tooltip with exact values and GB used / total
- Left-click opens the details card; right-click (or the card's "Open btop" row) opens btop
- Card: CPU temperature (AMD `k10temp`, Intel `coretemp`), a load bar per thread, a last-minute history graph for CPU and memory, memory, swap (hidden when there is none), load average, uptime
- GPU utilisation, VRAM and temperature (AMD via sysfs; NVIDIA via `nvidia-smi` when installed; hidden when neither exists)
- Fan speeds (hidden when the machine exposes none), network down/up and disk read/write throughput
- Top processes by CPU, polled only while the card is open (`ps` CPU % is a lifetime average per process)
- Configurable refresh interval and process count

## Requirements

- Omarchy with the shell (Quickshell) bar
- `btop` (ships with Omarchy), used by the click action

## Install

```bash
omarchy plugin add https://github.com/JoaoGFarias/omarchy-sysmon.git --enable
omarchy bar put joao.sysmon --section right
```

## Settings

The refresh interval is in milliseconds (500 to 10000, default 2000):

```bash
omarchy bar set joao.sysmon interval 1000 --json
```

The number of top processes on the card is 0 to 15 (default 5, 0 hides the list):

```bash
omarchy bar set joao.sysmon processes 8 --json
```

## Keybinding

The details card can be toggled from the command line, for example from a keybinding:

```bash
omarchy-shell joao.sysmon toggle
omarchy-shell joao.sysmon close
```

## Remove

```bash
omarchy plugin remove joao.sysmon
```

## License

MIT

## Development

The parsing and math live in `SysmonModel.js`. It is typed with JSDoc and checked by `tsc --checkJs` (no build step; TypeScript is fetched on demand with `npx` and pinned, so there is no `node_modules` in the plugin folder), then unit tested with Node's built-in test runner. CI keeps all of it at 100%:

```bash
npm test               # typecheck + unit tests
npm run coverage       # fails below 100% lines, branches or functions
npm run mutation       # StrykerJS in a throwaway workspace; fails below a 100% mutation score
npm run check          # typecheck + coverage
```

Coverage and mutation testing cover `SysmonModel.js`, which holds all the logic that can run under Node. `BarWidget.qml` is checked on a real desktop by `scripts/verify.sh`.

`scripts/verify.sh` checks the plugin end to end on a running Omarchy desktop with no clicking: unit tests, manifest, bar preview, a live reload, the details card opened over IPC and screenshotted, and a scan of the shell log for QML errors. Run it with `--restart` if the live shell doesn't pick up a change.
