# omarchy-sysmon

![System monitor in the Omarchy bar](preview.png)

A bar widget for the [Omarchy](https://omarchy.org/) shell that shows live CPU and memory usage.

- Shows CPU % and memory % in the bar, refreshed every 2 seconds by default
- Turns the urgent color above 90% CPU or memory
- Tooltip with exact values and GB used / total
- Left-click opens a details card: CPU temperature (AMD `k10temp`, Intel `coretemp`), a load bar per thread, and memory used / total
- Right-click (or the card's "Open btop" row) opens btop
- Configurable refresh interval

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

## Remove

```bash
omarchy plugin remove joao.sysmon
```

## License

MIT

## Development

The parsing and math live in `SysmonModel.js` and are unit tested with Node's built-in test runner:

```bash
npm test
```
