# omarchy-sysmon

A bar widget for the [Omarchy](https://omarchy.org/) shell that shows live CPU and memory usage.

- Shows CPU % and memory % in the bar, refreshed every 2 seconds
- Turns the urgent color above 90% CPU or memory
- Tooltip with exact values and GB used / total
- Click to open btop

## Requirements

- Omarchy with the shell (Quickshell) bar
- `btop` (ships with Omarchy), used by the click action

## Install

```bash
omarchy plugin add https://github.com/JoaoGFarias/omarchy-sysmon.git --enable
omarchy bar put joao.sysmon --section right
```

## Remove

```bash
omarchy plugin remove joao.sysmon
```

## License

MIT
