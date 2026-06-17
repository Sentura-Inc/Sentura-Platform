#!/bin/bash
# 跨境电商 cbe — 资源监控采样器 v2(§4.4 全局监控)
# 在原 cbe-loadmon.sh 基础上加:ISO8601+ms 时间戳(对齐任务时间轴)+ DeepSeek 429 累计计数。
# 每 ~2s 采样:gateway RSS / 宿主可用内存 / load / 容器数 / per-容器 CPU·内存 / 429 累计。
# 后台启动:  MON_LOG=/root/cbe-func-out/monitor-<run>.log setsid bash cbe-loadmon2.sh &
# 停止:      pkill -f cbe-loadmon2.sh   (pkill -f 放在脚本外执行,避免自杀见坑库)
LOG="${MON_LOG:-/root/monitor.log}"
# 429 来源:gateway 日志(可用 GW_LOG 覆盖);找不到则计数恒为 0,不报错。
GW_LOG="${GW_LOG:-/root/.openclaw/logs/gateway.log}"
: > "$LOG"
echo "# ts gwRSS_MB avail_MB load containers http429_total :: per-container" >> "$LOG"
while true; do
  ts=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
  gwpid=$(ss -tlnp 2>/dev/null | grep ':18789' | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)
  rss=$(ps -o rss= -p "${gwpid:-0}" 2>/dev/null | tr -d ' ')
  avail=$(free -m | awk '/Mem:/{print $7}')
  load=$(cut -d' ' -f1 /proc/loadavg)
  nc=$(docker ps -q 2>/dev/null | wc -l | tr -d ' ')
  n429=$(grep -ciE '429|too many requests|rate.?limit' "$GW_LOG" 2>/dev/null || echo 0)
  ds=$(docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}' 2>/dev/null | sed 's/openclaw-sbx-agent-//g' | tr '\n' ' ')
  echo "$ts gwRSS=$(( ${rss:-0} / 1024 ))MB avail=${avail}MB load=$load containers=$nc http429=${n429} :: $ds" >> "$LOG"
  sleep 2
done
