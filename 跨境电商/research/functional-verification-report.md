> **On-demand reference — not read by default.**
>
> Back-link: [`docs/MEMORY.md`](../../docs/MEMORY.md) · 关联 [全工具测试计划](full-tool-test-plan.md) · [压测报告](loadtest-report.md) · [选址决策](server-location-llm-decision-report.md)

# 跨境电商 cbe 员工 — 全工具(8/8)功能验证详细报告(Phase 1)

**日期**: 2026-06-17 · **服务器**: 阿里云 ECS `47.96.40.237`(大陆杭州,4C16G) · **分支**: `cbe-loadtest-and-research` · **被测员工**: `cbe-buyer-screening`

---

## §0 一句话结论

配齐全部 8 个真实数据 key 后,`cbe-buyer-screening` 员工经 gateway 生产路径对 **Tesco(英国)+ Apple(美国)** 两单真实背调,**8 个工具全部真实开火、返回真数据,并按国别正确路由**(英国走 Companies House 不查 SEC、美国反之),两单都综合多源证据给出 `trusted_candidate` 结论。**功能验证 PASS。**

> ### ⚠️ 这是功能验证,不是压力测试
> | | **功能验证(本文,Phase 1)** | **压力测试(Phase 2,未做)** |
> |---|---|---|
> | 回答的问题 | 8 个工具**能不能**串起来、返回真数据、路由对不对? | 真实并发下**顶不顶得住**?吞吐/时延/成本多少? |
> | 并发 | 1(顺序 2 单) | 高并发(免费源 N=80~150)/ 低并发(全工具 N=10~20) |
> | 关注 | 正确性 · 工具覆盖 · 国别路由 · 真数据 | 吞吐天花板 · 时延分位 · 429 · 配额熔断 |
> | 规模 | 2 单 | 几十~上百单 |
>
> 压测见 [`loadtest-report.md`](loadtest-report.md)(Sweep 1/2/3 = 吞吐压测)+ 待跑的 Phase 2。本文只证"功能对不对",不谈"扛不扛得住"。

---

## §1 为什么要单独做功能验证

API 层早已逐个 `curl` 实测(8 个 key 全 200,见 [`full-tool-test-plan.md`](full-tool-test-plan.md) §0 / 测试矩阵 CE13.1–13.7)。但"curl 单点通"≠"员工自己会用":

- 员工要**自己**经 gateway、按提示词**路由**到正确的工具(英国公司不该查美股 SEC);
- 付费源**不是服务器配好就会调**——要员工主动传对参数(见 §2 触发门);
- `${ENV_VAR}` 接线、技能(skill)路由、Docker sandbox 工具过滤,只有**真跑一遍**才知道整条链路通不通。

这一步就是验"员工 → gateway → MCP → 上游 API → 真数据 → 综合结论"的**端到端全链路**。

---

## §2 被测的 8 个工具(+ 包装它们的 MCP 工具 + 触发门)

8 个上游数据源由 `cross-border-intel` MCP 的 10 个 `cbe_intel_*` 工具包装。**关键:一个 MCP 工具可能内含多个上游源**(如 `email_domain_check` 同时打 DNS + Abstract + Hunter)。

| # | 上游源 | MCP 工具 | 端点 / 认证 | 额度 | 触发门(谁决定它开火) |
|---|---|---|---|---|---|
| 1 | **Companies House**(UK 注册局) | `cbe_intel_company_registry_search` + `cbe_intel_company_profile` | `api.company-information.service.gov.uk`,Basic auth | 🟡 600/5min | 公司是英国 → 员工自然调用 |
| 2 | **RDAP**(域名注册) | `cbe_intel_domain_rdap_lookup` | `rdap.org`(302→权威) | 🟢 无限 | 有域名即调 |
| 3 | **DNS**(MX/SPF/DMARC) | `cbe_intel_email_domain_check`(主结果) | 公共 DNS | 🟢 无限 | 有域名即调 |
| 4 | **Abstract**(Email Reputation) | `cbe_intel_email_domain_check` 内 `paid_validation` | `emailreputation.abstractapi.com` | 🔴 100/月 | **需 `enable_paid_validation=true` + 具体 email**(默认 false) |
| 5 | **Hunter**(邮箱验证) | `cbe_intel_email_domain_check` 内 `paid_validation` | `api.hunter.io/v2/email-verifier` | 🔴 100/月 | 同上 |
| 6 | **ImportYeti**(海关贸易) | `cbe_intel_trade_record_search` | `data.importyeti.com/v1.0/company/search`,头 `IYApiKey` | 🔴 ~99 次 | **需 `max_paid_spend_usd>0` + 服务器 `CBE_ENABLE_PAID_TRADE_DATA=true`**(参数默认 0) |
| 7 | **SEC EDGAR**(美股备案) | `cbe_intel_sec_lookup` | `data.sec.gov`,只要 UA 头 | 🟢 无限 | 公司是美股 → 员工自然调用 |
| 8 | **Tavily**(网页搜索) | `web_search`(内置工具,非本 MCP) | — | 🟡 ~1000/月 | 补公开口碑即调 |

> **触发门是功能验证最关键的一环**:付费源(Abstract/Hunter/ImportYeti)**默认参数下不开火**——即使服务器把闸全开,员工不主动传 `enable_paid_validation=true` / `max_paid_spend_usd>0` 照样不调。技能 `domain-email-verification` / `trade-record-check` 明确写"只在 operator 授权付费时走付费分支"。所以提示词必须**扮 operator 显式授权付费 + 给预算 + 给待验邮箱**,这正是 §3 提示词的设计要点。

---

## §3 测试方法

**路径**:走 gateway 生产路径 `agent`(派发,返回 `runId`)+ `agent.wait`(阻塞到完成),**非** `/run` 诊断路由——和压测同路,确保测的是真实生产链路。

**提示词设计**(自然语言,让员工自己路由,但显式授权付费):
- **Tesco**:"operator 已授权付费邮箱校验 + 付费贸易数据(单次预算 $1)",要求查 ① CH 注册 ② RDAP ③ MX/SPF/DMARC ④ 对 `customer.services@tesco.com` 做付费邮箱校验 ⑤ 海关进口记录 ⑥ 网页口碑;**明示"英国公司无需查美国 SEC"**。
- **Apple**:"operator 已授权付费贸易数据($1)",查 ① SEC ② RDAP ③ DNS ④ 海关记录 ⑤ 网页;**明示"只验美国侧、不做付费邮箱校验"(省 Hunter/Abstract 月配额)+ "美国公司无需查英国 CH"**。

**埋点**(§4 全局监控规范):驱动 [`scripts/cbe-functional-test.mjs`](../../scripts/cbe-functional-test.mjs) 自打三时间戳(`enqueue→accepted→done`),跑后经 `sessions.json` 的 `sessionKey(小写)→sessionId` 映射定位磁盘轨迹 `<sessionId>.jsonl`,解析 `message` 事件流取每工具延迟(toolResult.ts − 发起 assistant.ts)、LLM 回合耗时、ImportYeti `executionTime`、Hunter/Abstract 子结果。资源由 [`scripts/cbe-loadmon2.sh`](../../scripts/cbe-loadmon2.sh) 2s 采样。原始证据:[`results/`](results/)。

---

## §4 测试用例 1 — Tesco PLC(英国)

**期望 7/8**(CH + RDAP + DNS + Hunter + Abstract + ImportYeti + Tavily,不含 SEC)→ **实测全部命中,SEC 正确跳过。**

| 上游源 | MCP 工具 | http | status | 延迟 | 真数据(摘) |
|---|---|---|---|---|---|
| Companies House | `company_profile`(+ `registry_search`) | 200 | found | 2.68s | **00445790**,注册 1947-11-27,active,plc,Welwyn Garden City AL7 1GA,SIC 47110 |
| RDAP | `domain_rdap_lookup` | 302 | redirect→Verisign | 2.05s | tesco.com 注册 1994-12-20,到期 2027-12-19,MarkMonitor,8 台 UltraDNS |
| DNS | `email_domain_check` | — | checked | 4.21s | MX=Proofpoint(pphosted.com 2 条),DMARC **p=reject**→proofpoint |
| **Abstract** | `email_domain_check`·paid | 200 | ok | 4.21s | `customer.services@tesco.com` **deliverable score 0.99**,SMTP valid |
| **Hunter** | `email_domain_check`·paid | 200 | **accept_all** | 4.21s | score **74**,SMTP 通过;非角色/非一次性邮箱 |
| **ImportYeti** | `trade_record_search` | 200 | found | 4.21s | 2 条记录(Tesco Primary Bulk VA / Tesco Building Supplies PA 1011 票),exec **21ms** |
| Tavily | `web_search` | — | ok | 2.68s | 5 条:英国最大超市 28.4% 份额、2025/26 营业利润 £3,152M |
| ~~SEC~~ | (未调用) | — | — | — | 英国公司,**正确跳过** ✅ |

**时延**:t_e2e **47.8s**,t_llm **34.7s**,6 回合。员工另调了 `web_fetch`(内置,4.2s)取官网。
**结论**:`trusted_candidate`,归一化 **97/100**(贸易维度扣 3 分:海关记录对应美国关联实体而非英国母公司直接进口)。

> 几个工具延迟都是 4.21s,因为它们在**同一回合并行发起**(assistant 一次发多个 toolCall),共享发起时刻、各自返回——这是延迟相近的原因,不是测量误差。

---

## §5 测试用例 2 — Apple Inc.(美国)

**期望 5/8**(SEC + RDAP + DNS + ImportYeti + Tavily,不含 CH;本单不开付费邮箱)→ **实测全部命中,CH 正确跳过。**

| 上游源 | MCP 工具 | http | status | 延迟 | 真数据(摘) |
|---|---|---|---|---|---|
| **SEC** | `sec_lookup`(2 次) | — | ⚠ fetch error | 0.58s / 2.81s | 工具**开火但 API 临时报错**;员工**自愈**经 web_search/EDGAR 取得真数据 |
| RDAP | `domain_rdap_lookup` | 302 | redirect→Verisign | 2.81s | apple.com 注册 **1987-02-19**(39 年),到期 2027-02-20,Nom-iq/COM LAUDE |
| DNS | `email_domain_check` | — | checked | 2.81s | MX 6 台(mx-in.g.apple.com),SPF `_spf.apple.com`,DMARC **p=quarantine; sp=reject** |
| **ImportYeti** | `trade_record_search` | 200 | found | 2.81s | **2,428 票**总出货,供应商鸿海/富士康·立讯·Primax,exec **35ms** |
| Tavily | `web_search`(2 次) | — | ok | 2.87s | 3 条:Forbes Global 2000、FY2025 营收 $416.2B |
| ~~CH~~ | (未调用) | — | — | — | 美国公司,**正确跳过** ✅ |

**时延**:t_e2e **38.5s**,t_llm **29.7s**,6 回合。另调 `web_fetch`(1.69s)。
**结论**:`trusted_candidate`,归一化 **100/100**;SEC 主体经公开文件交叉验证(CIK `0000320193`,FY2025 10-K)。

> **SEC 这次诚实记录**:`sec_lookup` 工具**确实开火了**(2 次调用),但 `data.sec.gov` 的多步流程(~1MB company_tickers.json + submissions)从大陆返回 fetch error——这与 Sweep 3 的发现一致(**SEC 从大陆"可达但慢",多步流程易超时,非封锁**)。员工没卡死,而是**自动回退** web_search/EDGAR 拿到真实 SEC 数据(CIK、10-K 链接)。所以"SEC 工具开火"成立、"SEC 数据拿到"成立,但**真数据来自 fallback 而非 SEC API 本身的干净响应**——这点不夸大。

---

## §6 时间指标(§4.1)

| 任务 | t_e2e | t_queue | t_exec | t_llm | LLM 占比 | 回合 |
|---|---|---|---|---|---|---|
| Tesco-UK | 47.8s | ~0s | 47.8s | 34.7s | 73% | 6 |
| Apple-US | 38.5s | ~0s | 38.5s | 29.7s | 77% | 6 |

- **t_queue≈0**:顺序单并发,无排队(排队时延要到 Phase 2 高并发才显现)。
- **LLM 占 73~77%**:单任务耗时主要花在 DeepSeek 多回合推理(thinking=high),工具网络延迟是次要项——这解释了为什么真实任务(~40s)远慢于纯推理压测(~5s),也预示 Phase 2 全工具压测的吞吐会更低。
- t_e2e 分位(2 单):p50≈38.5s,max≈47.8s。

---

## §7 成本 / 配额(诚实账)

| 源 | 本次调用 | 配额影响 | 实际 $ |
|---|---|---|---|
| ImportYeti | 2 次 `/company/search` | **`creditsRemaining` 两次都 = 100(未减)** | ≈ **$0** |
| Hunter | 1 次 verify | 100/月 免费额度内(用 1) | $0 |
| Abstract | 1 次 reputation | 100/月 免费额度内(用 1) | $0 |
| CH / RDAP / DNS / SEC / Tavily | 各若干 | 🟢🟡 充足 | $0 |

> **重要纠正**:之前估"$0.18(2×ImportYeti @$0.09)"是**保守上限**。实测 ImportYeti 响应的 `creditsRemaining` **两次都停在 100**——说明 `/company/search` 端点**不消耗 $9/100 的额度**(额度可能只在更详细的 company 详情端点扣)。员工自己也判读为"成本 $0"。**本次全工具背调的真实增量花费 ≈ $0**(都落在各源的免费/不计费档内)。这对 Phase 2 预算熔断设计是好消息:`/company/search` 这条链路可以放心多跑,真正要数着烧的是详情端点。

---

## §8 资源快照(§4.4)

2s 采样器([`results/monitor-func-20260617-132417.log`](results/monitor-func-20260617-132417.log),59 个采样,~2 分钟):

- **gateway RSS**:384MB → 峰值 **707MB**;
- **host load**:≤ 0.07(4 核,几乎空载);
- **sandbox 容器**:1~2 个,内存 444KiB(推理在 DeepSeek 远端,容器只跑编排);
- **DeepSeek 429**:**0 次**;无超时、无重试。

功能验证负载极轻,资源远未承压——资源瓶颈是 Phase 2 高并发才要盯的事(压测报告 §四:gateway 内存是单台真天花板)。

---

## §9 过程中踩的 3 个工程坑(已修 + 入坑库)

1. **sessionKey 必须 `agent:<agentId>:` 前缀**:否则 gateway 解析出 agent="main",`agent` RPC 报 `does not match session key agent "main"` **秒拒**(e2e≈60ms、0 额度)。首跑因此两单全 error——但没烧额度。
2. **gateway 把 sessionKey 全小写化存盘,且原始会话 JSONL 不含 sessionKey 字段**:派发 `…func-Tesco-UK-…`,`sessions.json` 里存的是 `…func-tesco-uk-…`(全小写)。回查轨迹**不能 grep sessionKey**(文件里没有),必须经 `sessions.json` 的 `key(小写)→sessionId` 映射。第二跑任务真跑了、真出数据,但因这条没解析出来。
3. **`REPARSE_RUN=<run>` 救场**:轨迹一旦落盘,解析就该能脱离 gateway 重跑。给驱动加了 `REPARSE_RUN` 模式(跳过派发、时间从 `sessions.json` 取、只重解析磁盘轨迹),把第二跑的数据**0 额外花费**救回。**教训:先小样跑一单确认解析链路通,再批量烧 🔴 限量源额度。**

---

## §10 验收结论

| 验收项 | 结果 |
|---|---|
| 8 工具并集覆盖 | **8/8 全部真实开火** ✅ |
| 每个"该触发"的工具返回真数据(非 `unavailable_api`/`disabled_by_budget`) | ✅(SEC 经 fallback,见 §5) |
| 国别路由正确(UK→CH 不 SEC、US→SEC 不 CH) | ✅ 两单都对 |
| 付费源在 operator 授权 + 预算闸内按需开火 | ✅ Hunter/Abstract/ImportYeti 都按授权点起 |
| 多源证据综合成可信度结论,无渲染崩溃/无 agent_timeout | ✅ 两单 `trusted_candidate` |
| 成本可控 | ✅ 实际增量 ≈ $0(见 §7) |

**Phase 1 功能验证 PASS。全工具链路打通,可进入 Phase 2 配额感知压测。**

---

## §11 本文不覆盖什么(→ Phase 2 压测)

功能验证只证"对不对",**没测**:真实并发吞吐天花板、时延分位(p95/p99 尾延)、429 雪崩、配额熔断在压力下是否生效、全工具高并发下的成本曲线。这些是 [`full-tool-test-plan.md`](full-tool-test-plan.md) §2 的 Phase 2 双轨压测(Track A 免费源高并发 / Track B 全工具小批量带预算熔断,驱动 `scripts/cbe-fulltool-stress.mjs` 待写)。

---

## §12 复现

```bash
# 服务器上(gateway 在跑),顺序跑 Tesco+Apple,付费源开,§4 全埋点:
MON_LOG=/root/cbe-func-out/monitor-$RUN.log GW_LOG=/root/gateway.log \
  setsid bash /root/cbe-loadmon2.sh >/dev/null 2>&1 &
OPENCLAW_DIR=/root/sentura/openclaw OUTDIR=/root/cbe-func-out \
  node /root/cbe-functional-test.mjs

# 只重解析磁盘轨迹(不重派任务、不烧额度):
REPARSE_RUN=<run> OPENCLAW_DIR=/root/sentura/openclaw OUTDIR=/root/cbe-func-out \
  node /root/cbe-functional-test.mjs
```
产物三件套:`results-<run>.jsonl`(逐任务)+ `summary-<run>.md`(汇总)+ `monitor-<run>.log`(2s 资源时间序列)。本次:[`results/`](results/)。
