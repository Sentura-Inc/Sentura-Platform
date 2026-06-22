#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENCLAW_DIR="$ROOT_DIR/openclaw"
OPENCLAW_CLI="$OPENCLAW_DIR/node_modules/openclaw/openclaw.mjs"
DASHBOARD_DIR="$ROOT_DIR/sentura/dashboard"
PNPM_HOME="${PNPM_HOME:-$HOME/Library/pnpm}"
PATH="$PNPM_HOME/bin:$PATH"

GATEWAY_PORT="${GATEWAY_PORT:-18789}"
DASHBOARD_PORT="${DASHBOARD_PORT:-3000}"
GATEWAY_SESSION="sentura-gateway"
DASHBOARD_SESSION="sentura-dashboard"
LOG_DIR="${TMPDIR:-/tmp}/sentura-demo"
GATEWAY_LOG="$LOG_DIR/gateway.log"
DASHBOARD_LOG="$LOG_DIR/dashboard.log"

usage() {
  cat <<EOF
Usage: scripts/start-sentura-demo.sh [start|stop|restart|status]

Starts the OpenClaw Gateway on ${GATEWAY_PORT} and Sentura Dashboard on ${DASHBOARD_PORT}.
Logs:
  $GATEWAY_LOG
  $DASHBOARD_LOG
EOF
}

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing command: $1" >&2
    exit 1
  fi
}

openclaw_command() {
  if [[ -f "$OPENCLAW_CLI" ]]; then
    printf "node '%s'" "$OPENCLAW_CLI"
  else
    printf "pnpm openclaw"
  fi
}

port_pid() {
  lsof -nP -t -iTCP:"$1" -sTCP:LISTEN 2>/dev/null | head -n 1 || true
}

screen_ids() {
  screen -list 2>/dev/null | awk -v name=".$1" '$1 ~ name { print $1 }'
}

stop_screen() {
  local session="$1"
  local id
  while IFS= read -r id; do
    [[ -n "$id" ]] && screen -S "$id" -X quit || true
  done < <(screen_ids "$session")
}

dashboard_dev_roots() {
  local rel_dashboard_dir
  rel_dashboard_dir="${DASHBOARD_DIR#$ROOT_DIR/}"
  ps -axo pid=,command= | awk -v dir="$DASHBOARD_DIR" -v rel="$rel_dashboard_dir" '
    {
      pid = $1
      command = $0
      sub(/^[[:space:]]*[0-9]+[[:space:]]+/, "", command)
      if ((index(command, dir) && command ~ /n[e]xt.* dev/) ||
          (index(command, "--dir " rel) && command ~ /p[n]pm .* dev/)) {
        print pid
      }
    }
  '
}

process_tree() {
  local pid="$1"
  local child
  [[ -z "$pid" ]] && return
  echo "$pid"
  while IFS= read -r child; do
    process_tree "$child"
  done < <(pgrep -P "$pid" 2>/dev/null || true)
}

stop_dashboard_dev_processes() {
  local roots=()
  local pids=()
  local pid
  while IFS= read -r pid; do
    [[ -n "$pid" ]] && roots+=("$pid")
  done < <(dashboard_dev_roots)
  [[ "${#roots[@]}" -eq 0 ]] && return

  while IFS= read -r pid; do
    [[ -n "$pid" ]] && pids+=("$pid")
  done < <(
    for pid in "${roots[@]}"; do
      process_tree "$pid"
    done | awk '!seen[$0]++'
  )

  [[ "${#pids[@]}" -eq 0 ]] && return
  echo "Stopping stale Dashboard dev process(es): ${pids[*]}"
  for pid in "${pids[@]}"; do
    [[ "$pid" == "$$" ]] && continue
    kill "$pid" 2>/dev/null || true
  done
  sleep 1
  for pid in "${pids[@]}"; do
    [[ "$pid" == "$$" ]] && continue
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
}

wait_for_port() {
  local port="$1"
  local label="$2"
  local elapsed=0
  while [[ "$elapsed" -lt 20 ]]; do
    if [[ -n "$(port_pid "$port")" ]]; then
      return
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  echo "$label did not start on port $port within ${elapsed}s." >&2
}

start_gateway() {
  local pid
  pid="$(port_pid "$GATEWAY_PORT")"
  if [[ -n "$pid" ]]; then
    echo "Gateway already listening on $GATEWAY_PORT (PID $pid)."
    return
  fi
  stop_screen "$GATEWAY_SESSION"
  mkdir -p "$LOG_DIR"
  : > "$GATEWAY_LOG"
  screen -dmS "$GATEWAY_SESSION" bash -lc "cd '$OPENCLAW_DIR' && exec $(openclaw_command) gateway run --port '$GATEWAY_PORT' --verbose >> '$GATEWAY_LOG' 2>&1"
}

start_dashboard() {
  local pid
  pid="$(port_pid "$DASHBOARD_PORT")"
  if [[ -n "$pid" ]]; then
    echo "Dashboard already listening on $DASHBOARD_PORT (PID $pid)."
    return
  fi
  stop_screen "$DASHBOARD_SESSION"
  stop_dashboard_dev_processes
  mkdir -p "$LOG_DIR"
  : > "$DASHBOARD_LOG"
  screen -dmS "$DASHBOARD_SESSION" bash -lc "cd '$DASHBOARD_DIR' && exec pnpm exec next dev --port '$DASHBOARD_PORT' >> '$DASHBOARD_LOG' 2>&1"
}

status() {
  local gateway_pid dashboard_pid
  gateway_pid="$(port_pid "$GATEWAY_PORT")"
  dashboard_pid="$(port_pid "$DASHBOARD_PORT")"
  if [[ -n "$gateway_pid" ]]; then
    echo "Gateway:   running on http://localhost:$GATEWAY_PORT (PID $gateway_pid)"
  else
    echo "Gateway:   stopped"
  fi
  if [[ -n "$dashboard_pid" ]]; then
    echo "Dashboard: running on http://localhost:$DASHBOARD_PORT (PID $dashboard_pid)"
  else
    echo "Dashboard: stopped"
  fi
  echo "Demo URL:  http://localhost:$DASHBOARD_PORT/client-demos/cross-border/employee"
}

stop_all() {
  stop_screen "$DASHBOARD_SESSION"
  stop_screen "$GATEWAY_SESSION"
  stop_dashboard_dev_processes
  local gateway_pid dashboard_pid
  gateway_pid="$(port_pid "$GATEWAY_PORT")"
  dashboard_pid="$(port_pid "$DASHBOARD_PORT")"
  if [[ -n "$dashboard_pid" ]]; then
    kill "$dashboard_pid" 2>/dev/null || true
  fi
  if [[ -n "$gateway_pid" ]]; then
    kill "$gateway_pid" 2>/dev/null || true
  fi
}

main() {
  local action="${1:-start}"
  case "$action" in
    start|restart)
      need_command pnpm
      need_command screen
      if [[ "$action" == "restart" ]]; then
        stop_all
        sleep 1
      fi
      start_gateway
      start_dashboard
      wait_for_port "$GATEWAY_PORT" "Gateway"
      wait_for_port "$DASHBOARD_PORT" "Dashboard"
      status
      ;;
    stop)
      stop_all
      sleep 1
      status
      ;;
    status)
      status
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      usage >&2
      exit 1
      ;;
  esac
}

main "$@"
