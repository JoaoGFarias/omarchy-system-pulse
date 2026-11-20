#!/bin/sh
# Emits the AMD GPU text protocol for the first amdgpu card (nothing if none):
#   gpu_busy <percent>, vram_used <bytes>, vram_total <bytes>, gpu_temp <millideg>
for d in /sys/class/drm/card*/device; do
  [ -r "$d/gpu_busy_percent" ] || continue
  echo "gpu_busy $(cat "$d/gpu_busy_percent")"
  echo "vram_used $(cat "$d/mem_info_vram_used")"
  echo "vram_total $(cat "$d/mem_info_vram_total")"
  for t in "$d"/hwmon/hwmon*/temp1_input; do
    [ -r "$t" ] && echo "gpu_temp $(cat "$t")" && break
  done
  break
done
