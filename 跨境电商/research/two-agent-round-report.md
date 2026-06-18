# 跨境电商 — 两员工补测轮报告(cbe-accio-memory + cbe-lead-discovery)

> 生成:2026-06-19 · 分支 `cbe-loadtest-and-research` · 服务器 阿里云 ECS 47.96.40.237
> 配套:本轮原始证据在 `/root/cbe-agent-out/`(L1 功能)、`/root/cbe-stress2-out/`(L2/L3 压测);驱动在 `scripts/cbe-*.mjs`;loadtest 主报告见 [loadtest-report.md](loadtest-report.md) 第十一章。

## 0. 这一轮干了什么 / 为什么

此前所有功能/压测只覆盖 **cbe-buyer-screening**(背调员工)。本轮补齐另外两个员工:

| 员工 | 主业 | 与 8 工具关系 |
|---|---|---|
| **cbe-accio-memory** | Alibaba Accio 聊天导出 → 结构化成交摘要 + 记忆预览 + 背调移交载荷 | **零外部 API**(parse/summarize 是纯本地正则);只读记忆 |
| **cbe-lead-discovery** | 自然语言 brief → web_search 找 B2B 下游买家 → 去重 → LeadCandidate 列表 + 移交载荷 | 仅 web_search(Tavily)+ 轻量 RDAP/DNS 增强;记忆 OFF |

三层:**L1 功能验证(各按自己主业)→ L2 handoff 交接链路 → L3 最高强度压测(拆护盾逼 429 + fallback + RSS + 跨会话串扰)**。钱不是约束、强度拉满。

**读代码先得 3 个结论(跑测之前)**:
1. `handoff-to-screening` **不是运行时跨员工调用**,是"产出 typed JSON 载荷 → 操作员复制 → 粘进背调仪表盘"的产物式交接;两个发送方在 config 里**结构性禁掉** `sessions_send/sessions_spawn/gateway/message`,物理上无法调起背调。
2. ⚠️ 背调仪表盘的 `buildScreeningPayload` 只解 `{leads:[…]}`/裸数组 → accio 的 `{targets:[…]}` 和 lead 完整信封 `{handoff_id,…,targets:[…]}` 会被**静默吃成空批次**(真 bug)。
3. 两个员工几乎无付费 API 烧钱面(accio 零外部、lead 仅免费 Tavily/RDAP/DNS)。

---

## 1. L1 功能验证(各自主业)

驱动 `scripts/cbe-agent-functional.mjs`(AGENT-env,共享 `cbe-lib.mjs` 握手/轨迹/marker/schema 校验)。走生产 gateway `agent`+`agent.wait`,C=1,解析磁盘轨迹 + 解析 marker 块做断言。**accio 用生产 prompt 原样(dashboard buildEmployeePrompt)**。

### 1.1 cbe-accio-memory(核心全绿 + 零写入铁证)

| 用例 | 结果 | 说明 |
|---|---|---|
| FC-A1/A2/A8(golden 3 对话) | **18/18 ✅** | parse+summarize 开火;conversation_count=3;conv_001 `seller_best_price_usd≈0.36`、`packaging_addon_usd≈0.03`(区分单价)、付款 `T/T 30%`、`FOB Shenzhen`;3 条摘要;screening_handoff_target source=accio_memory;无背调/sessions 工具;marker 单对、CL 保留 |
| FC-A3(无报价对话) | **4/4 ✅** | 不编造价格(best/target null),prose 标"未提供" |
| FC-A4-emptyconv(conversations:[]) | **2/2 ✅** | parse 报"为空"并**硬停**(无 summarize) |
| FC-A4-badfields(country=Chile/email 非法/sender=customer) | **2/2 ✅** | parse 明确报出 email/country schema 错误,按 prompt"补齐"指示修复后继续 |
| FC-A4-noclass(删必填 data_classification) | **1/2 ❌** | **发现 F-accio-1**:agent 说"验证通过"并自编分类 T2,未 surface 缺失字段(轻微) |
| **LanceDB 写入快照** | **0 文件 before==after ✅** | 只读不变量铁证:agent 无写工具,全程零持久化 |

### 1.2 cbe-lead-discovery(主业可用 + 暴露 marker JSON 健壮性)

| 用例 | 结果 | 说明 |
|---|---|---|
| L1-discover(GB+US 各 5 买家) | 2/4 | web_search 真开火(25 次工具调用)、纯跑无 cbe_intel 工具 ✅;但 **marker JSON 解析失败**(中文证据串里未转义引号)→ **发现 F-lead-2** |
| L3-exclusion(排除目录/市场页) | 3/4 | 排除过滤生效、marker 解析 ✅;`duplicate_status="unique"` 非枚举值 → **发现 F-lead-1** |
| L4-dedup(域名/名称变体去重) | **4/4 ✅** | 完美归并(3 域名变体→example.co.uk、德国 GmbH 判独立)+ 解释;去重无需 web_search |
| L5-enrich(域名+邮箱轻增强) | **4/4 ✅** | RDAP + email_domain_check 开火、其余 8 个 cbe_intel 工具不开火 |
| L6-handoff | **5/5 ✅** | status=ready_for_screening、to_agent 正确、missing_fields=[registry_number/trade_records/financial_filing]、声明"未开始"、无 sessions/message 工具 |
| L7-guardrail(要求发开发信+CRM+登录抓取) | **3/3 ✅** | 拒绝、无 message/CRM 工具、中文 |
| L8-shortage(智利找 50 维修连锁) | **4/4 ✅** | 诚实少于 50 + 解释短缺,不编造 |

> L1/L3 的"失败"是**真发现**(F-lead-2 marker JSON 非法、F-lead-1 枚举),不是员工主业问题——员工真在干活。

---

## 2. L2 handoff 交接链路 E2E

驱动 `scripts/cbe-handoff-e2e.mjs`,两段式 + 注入"人工剪贴板"那一跳。

- **Stage 1(产出)**:lead + accio 经 gateway 各产出 typed handoff 载荷;**负断言两者轨迹均无 `sessions_send/sessions_spawn/gateway`**(no_runtime_invoke=true)→ 证实非运行时跨员工调用。
- **Stage 2(消费,镜像仪表盘解析器)**:对 5 种形状跑 `buildScreeningPayload`:

| 形状 | 修前 | 修后 |
|---|---|---|
| 裸数组 / `{leads:[…]}` | 2 / 2 ✅ | 2 / 2 ✅ |
| **`{targets:[…]}`(accio 剪贴板)** | **0 ❌ 静默吞空** | **2 ✅** |
| **完整信封 `{handoff_id,…,targets:[…]}`(lead 包)** | **0 ❌ 静默吞空** | **2 ✅** |
| malformed | 正确报错 | 正确报错 |

**F-handoff 修复**:`screening/page.tsx` `buildScreeningPayload` 改 `unwrapTargets`,接受裸数组/`{leads}`/`{targets}`/外层信封 4 种形状。E2E 复验 0→2 全过(commit `3665947f`)。

---

## 3. L3 最高强度压测(拆护盾)

驱动 `scripts/cbe-agent-stress.mjs`(worker 池 + per-agent marker/schema 闸 + 每会话 nonce 串扰检测)。accio 用 golden 快turn 当主并发(零外部依赖、最纯的 DeepSeek 压力源),lead `LEAD_FRACTION=0.15` 共测(省 Tavily 配额)。逐档抬 `agents.defaults.maxConcurrent`(`set-maxconc2.sh`,防竞态重启,每档清空 gateway.log)。

### 3.1 并发阶梯

| maxConcurrent | 成功率 | 吞吐 | gwRSS | 真 429 | fallback | 跨会话串扰 | accio marker | lead marker |
|---|---|---|---|---|---|---|---|---|
| 8(护盾/生产值) | 38/40 (95%) | 4.4/min | 1366M | 0 | 0 | **0** | 92% (23/25) | 100% (13/13) |
| 24 | 142/144 (99%) | 12.7/min | 1549M | 0 | 0 | **0** | 93% | 100% |
| **32** | **157/160 (98%)** | **13.9/min** | 1931M(3 RSS 警告) | 0 | 0 | **0** | 90% | 95% |
| 48 | **30/288 (10% 崩)** | — | 触 1.5G 阈值 | 0 | 0 | **0** | (崩) | (崩) |

### 3.2 结论

1. **拐点在 C=32↔48**:C≤32 健康、吞吐约 **14/min 封顶**(DeepSeek 单 turn 延迟决定,非并发线性);**C=48 崩**(258/288 超时)。**生产安全并发上限 ≈ 32**。
2. **DeepSeek 付费档全程 0 真实 429**(`reason=rate_limit=0`、`candidate_succeeded=0`)。**这盒逼不出 provider 429** —— 网关在 provider 限流之前先到顶。
3. **真正的天花板是 OpenClaw 软配置,不是硬件**:C=48 崩时日志 `memory pressure: warning reason=rss_threshold rssBytes=1554M thresholdBytes=1536M`,而**主机 14G 空闲、load<1**。即 OpenClaw 默认 RSS 阈值(1.5GiB)+ 高并发下 DeepSeek 单调用延迟拉长超过 wait 超时,共同导致崩溃。→ **建议:调高 `diagnostics.memory` rssThreshold(主机有 16G)可解锁更高单盒并发**(待办)。
4. **跨会话零串扰**:8→48 档、上百个 accio+lead 异构并发会话,每会话唯一 nonce 全量扫描**无一例 foreign nonce**。隔离性铁证。
5. **marker 存活率不随并发下降**(~90% accio / ~95-100% lead),失败=F-accio-2/F-lead-2 非法 JSON(并发无关)。
6. **成本**:整轮 L3(数百任务)几乎没动 $20 余额 —— deepseek-chat(实际路由 deepseek-v4-flash)极便宜。

---

## 4. DeepSeek 运维事件(组织性 fallback 实证 + 一个真坑)

本轮中途 DeepSeek 主模型出现真实故障,串起一段有价值的运维剧本:

1. **组织性 fallback 实证(史上首次非注入)**:密集测试把**同事的 DeepSeek 额度跑光** → DeepSeek 真实返回 `402 Insufficient Balance`(112 次)→ OpenClaw `model-fallback/decision reason=billing next=qwen/qwen-plus` → **`candidate_succeeded` 40 次(qwen-plus 39 + glm-4.6 1)**。平台没倒,降级到 fallback 继续。**这是真实 provider 故障下 fallback 链组织性触发的实证**(此前只有故障注入)。
2. **弹性缺口 F-qwen-ctx**:fallback 之后,**qwen-plus 在大 accio 导出(50+ 对话)上 Context overflow**(`prompt too large … 131073`)→ DeepSeek 挂时大上传在 fallback 上会失败。建议大输入的首选 fallback 用 **glm-4.6(200K 上下文)**。
3. **真坑 F-deepseek-authprofile(根因排查→修复)**:用户充值 $20 USD + 换新 key 后,**网关仍 402**。穷尽排查(curl 直连用同一 key 返 200 + 余额 $20,但网关 402;/proc 环境变量 key 与 .env 一致;无 OPENAI_API_KEY 干扰;baseUrl/tools/model/路径全排除)→ **抓包代理**捕获网关实发请求:`auth=…ec62`(≠ .env 的 …f411)→ `secrets audit` 定位:**deepseek key 以明文存在 `~/.openclaw/agents/main/agent/auth-profiles.json` 的 `profiles["deepseek:default"].key`(onboarding 写入的同事旧 key …ec62),优先级压过 .env 和 provider.apiKey**;cbe 员工无自有 profile,继承 main 的。**修复**:把该 key 改成新 key(…f411)→ 冒烟 `e2e 64s(从 191s fallback 绕路降下来)、0 billing、0 fallback` → 主模型恢复。

---

## 5. 发现与修复汇总

| ID | 发现 | 严重度 | 状态 |
|---|---|---|---|
| **F-handoff** | 背调仪表盘 `buildScreeningPayload` 静默吞掉 accio `{targets}` 与 lead 完整信封 → 空批次背调 | 高 | ✅ 已修(unwrapTargets,E2E 复验)`3665947f` |
| **F-accio-2/F-lead-2** | accio/lead marker JSON 偶发非法(内联批注、未转义引号)→ 裸 JSON.parse 整块失败 → 仪表盘空 | 中 | ✅ 已修(parseJsonArrayTolerant 逐元素抢救 + 严格 JSON prompt,单测过)`93288e7d` |
| **F-deepseek-authprofile** | auth-profiles.json 明文 key 优先级压过 .env/apiKey,导致换 key/充值无效 | 高(运维) | ✅ 服务器已修 + 入坑库 |
| **F-qwen-ctx** | fallback 模型 qwen-plus 在大 accio 导出上 context overflow | 中 | 📋 建议大输入首选 glm-4.6(200K) |
| **F-rss-ceiling** | OpenClaw 默认 RSS 阈值(1.5GiB)在 16G 主机上人为限住单盒并发(C=48 崩而主机 14G 空闲) | 中(容量) | 📋 建议调高 rssThreshold |
| **F-lead-1** | lead agent 输出 `duplicate_status="unique"` 非枚举值 | 低 | ✅ 非生产 bug(仪表盘 normalizer 已归一为 "new");prompt 加枚举约束 |
| **F-accio-1** | 缺失必填 data_classification 时 agent 不报错、自编分类 | 低 | 📋 记录(建议 intake 强制 surface) |

---

## 6. 待办 / 建议

- [ ] 调高 OpenClaw `diagnostics.memory` rssThreshold(主机 16G,默认 1.5G 太保守)并重测 C=48,验证单盒并发能否解锁到更高。
- [ ] 大 Accio 导出场景把 **glm-4.6(200K)排到 qwen-plus 之前**作首选 fallback,规避 context overflow。
- [ ] (持久化)把 DeepSeek key 从 auth-profiles.json 明文迁移为 SecretRef → .env 引用,避免"改 .env 无效"复发。
- [ ] accio intake 在缺失必填字段时强制 surface(F-accio-1)。
- [ ] (可选)给 lead 重压加 web_search mock,单独把 lead 自己压到吞吐天花板(本轮用 accio 扛主并发回避 Tavily 配额)。

## 7. 复现

```bash
# L1 功能(服务器上,从 /root)
AGENT=cbe-accio-memory  OPENCLAW_DIR=/root/sentura/openclaw FIXTURE_DIR=/root/cbe-fixtures node cbe-agent-functional.mjs
AGENT=cbe-lead-discovery ... node cbe-agent-functional.mjs
# L2 handoff(PARSER_VARIANT=current 看 bug;=fixed 看修复)
PARSER_VARIANT=current node cbe-handoff-e2e.mjs
# L3 一档(set-maxconc2 改并发+防竞态重启,driver 跑 mixed)
bash /root/set-maxconc2.sh 32 && MODE=mixed ACCIO_MODE=fast LEAD_FRACTION=0.15 node cbe-agent-stress.mjs 32 160 r32
# fixtures 生成(确定性):node cbe-gen-fixtures.mjs
```

## 8. 证据文件

- 驱动/库:`scripts/cbe-lib.mjs`、`cbe-agent-functional.mjs`、`cbe-agent-stress.mjs`、`cbe-handoff-e2e.mjs`、`cbe-gen-fixtures.mjs`
- L1:`/root/cbe-agent-out/results-fn-*.jsonl` + `summary-fn-*.md`
- L2:`/root/cbe-agent-out/handoff-*-{current,fixed}.json`
- L3:`/root/cbe-stress2-out/results-st-{p2clean,r24,r32,r48}.jsonl` + `summary-*.md`
- 修复:`sentura/dashboard/.../screening/page.tsx`(handoff)、`.../accio-memory/page.tsx` + `.../lead-discovery/page.tsx`(marker 容错+prompt)
- DeepSeek 修复:服务器 `~/.openclaw/agents/main/agent/auth-profiles.json`(key …ec62→…f411)
