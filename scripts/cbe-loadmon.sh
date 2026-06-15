#!/bin/bash
# 跨境电商 cbe 压测 — 资源监控采样器(配合 scripts/cbe-loadtest.mjs)
# 每 ~2s(docker stats --no-stream 本身阻塞 ~1.5s,故实际间隔 ~3.5s)采样:
#   gateway 进程 RSS / 宿主可用内存 / load / 容器数 / per-容器 CPU·内存
# 输出追加到 /root/loadmon.log。后台启动:setsid bash scripts/cbe-loadmon.sh &
LOG="${LOADMON_LOG:-/root/loadmon.log}"
: > "$LOG"
while true; do
  ts=$(date +%H:%M:%S)
  gwpid=$(ss -tlnp 2>/dev/null | grep ':18789' | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)
  rss=$(ps -o rss= -p "${gwpid:-0}" 2>/dev/null | tr -d ' ')
  avail=$(free -m | awk '/Mem:/{print $7}')
  load=$(cut -d' ' -f1 /proc/loadavg)
  nc=$(docker ps -q 2>/dev/null | wc -l | tr -d ' ')
  ds=$(docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}' 2>/dev/null | sed 's/openclaw-sbx-agent-//g' | tr '\n' ' ')
  echo "$ts gwRSS=$(( ${rss:-0} / 1024 ))MB avail=${avail}MB load=$load containers=$nc :: $ds" >> "$LOG"
  sleep 2
done
