> **On-demand reference — not read by default.**
>
> Back-link: [`docs/MEMORY.md`](../../docs/MEMORY.md) · 关联 [压测报告](loadtest-report.md) · [选址决策](server-location-llm-decision-report.md)

# 跨境电商 cbe — 全工具(8/8)功能验证 + 终极压测计划

**状态日期**: 2026-06-17 · **服务器**: 阿里云 ECS `47.96.40.237`(大陆杭州,4C16G) · **分支**: `cbe-loadtest-and-research`

本文件是"全部 8 个真实数据工具配齐后"的测试蓝图 + 当前状态快照。**先看 §0 状态,再按 §1 功能验证 → §2 压测执行。**

---

## §0 当前状态快照(2026-06-17 配齐)

### 8 个工具 + key 状态
所有 key 都在服务器 `/root/.openclaw/.env`,并通过 `${ENV_VAR}` 引用接进 `cross-border-intel` MCP 的 env 块(`/root/.openclaw/openclaw.json` → `mcp.servers.cross-border-intel.env`)。OpenClaw 运行时解析 `${}`(CE8.11 证实)。

| # | 工具 | env 变量 | 端点 / 认证 | 实测 | 额度 |
|---|---|---|---|---|---|
| 1 | Companies House(UK 注册局) | `COMPANIES_HOUSE_API_KEY` | `api.company-information.service.gov.uk`,Basic auth(key 当用户名、密码空) | ✅ LIVE 200,Tesco PLC 真数据 | 🟡 600/5min |
| 2 | Abstract(**Email Reputation**) | `ABSTRACT_API_KEY` | `emailreputation.abstractapi.com/v1/?api_key=` | ✅ 200 | 🔴 100/月 |
| 3 | Hunter(邮箱验证) | `HUNTER_API_KEY` | `api.hunter.io/v2/email-verifier?api_key=` | ✅ 200,Free 方案 | 🔴 100 验证 + 50 搜索/月 |
| 4 | ImportYeti(海关贸易) | `IMPORTYETI_API_KEY` | `data.importyeti.com/v1.0/company/search?name=`,头 `IYApiKey` | ✅ 200,Apple 2428 票 | 🔴 ~99 次($9/100) |
| 5 | Tavily(网页搜索) | `TAVILY_API_KEY` | — | ✅(早有) | 🟡 ~1000/月 |
| 6 | SEC EDGAR(美股备案) | `SEC_USER_AGENT` | `data.sec.gov`,只要 UA 头、无 key | ✅ 免 key | 🟢 无限 |
| 7 | RDAP(域名注册) | 无 | `rdap.org` 等,公共协议 | ✅ 免 key | 🟢 无限 |
| 8 | DNS(MX/SPF/DMARC) | 无 | 普通 DNS 查询 | ✅ 免 key | 🟢 无限 |

### 付费贸易数据闸(ImportYeti 专用)
MCP env 块里:`CBE_ENABLE_PAID_TRADE_DATA=true`(原 false)+ `CBE_MAX_PAID_SPEND_USD=1`(每次请求 $1 上限,原 0)。代码逻辑:`tools.ts:668 budget=min(config.maxPaidSpendUsd, args.max_paid_spend_usd)`;`:701-705` ImportYeti 仅在 `enablePaidTradeData && key && budget>0` 时调用;否则 `disabled_by_budget`/`unavailable_api`。**开了之后每次背调都会烧 ~1 次 ImportYeti(~$0.09)**。

### ⚠️ 额度地图(压测硬约束)
- 🟢 **能狂压(无限)**:RDAP / DNS / SEC
- 🟡 **够用**:Companies House(600/5min)、Tavily(~1000/月)
- 🔴 **限量(几秒烧光,不能高并发)**:Abstract(100/月)、Hunter(100/月)、ImportYeti(~99 次/$9)

### 纠错(之前判断错的,以实测为准)
1. **Hunter API 不是付费专属**——Free 方案就给 API(100 验证 + 50 搜索/月)。之前"要 Growth+ 付费"是被一篇博客带偏。
2. **ImportYeti 有 $9/100 按量档**——不是只有 $1000/月企业版。
3. **Abstract 用的是 Email Reputation 产品**(`emailreputation.abstractapi.com`),不是 Email Validation——Abstract 每产品独立 key。
4. **Companies House 必须用 Live(正式)环境的 REST key**——Test/Sandbox key 打正式 API 返回 401(沙箱 200、正式 401 是铁证)。
> 这几条意味着 `server-location-llm-decision-report.md` 第 0 章表里 Hunter/ImportYeti 标的"付费/缺口"现在已变"配齐可用",该表需订正。

### 服务器 / 基建状态
- gateway(18789 loopback)+ dashboard(3000)都在跑,用修好的 `/root/gw-restart2.sh`(功能探针判就绪 + 彻底杀端口占用者)重启过,`WARM_after_3s`。
- Mac→服务器隧道:**autossh** 自动重连(`-L 13000:3000 -L 28789:18789`),断网自愈。
- **同事在另一台 ECS**(他的 key 不在 47.96.40.237;同账号可开多台,IP 也恰好显示 47.96.40.237 但 .env 对不上——以 47 这台的实测为准)。
- 备份:`openclaw.json.bak-{chkey,abs,hunter,iy}`、`.bak-cleanup` 都在 `/root/.openclaw/`。
- 接线脚本:`/root/wire-{chkey,abs,hunter,importyeti}.mjs`(node 改 openclaw.json env 块)。
- 填 key 的安全姿势:`ssh -t ... 'read -rsp ... K; grep -v ^VAR= .env > tmp; printf "VAR=%s\n" "$K" >> tmp; mv tmp .env'`(key 不进聊天/历史)。

---

## §1 Phase 1 — 功能验证(确认员工真的串起 8 个工具)

**目标**:API 层已逐个 curl 实测 ✅;本阶段验证 **cbe-buyer-screening 员工自己**经 gateway 真实调用这些工具、返回真数据(端到端验证 `${}` 接线 + 员工技能路由)。

### 脚本规划:`scripts/cbe-functional-test.mjs`(待写)
走 gateway WS 生产路径(同压测,**非** /run 诊断路由):
1. **连接 + 握手**:`ws://127.0.0.1:18789`,收 `connect.challenge` → 回 `connect`(`minProtocol=4,maxProtocol=4`,`client.id="openclaw-tui"`,`auth.token` 取自 `~/.openclaw/openclaw.json` 的 `gateway.auth.token`)。
2. **派任务**:`agent` 方法(必填 `message` + 唯一 `idempotencyKey`,带 `agentId="cbe-buyer-screening"` + 自定 `sessionKey`)→ 拿 `runId`。
3. **等完成**:`agent.wait {runId, timeoutMs:280000}`。
4. **取轨迹**:`chat.history {key: sessionKey}`(或订阅 session 事件)→ 解析**工具调用列表**(哪些 provider 开火)+ **最终答案**(assistantTexts)。
5. **打印**:每家公司 → 调了哪几个工具 / 各返回什么真数据 / 有无 `coverage gap`/失败。

> 在能解析 `ws` 的机器跑(服务器):`OPENCLAW_DIR=/root/sentura/openclaw node /root/sentura/openclaw/cbe-functional-test.mjs`(参考现成 `_loadtest-tools.mjs` 的握手代码)。

### 测试用例
| 公司 | 期望触发的工具 | 不触发(N/A) |
|---|---|---|
| **英国**:Tesco PLC(tesco.com) | Companies House + RDAP + DNS + Hunter + Abstract + ImportYeti + Tavily(7/8) | SEC(美股专属) |
| **美国**:Apple Inc(apple.com) | SEC + RDAP + DNS + ImportYeti + Tavily(5/8) | Companies House(英国专属) |

提示词(自然语言,让员工自己路由):"对【英国公司 Tesco PLC,域名 tesco.com】做一次尽量完整的买家背调:公司注册、域名、官网邮箱验证、海关进口记录、网络口碑都查一遍,给可信度结论。"

### 验收标准
- 每个"该触发"的工具返回**真数据**(不是 `unavailable_api`/`disabled_by_budget`);
- ImportYeti 真出海关票数、CH 真出注册信息、Hunter/Abstract 真出邮箱判定;
- 无渲染崩溃 / 无 agent_timeout;答案把多源证据综合成结论。
- **成本**:2 家 × (~1 ImportYeti + ~1 Hunter + ~1 Abstract) ≈ 个位数额度。

---

## §2 Phase 2 — 终极全工具压力测试(配额感知,双轨)

**目标**:真实并发下的吞吐 + 每个工具成功率 + 配额/预算消耗。**核心约束**:🔴 限量源(Abstract/Hunter/ImportYeti)几秒烧光,所以不能"全工具高并发"——拆双轨。

### Track A — 免费源高并发(测吞吐天花板)
- 任务:只用 🟢🟡 源的背调(RDAP/DNS/SEC + 轻量 Tavily/CH),**关掉**付费验证。
- 复用 `scripts/cbe-loadtest-tools.mjs`(`CBE_MODE=screening`,其提示词本就"不调付费源")。
- 并发:`maxConcurrent=8`(Sweep 1/2 已证最优),N 大(如 80-150),爬坡 C=1/4/8/12/30。
- 量:吞吐(任务/分)、时延、gateway RSS、错误/超时。**对标 Sweep 3 的 ~10-15 任务/分,确认配齐后免费链路稳定**。

### Track B — 全工具小批量(测全链路 + 真成本,严控预算)
- 任务:用**全部 8 工具**的完整背调(付费源开)。
- **预算护栏(必须先做)**:跑前 snapshot 剩余额度(Hunter `/account`、ImportYeti 响应里的 `creditsRemaining`、Abstract 无 /account 则估算);设上限 **总 ImportYeti 调用 ≤ 30 次(~$2.7)**、总 Hunter ≤ 30、Abstract ≤ 30;脚本里数着调用数,到顶即停。
- 规模:**N=10~20,低并发(C=2~4)**,绝不高并发。
- 量:每个工具的成功率 / 失败率(401/429/timeout/coverage-gap)、每次背调的**真实成本**(ImportYeti `requestCost` 累加 + Hunter/Abstract 次数)、单任务端到端时延、答案质量。
- 脚本规划:`scripts/cbe-fulltool-stress.mjs`(待写)= 在功能验证驱动上加 ① 配额预检 ② 调用计数器 + 预算熔断 ③ 低并发循环 ④ 跑后再查剩余额度,出"消耗了多少 / 还剩多少"账单。

### 量测口径 / 验收
- Track A:给出干净的"配齐后免费链路吞吐"数字(任务/分 + 成功率 100%)。
- Track B:**所有 8 工具在真实任务里都开过火**至少 1 次成功;产出"**每次全工具背调 ≈ 烧多少钱 / 多少额度**"的单位成本;无预算超支、无 429 雪崩。
- 任何一档 0/N 全失败 → 先查 `gateway.log` 的 SIGTERM / 重启竞态(压测铁律),再谈容量。

---

## §3 复现 / 状态自检命令

```bash
# 看 8 个 key + 付费开关(只列名,不打印值)
ssh -i ~/.ssh/sentura.pem root@47.96.40.237 \
  'grep -oE "^[A-Z_]+=" /root/.openclaw/.env; node -e "const c=require(\"/root/.openclaw/openclaw.json\");console.log(c.mcp.servers[\"cross-border-intel\"].env)"'

# 单独 curl 复验某个 key(以 Companies House 为例,读 key 不打印)
ssh -i ~/.ssh/sentura.pem root@47.96.40.237 \
  'K=$(grep "^COMPANIES_HOUSE_API_KEY=" /root/.openclaw/.env|cut -d= -f2-); curl -s -o /dev/null -w "%{http_code}\n" -u "$K:" "https://api.company-information.service.gov.uk/company/00445790"'

# 网关 / dashboard 起停
ssh ... 'bash /root/gw-restart2.sh'      # 网关(功能探针判就绪)
ssh ... 'bash /root/dash-clean.sh'       # dashboard(清 .next 干净重建)

# Mac 隧道(autossh 自愈;掉了重起)
AUTOSSH_GATETIME=0 autossh -M 0 -f -N -o ServerAliveInterval=5 -o ServerAliveCountMax=3 \
  -i ~/.ssh/sentura.pem -L 13000:127.0.0.1:3000 -L 28789:127.0.0.1:18789 root@47.96.40.237
```

---

## §4 全局监控 / 指标规范(驱动必须按此埋点)

功能 + 压测驱动**都**必须采集下列指标,输出三件套(§4.6)。时间戳一律 ISO8601+毫秒,延迟一律 ms。

### §4.1 时间指标(核心 — 用户明确要求)
| 指标 | 怎么测 | 说明 |
|---|---|---|
| **总耗时** `wall_clock` | 首任务 enqueue → 末任务 done | 整批墙钟 |
| **吞吐** `throughput` | 任务数 / wall_clock | 任务/分 + 任务/秒 |
| **单任务端到端** `t_e2e` | `t_done - t_enqueue` | 用户视角总延迟;出 min/mean/**p50/p95/p99/max**(别只看 mean——Sweep 3 尾延 187s 才是真相) |
| **排队时间** `t_queue` | `t_accepted - t_enqueue` | `agent` 返回 `accepted` 时刻 − 派发时刻(Main lane 闸排队) |
| **执行时间** `t_exec` | `t_done - t_accepted` | 真正跑的时间 |
| **LLM 推理** `t_llm` | trajectory `model.completed.{startedAt,endedAt}` 逐回合累加 | DeepSeek 每回合耗时 × 回合数 |
| **每工具延迟** `t_tool[provider]` | trajectory 工具事件时间戳 / MCP 自报(ImportYeti 响应带 `executionTime`)| RDAP/DNS/SEC/CH/Hunter/Abstract/ImportYeti/Tavily 各自 min/mean/p95/max |

### §4.2 工具级指标(每 provider)
调用次数 · 成功(200)/失败(401/403/429/timeout)/覆盖缺口(`disabled_by_budget`/`unavailable_api`)分类计数 · 每工具延迟分位数 · 返回数据量(records 数 / bytes)。

### §4.3 成本 / 配额(付费源,必采)
- **ImportYeti**:累加响应 `requestCost` + 跑前/跑后 `creditsRemaining` 差值;
- **Hunter**:跑前/跑后打 `/v2/account`(免额度)读 verifications/searches `used` 差值;
- **Abstract**:无 /account → 计数估算(每次 1);
- **合计**:估算总 $ 花费 + 各源剩余;**预算熔断**(任一 🔴 源到底即停,记录停在第几个任务)。

### §4.4 系统 / 资源(2s 采样器,扩展现成 `cbe-loadmon.sh`)
gateway **RSS**(Sweep 1 的单台瓶颈 447→1610MB,必采)· host load · 可用内存 · docker 容器数/各容器 CPU·mem(对 2GiB 上限)· DeepSeek **429 计数** · Main lane 在跑/排队数。→ 时间序列 `monitor-<run>.log`,跑后对齐任务时间轴。

### §4.5 可靠性
success rate(ok/total)· 错误明细分类 · 重试次数 · 空答案数。**0/N 全失败 → 先查 `gateway.log` 的 SIGTERM/重启竞态,再谈容量**(压测铁律)。

### §4.6 输出三件套
1. **逐任务 JSONL** `results-<run>.jsonl`:每行
   `{task_id, agent, company, sessionKey, runId, concurrency, t_enqueue, t_accepted, t_done, t_e2e, t_queue, t_exec, t_llm, tools:[{provider, http, latency_ms, ok, records}], cost_usd, status, error}`
2. **汇总报告** `summary-<run>.md`:总耗时 · 吞吐 · `t_e2e` 分位数表 · 每工具统计表 · 成本账单 · success rate · 资源峰值。
3. **系统时间序列** `monitor-<run>.log`(2s 采样)。

### §4.7 数据从哪来(实现要点)
- 驱动自打三时间戳 `t_enqueue`(发 `agent` 前)/`t_accepted`(`agent` 返回)/`t_done`(`agent.wait` 返回)→ 算 queue/exec;
- 工具延迟 + LLM 耗时:跑后 `chat.history {key}` 或订阅 session 事件,解析 trajectory(参考服务器 `/root/parse-traj.mjs`),取 `model.completed` 与工具调用事件的时间戳;ImportYeti 直接用响应里的 `executionTime`;
- 资源:扩展 `cbe-loadmon.sh`(已采 gwRSS/load/containers,加 429 grep + 时间戳);
- 配额:跑前后各打一次 Hunter `/account` + 记 ImportYeti `creditsRemaining`。

---

## §5 待办(下次接着干)
- [x] 写 `scripts/cbe-functional-test.mjs`(**按 §4 全埋点**:三时间戳 + 每工具延迟 + LLM 耗时 + 成本 + 输出三件套)+ 跑 Phase 1(Tesco + Apple)。**2026-06-17 PASS:并集 8/8 工具全真实开火**(Tesco 7/8 含 Hunter/Abstract/ImportYeti,Apple 5/8 含 SEC/ImportYeti,均 `trusted_candidate`)。真实增量花费 **≈ $0**(ImportYeti `creditsRemaining` 未减 / Hunter·Abstract 免费配额内);gwRSS 384→707MB,0×429;国别路由正确。SEC 工具开火但 API 临时 fetch error→员工自愈 web_search/EDGAR 拿真数据。**详细报告:[`functional-verification-report.md`](functional-verification-report.md)**;证据:`research/results/`;压测报告摘要见 `loadtest-report.md` 第八章。
- [ ] 写 `scripts/cbe-fulltool-stress.mjs`(含配额预检 + 预算熔断 + **§4 全埋点 + 扩展 `cbe-loadmon.sh` 2s 采样**)+ 跑 Phase 2 双轨。**(下一步)**
- [x] 复用/扩展服务器 `cbe-loadmon.sh` → `scripts/cbe-loadmon2.sh`(ISO 时间戳 + 429 计数);轨迹解析直接在驱动内做(经 `sessions.json` 的 `sessionKey(小写)→sessionId` 映射定位文件,parse `message` 事件)。
- [x] 把功能验证结果写进 `loadtest-report.md` 第八章 + CE13.9/13.10 测试行。
- [x] 订正 `server-location-llm-decision-report.md` 第 0 章表(CH/SEC/RDAP/Hunter/Abstract/ImportYeti 已配齐实测可用)。
- [ ] commit Phase 2 结果(本次功能验证已 commit;Phase 2 待跑)。

### 工程坑(本次新增,已记坑库)
1. **sessionKey 必须 `agent:<agentId>:` 前缀**:否则 gateway 解析出 agent="main",`agent` RPC 报 `does not match session key agent "main"` 秒拒(不烧额度)。
2. **gateway 把 sessionKey 全小写化存盘**,且**原始会话 JSONL 不含 sessionKey 字段**——回查轨迹必须经 `sessions.json` 的 `key(lowercased)→sessionId` 映射,不能 grep sessionKey。
3. 付费源开火靠**员工传参**(非服务器配置):Hunter/Abstract 需 `email_domain_check(enable_paid_validation=true, email=...)`(默认 false);ImportYeti 需 `trade_record_search(max_paid_spend_usd>0)`(默认 0,budget=min(配置1,传参0)=0 则不开火)。提示词必须以"operator 已授权付费 + 给定预算/邮箱"触发技能里的付费分支。
