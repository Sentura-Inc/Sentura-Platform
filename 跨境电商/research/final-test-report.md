# 跨境电商 AI 员工 — 10 项/任务 最终压测报告

> 独立最终测试文档。涵盖测试目的、方法(含提示词全文与设计理由)、Phase A/B 全部实测数据、完整性对比与结论。所有数字均来自磁盘会话轨迹(`<sessionId>.jsonl` 逐工具时间戳)、`sessions.json` token/成本字段、`gateway.log`,**非模型自述/估算**。

**日期**:2026-06-20 · **环境**:阿里云 ECS 47.96.40.237(4C/16G,Ubuntu 24.04)· OpenClaw 2026.6.2 · 主模型 DeepSeek(fallback qwen-plus / glm-4.6)· cross-border-intel MCP 付费源全开(`CBE_ENABLE_PAID_TRADE_DATA=true`/`$1`)
**驱动**:[`scripts/cbe-batch10.mjs`](../../scripts/cbe-batch10.mjs)(复用 `cbe-lib.mjs` 握手/轨迹解析/marker 容错)

---

## 一、测试目的

回答业务问题:**"背调和获客分别要查 10 个公司/客户,耗时和压力会不会显著增加?"** 并确定每个员工"10 个"的最佳执行形态。约定:开付费路线、两员工提示词开局直接对 10、获客 10 / 背调按实测定批量。

## 二、方法

### 2.1 派任务路径
经 OpenClaw 网关生产路径 `agent`(enqueue→runId)+ `agent.wait`,sessionKey 前缀 `agent:<agentId>:`,跑后按 `sessions.json` key(小写)→sessionId→`<id>.jsonl` 回查轨迹,逐工具延迟 = toolResult.ts − 发起 assistant.ts。每会话埋唯一 NONCE 作幂等键/会话定位标记(注入提示词);**本轮驱动未做跨会话串扰检测**。

### 2.2 两种粒度
- **获客 find-10**:单会话一次找 10 个买家(NL brief → web_search → 去重 → LeadCandidate)。
- **背调**:实测三种批量(batch-3 / batch-5 / batch-10)+ 单家(1/会话),确定最佳形态。

> 以下 §2.3–§2.5 三段提示词均为 driver(`cbe-batch10.mjs`)**实际下发原文**,已隐去仅压测用的 `(压测标记 NONCE=…)` 前缀;`<…>` 为运行时占位符,`{…}` 为 driver 按 `ITEMS` 自动渲染的公司清单 / ledger 表。

### 2.3 背调单家提示词(1 家/会话,生产推荐形态)
```
你是买家背调员。operator 已授权付费(邮箱校验 + 贸易数据,预算上限 $1)。对【<国家> 公司 <名>,域名 <domain>,待验邮箱 <email>】做一次完整买家背调:
① UK→Companies House 查注册信息 / US→SEC 查公开披露摘要(只读 entity_name/cik/sic,丢弃 submissions 大块);
② RDAP 查域名注册;③ 检查域名 MX/SPF/DMARC;
④ email_domain_check 校验邮箱(enable_paid_validation=true,1 次);
⑤ cbe_intel_trade_record_search 查海关贸易记录(source='importyeti',max_records=5,max_paid_spend_usd=1,1 次);
⑥ web_search 补公开口碑(非 web_fetch wikipedia,失败不重试)。
基于真实证据用中文写约 100 字可信度小结 + trusted_candidate/cautious/high_risk 结论。
最后用 SCREEN_REPORTS_JSON_START / SCREEN_REPORTS_JSON_END 包 1 个对象数组(company_name、country、trust_tier、confidence、evidence_sources[]、summary)。
```

### 2.4 背调 batch-5 优化提示词(为对比/可选批量场景设计;实测见 §4.3)
针对旧 batch-5 的"上下文压缩→失忆→整批重跑→付费翻倍"病灶,设计**纯提示词**优化(零改代码):
- **逐家一条龙、禁横扫**:每回合只处理 1 家,做完写小结再下一家(避免一回合并行塞 15 个结果顶爆上下文)。
- **完成即定稿、绝不回头**:一家出小结即 final。
- **付费每家 1 次 + 内置"已完成清单(ledger)scratchpad"**:压缩失忆也以表为准,付费列 ✅ 后永久禁调。
- **SEC 放最后、只读摘要、丢 submissions**(~150KB 上下文炸弹)。
- **禁 web_fetch wikipedia**(沙箱 DNS 100% 屏蔽)。
- **工具顺序**:registry → rdap → email(付费1次)→ trade(importyeti,付费1次)→ web_search → **sec(末位摘要)** → score → emit。

**提示词全文**(N = 批量家数;driver 按 `ITEMS` 渲染下方公司清单与 ledger 表):
```
# 任务:<N> 家买家背调(逐家一条龙,严禁横扫与回头)

你是买家背调员。本次输入是 **<N> 家公司的固定清单**(operator 已逐家授权付费,每家预算上限 $1,enable_paid_validation=true、贸易数据已启用)。
{逐行列出 <N> 家:「序号. 国家 公司 <名>,域名 <域名>,待验邮箱 <邮箱>」}

## 0. 最高优先级铁律(违反即失败)
1. **逐家一条龙,绝不横扫**:做完第 1 家全部步骤、写出该家小结、再开始第 2 家。禁止"先给所有家跑 registry、再给所有家跑邮箱"这种按工具横扫。**每个回合只处理当前这一家**,不要一个回合并行塞多家工具。
2. **完成即定稿,绝不回头**:一家写出小结即 final,不得再对该家重查/重搜/重评分/重校验。
3. **每家每个付费工具最多 1 次**:email_domain_check 该家 1 次;cbe_intel_trade_record_search 该家 1 次、**source 固定 'importyeti'**、max_records=5、max_paid_spend_usd=1。调用前先查下面"已完成清单",✅ 的直接复用上次结果,**严禁二次付费调用**。
4. **SEC 只读摘要字段**:sec_lookup 只读 entity_name/cik/sic/tickers/status 判断"是否美国上市 filer";**绝不**把 submissions(整段历史申报,可达 150KB)读进推理或写进小结/marker。
5. **不要 web_fetch wikipedia.org**:沙箱 100% 屏蔽必失败;需要公开背景用 web_search 摘要,失败一次就停、不重试同一 URL。

## 1. 单家一条龙顺序(SEC 放最后,拿到即出小结、清场进下一家)
① company_registry_search(GB→Companies House,US→后续 SEC;一家只搜一次,号码可疑也不重搜)→ ② domain_rdap_lookup → ③ email_domain_check(付费,该家 1 次)→ ④ cbe_intel_trade_record_search(付费,该家 1 次,source='importyeti',max_records=5)→ ⑤(可选)web_search 补公开足迹摘要(非 web_fetch,失败不重试)→ ⑥ sec_lookup(只在此步、放最后、只读摘要、丢 submissions)→ ⑦ score_buyer → 立即 emit 该家小结并在清单打 ✅。
任一工具 api_error/超时:只标该家该项 unavailable_api,继续这家剩余步骤,**绝不重跑或拖累其它家**。

## 2. 已完成清单 scratchpad(每步对照,防压缩失忆)
每次工具调用前后先复述并更新下表(列:registry | rdap | email付费✅ | trade付费✅ | sec | 小结已emit)。若上下文被压缩、不确定做没做过,**以此表为准、不要凭感觉重跑**;付费列一旦 ✅ **永久禁止**再调对应付费工具。进度 k/<N>:
{<N> 行已完成清单表:「序号. 公司名 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐」}

## 3. 每家小结格式(逐家 flush,完成一家立刻输出一段)
[k/<N> 已完成] <company_name> — registry(注册号/状态/成立年或 unavailable_api)/ domain+email(RDAP 归属 + 校验 pass/fail,付费1次)/ trade(记录条数 + 关键贸易方,付费1次或 unavailable_api)/ sec(是否美国 filer:entity_name/cik/sic,否则 not_a_filer)/ risk_tier / normalized_score / evidence_coverage / recommended_action

## 4. 最终输出(全部 <N> 家做完后)
先打印批级汇总表(每家一行:company_name/risk_tier/normalized_score/evidence_coverage/recommended_action),再把 <N> 个 ScreeningReport 对象组成 JSON 数组,用 marker 严格包裹(恰好 <N> 个对象,顺序同清单,JSON 合法、无注释、无尾逗号),每个对象含 company_name、country、trust_tier、confidence、evidence_sources(数组)、summary:
SCREEN_REPORTS_JSON_START
[ {...} ]
SCREEN_REPORTS_JSON_END
```

> 设计理由:根因经 workflow 多 agent 啃真实轨迹坐实——旧 batch-5 触发多次 mid-task 上下文压缩,压缩摘要写成"付费结果尚未展示"诱导模型从头重跑,付费精确翻倍(5+5→10+10)。

### 2.5 获客 find-10 提示词(单会话找 N 个,生产推荐形态)
**提示词全文**(N = 目标买家数;driver 按 `ITEMS` 渲染,find-10 即 10):
```
你是营销获客员工。根据手机壳、钢化膜、USB-C 充电器关键词,为英国(GB)和美国(US)合计找 <N> 个潜在 B2B 下游买家(零售商/电商/手机维修连锁),排除批发商/工厂/目录站/社媒/市场页。每个买家给公司名、官网域名、为什么是合适买家、来源 URL。请用简体中文输出操作员摘要,并在最后用 LEAD_CANDIDATES_JSON_START 和 LEAD_CANDIDATES_JSON_END 标记(不要放进代码块)包一段 leads JSON 数组,每个候选含 lead_id、company_name、country、buyer_type、matched_products、source_urls、discovery_evidence、dedupe_key、duplicate_status、created_at。
```
要点:选品(手机壳/钢化膜/USB-C 充电器)+ 地域(GB/US)写死在提示词;正样本=零售商/电商/手机维修连锁,负样本=批发商/工厂/目录站/社媒/市场页;`dedupe_key`+`duplicate_status` 即报告所述"去重"机制;结构化输出走 `LEAD_CANDIDATES_JSON_*` marker。

### 2.6 marker 容错(driver 侧)
模型偶尔把结束 marker 拼错(实测 `SCREEN_REPORMS_JSON_END`≠REPORTS)。driver `looseArray()`:从 START 后找首个 `[` 的平衡闭合,END 三级兜底(精确→模糊 `*_JSON_END`→平衡括号),容忍拼错/缺失/代码围栏。

---

## 三、Phase A — 单任务标定(真实工具 + 付费)

### 3.1 获客 find-10 ✅ 一个会话搞定
| e2e | 回合 | 工具 | 产出 | token | 成本 |
|---|---|---|---|---|---|
| 107.8s~143s(~2min) | 6~9 | 31~33 | **10/10** | 24.7~27.6K | $0.009(Tavily) |

**5→10 几乎不增加**:获客攒"公司名+URL"轻文本,翻倍无压力。

> **付费澄清**:头部"付费源全开"是**授权状态**,不等于每任务都触发。获客流程**根本不调** ImportYeti/Hunter/Abstract(只用 web_search→Tavily,$0.009/任务);贸易/邮箱付费**仅背调触发**。

### 3.2 背调 batch-N 阈值扫描
| 批量 | 结果 | e2e | 回合/工具 | 产出 | 压缩迹象* | 付费(ImportYeti 计费) |
|---|---|---|---|---|---|---|
| **单家(1)** | ✅ | 49s | 6/8 | 0/1** | 0 | IY1=$0.09;H1/A1 免费档 |
| **batch-3** | ✅ 干净 | 92.8s | 5/26 | 3/3 | 0 | IY3=$0.27 |
| **batch-5(旧)\*\*\*** | ✅ 乱 | 181.9s | 12/69 | 5/5 | 4 | IY10=$0.90(2×/家) |
| **batch-5(优化)** | ✅ 慢 | 330s | 43/41 | 5/5 | 4 | IY7=$0.63(1.4×/家,仍 >理论5) |
| **batch-10** | ❌ **崩** | 81s | 7/45 | **0/10** | 9→溢出 | 白烧 H×10+A×10(IY 未触发) |

\* 压缩迹象 = 轨迹关键词计数(`compaction`/`Context for Suffix`/`prior history`),近似压缩事件次数。
\*\* 单家 run 报告**内容完整**(轨迹含 6 个证据源,见 §四),但模型把结束 marker 拼成 `SCREEN_REPORMS_JSON_END`(≠REPORTS)→ driver 记 0/1;Phase B 单家 48/48 marker 正常,证明单家产出本身可靠。
\*\*\* 旧 batch-5 = 早期 fulltool-stress 轮的朴素"N 家一起查"提示词(无 ledger/无串行铁律),非本驱动,作优化前基线引入。

**batch-10 崩溃铁证**:record status=`agent_error`、会话级 status=`failed`、轨迹 808KB、`errorMessage:"Context overflow: estimated context size exceeds safe threshold during tool loop"` + DeepSeek **413 Payload Too Large**。根因:背调每家拉重型工具结果(SEC 单家 ~32KB),单家 ~15K tok、10 家外推 ~150K → 爆 DeepSeek 上下文。

## 四、完整性对比(背调,这是选粒度的决定因素)

实测每家报告厚度(从 marker JSON 数):

| 形态 | 压缩迹象 | 每家证据源 | 每家小结字数 | 裁决 |
|---|---|---|---|---|
| **单家(1/会话)** | **0** | **6 个**(富)† | ~100 字 | ✅ **完整性最佳** |
| batch-3 | 0 | **7 个** | 85-120 字 | ✅ 高 |
| 优化 batch-5 | 4 | 5 个 | 55-77 字 | ⚠️ 变薄 |
| batch-10 | 9→溢出 | — | — | ❌ 0 产出 |

† 单家证据源取自该 run **轨迹正文**(6 源:Companies House/RDAP/Abstract/Hunter/ImportYeti/DNS);该 run marker 拼错致 driver 记 0/1,但内容完整;单家产出可靠性另由 Phase B 单家 48/48 marker 正常佐证。

**结论:批量越大、压缩越多、报告越薄。** 优化提示词把成本从 2× 压到 1.4×(付费 10→7 次)、工具 69→41,但**没根治完整性**:逐家串行把回合从 12 拉到 43、e2e 182s→330s,**压缩迹象仍 4 次未减**,早完成家的工具证据被压缩丢弃 → 证据源 5 < 单家/batch-3 的 6/7。ledger 只保住"付费不重复调用",保不住"已被丢弃的证据厚度"——这是纯提示词的天花板。背调"10 个"的正解是 **1 家/会话 fan-out**(零压缩、报告最厚、错误隔离),覆盖 10 家 = 10 个并发单家任务。

## 五、Phase B — 并发阶梯(重会话压力,maxConcurrent=40)

**全程 0 rss_threshold 告警,104/104 会话任务全成功**(获客 8+16+32 + 背调 16+32 = 104)。

| 负载 | 并发 C | 成功 | 吞吐 | e2e mean/p50/p90/max | token max | 付费 | marker |
|---|---|---|---|---|---|---|---|
| 获客 find-10 | 8 | 8/8 | 14.5 项/min | 157/171/331/331s | 59K | — | 8/8 |
| 获客 find-10 | 16 | 16/16 | 32.3 项/min | 117/131/168/241s | 50K | — | 13/16 |
| 获客 find-10 | **32** | 32/32 | **63.5 项/min** | 130/130/192/281s | 54K | — | 30/32 |
| 背调单家 | 16 | 16/16 | 10.5/min | 69/71/87/91s | 31K | IY16 $1.44 | 16/16 |
| 背调单家 | **32** | 32/32 | 13.7/min | 89/91/116/139s | 32K | IY33 $2.97 | 32/32 |

**结论**:
1. **并发容量没有显著下降**——10-项重会话(~25K)到 **C=32 两员工全 0 rss_threshold、104/104 会话成功**;重会话没把单盒安全并发压到 32 以下。**本轮最高 C=32、未推到崩**(maxConcurrent=40 上限),精确拐点需再跑 C=40/48。
2. **获客 find-10 吞吐近线性**:14.5→32.3→63.5 项/min(C 翻倍吞吐翻倍)。
3. **背调单家 ~13.7/min 封顶**(DeepSeek 单 turn 延迟),p50 71→91s(排队);付费基本 1×/家(C=32 共 33 次 IY,仅 1 个会话偶发二调)。
4. **产出抖动(高并发)**:会话级 100% 成功,但**获客 items_produced 在高并发下抖动**——C=16 有 3 个会话产出 0 个 lead、C=32 有 2 个 0 产出(其余多为 10);背调单家恒定 1/1。即"成功"指会话跑完,不等于每会话都满额产出。
5. marker 存活:背调单家 100%(16/16、32/32);获客高并发偶有 JSON 瑕疵(13/16、30/32),driver `looseArray` + 仪表盘 `parseJsonArrayTolerant` 双层容错兜底。

## 六、总结论(人话)

| 问题 | 答案 |
|---|---|
| 获客 10 vs 5 | **几乎不增加**,一个会话 ~2min 出 10 个;并发到 C=32 线性扩到 **63.5 个/min** |
| 背调 10 能不能一个会话 | **不能**,batch-10 必上下文溢出崩(0 产出还白烧付费);安全 batch≤5 |
| 背调 10 的正解 | **1 家/会话 fan-out**(完整性最佳:6 证据源、0 压缩、~49s/家),10 家 = 10 个并发单家任务 |
| 10-项会不会增加并发压力 | **不会显著增加**——C=32 重会话 0 rss_threshold、104/104 会话成功,容量不降(本轮未推到崩) |
| 成本 | 背调 ~$0.09/家(**ImportYeti 1 次=唯一美元计费**;Hunter/Abstract 各 1 次走免费档)· 获客 ~$0.01/任务(Tavily,**不烧 IY/H/A**) |
| batch 优化提示词有没有用 | 把成本 2×→1.4×、工具 69→41,但救不回完整性(压缩迹象仍 4 次、报告变薄、更慢 330s);**不如直接 1 家/会话** |

## 七、范围与边界

- 本测在**单盒大陆 + DeepSeek** 下;并发拐点 >32 但**未推到崩**(maxConcurrent=40 上限,本轮最高 C=32);要精确知重会话 knee 需再跑 C=40/48。
- 背调 1 家/会话本轮压到 C=32 仍 0 rss_threshold、32/32 成功(~32 健康);"N 个操作员同时各 fan-out 10 家"的极端叠加未单独压。
- 优化 batch-5 的"变薄"含一部分提示词格式偏紧凑的成分,但"压缩 4 次 + 慢"是实打实。
