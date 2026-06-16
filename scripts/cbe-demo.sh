#!/bin/bash
# 本地一键触发服务器(阿里云 ECS 47.96.40.237)上的 cbe 压测演示。
# 从仓库根目录运行,在你 Mac 终端敲一行即可,实时回显结果。
#
# 用法:  bash scripts/cbe-demo.sh [lead|screen|pure] [并发] [总数]
#   lead   (默认) 营销获客员工 并发找真实海外买家(Tavily 搜索)     例: bash scripts/cbe-demo.sh lead 8 16
#   screen        筛选背调员工 并发查真实美国公司(RDAP/SEC/域名)   例: bash scripts/cbe-demo.sh screen 8 12
#   pure          纯推理冲刺(不调工具,看吞吐峰值)                  例: bash scripts/cbe-demo.sh pure 16 48
#
# 演示时盯着网关 UI(http://localhost:28789/control/)看会话实时冒出来。
# 需要本地隧道在跑:ssh -i ~/.ssh/sentura.pem -f -N -L 13000:127.0.0.1:3000 -L 28789:127.0.0.1:18789 root@47.96.40.237
ssh -i ~/.ssh/sentura.pem \
  -o ConnectTimeout=15 -o ServerAliveInterval=5 -o ServerAliveCountMax=12 \
  root@47.96.40.237 "bash /root/demo.sh ${1:-lead} ${2:-8} ${3:-16}"
