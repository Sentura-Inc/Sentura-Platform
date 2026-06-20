# 跨境电商 AI 员工 — 10 项/任务 最终压测报告

> 独立最终测试文档。涵盖测试目的、方法(含提示词全文与设计理由)、Phase A/B 全部实测数据、完整性对比与结论。所有数字均来自磁盘会话轨迹(`<sessionId>.jsonl` 逐工具时间戳)、`sessions.json` token/成本字段、`gateway.log`,**非模型自述/估算**。

**日期**:2026-06-20 · **环境**:阿里云 ECS 47.96.40.237(4C/16G,Ubuntu 24.04)· OpenClaw 2026.6.2 · 主模型 DeepSeek(fallback qwen-plus / glm-4.6)· cross-border-intel MCP 付费源全开(`CBE_ENABLE_PAID_TRADE_DATA=true`/`$1`)
**驱动**:[`scripts/cbe-batch10.mjs`](../../scripts/cbe-batch10.mjs)(复用 `cbe-lib.mjs` 握手/轨迹解析/marker 容错)

---

## 一、测试目的

回答业务问题:**"背调和获客分别要查 10 个公司/客户,耗时和压力会不会显著增加?"** 并确定每个员工"10 个"的最佳执行形态。约定:开付费路线、两员工提示词开局直接对 10、获客 10 / 背调按实测定批量。

## 二、方法

### 2.1 派任务路径
经 OpenClaw 网关生产路径 `agent`(enqueue→runId)+ `agent.wait`,sessionKey 前缀 `agent:<agentId>:`,跑后按 `sessions.json` key(小写)→sessionId→`<id>.jsonl` 回查轨迹,逐工具延迟 = toolResult.ts − 发起 assistant.ts。每会话埋唯一 NONCE 检测跨会话串扰。

### 2.2 两种粒度
- **获客 find-10**:单会话一次找 10 个买家(NL brief → web_search → 去重 → LeadCandidate)。
- **背调**:实测三种批量(batch-3 / batch-5 / batch-10)+ 单家(1/会话),确定最佳形态。

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

> 设计理由:根因经 workflow 多 agent 啃真实轨迹坐实——旧 batch-5 触发 3 次 mid-task 上下文压缩,压缩摘要写成"付费结果尚未展示"诱导模型从头重跑,付费精确翻倍(5+5→10+10)。

### 2.5 marker 容错(driver 侧)
模型偶尔把结束 marker 拼错(实测 `SCREEN_REPORMS_JSON_END`≠REPORTS)。driver `looseArray()`:从 START 后找首个 `[` 的平衡闭合,END 三级兜底(精确→模糊 `*_JSON_END`→平衡括号),容忍拼错/缺失/代码围栏。

---

## 三、Phase A — 单任务标定(真实工具 + 付费)

### 3.1 获客 find-10 ✅ 一个会话搞定
| e2e | 回合 | 工具 | 产出 | token | 成本 |
|---|---|---|---|---|---|
| 107.8s~143s(~2min) | 6~9 | 31~33 | **10/10** | 24.7~27.6K | $0.009(Tavily) |

**5→10 几乎不增加**:获客攒"公司名+URL"轻文本,翻倍无压力。

### 3.2 背调 batch-N 阈值扫描
| 批量 | 结果 | e2e | 回合/工具 | 产出 | 压缩 | 付费 |
|---|---|---|---|---|---|---|
| **单家(1)** | ✅ | 49s | 6/8 | 1/1 | 0 | IY+H+A 各1 = $0.09 |
| **batch-3** | ✅ 干净 | 92.8s | 5/26 | 3/3 | 0 | IY $0.27 |
| **batch-5(旧)** | ✅ 乱 | 181.9s | 12/69 | 5/5 | 3 | 2×/家 $0.90 |
| **batch-5(优化)** | ✅ 慢 | 330s | 43/41 | 5/5 | 4 | ~1×/家 $0.63 |
| **batch-10** | ❌ **崩** | 81s failed | 7/45 | **0/10** | 溢出 | 白烧 H×10+A×10 |

**batch-10 崩溃铁证**:session `status=failed`、轨迹 808KB、`errorMessage:"Context overflow: estimated context size exceeds safe threshold during tool loop"` + DeepSeek **413 Payload Too Large**。根因:背调每家拉重型工具结果(SEC 单家 ~32KB),单家 ~15K tok、10 家外推 ~150K → 爆 DeepSeek 上下文。

## 四、完整性对比(背调,这是选粒度的决定因素)

实测每家报告厚度(从 marker JSON 数):

| 形态 | 压缩次数 | 每家证据源 | 每家小结字数 | 裁决 |
|---|---|---|---|---|
| **单家(1/会话)** | **0** | **6 个**(富) | ~100 字 | ✅ **完整性最佳** |
| batch-3 | 0 | **7 个** | 85-120 字 | ✅ 高 |
| 优化 batch-5 | 4 | 5 个 | 55-77 字 | ⚠️ 变薄 |
| batch-10 | 溢出 | — | — | ❌ 0 产出 |

**结论:批量越大、压缩越多、报告越薄。** 优化提示词修对了成本(付费 2×→1×、工具 69→41),但**串行化导致更慢(330s)且仍压缩 4 次**——**纯提示词救不回 batch-5 的完整性**。背调"10 个"的正解是 **1 家/会话 fan-out**(零压缩、报告最厚、错误隔离),覆盖 10 家 = 10 个并发单家任务。

## 五、Phase B — 并发阶梯(重会话压力,maxConcurrent=40)

**全程 0 rss_threshold 告警,96/96 任务全成功。**

| 负载 | 并发 C | 成功 | 吞吐 | e2e mean/p50/p90/max | token max | 付费 | marker |
|---|---|---|---|---|---|---|---|
| 获客 find-10 | 8 | 8/8 | 14.5 项/min | 157/171/331/331s | 59K | — | 8/8 |
| 获客 find-10 | 16 | 16/16 | 32.3 项/min | 117/131/168/241s | 50K | — | 13/16 |
| 获客 find-10 | **32** | 32/32 | **63.5 项/min** | 130/130/192/281s | 54K | — | 30/32 |
| 背调单家 | 16 | 16/16 | 10.5/min | 69/71/88/91s | 31K | IY16 $1.44 | 16/16 |
| 背调单家 | **32** | 32/32 | 13.7/min | 89/91/116/139s | 32K | IY33 $2.97 | 32/32 |

**结论**:
1. **并发容量没有显著下降**——10-项重会话(~25K)到 **C=32 两员工全 0 rss_threshold、100% 成功**;重会话没把单盒安全并发压到 32 以下,拐点仍 >32(上轮 light 负载 48 才崩,本轮未推到崩)。
2. **获客 find-10 吞吐近线性**:14.5→32.3→63.5 项/min(C 翻倍吞吐翻倍)。
3. **背调单家 ~13.7/min 封顶**(DeepSeek 单 turn 延迟,与上轮 ~14/min 一致),p50 71→91s(排队);付费精确 1×/家。
4. **跨会话**:NONCE 全扫无串扰(承接上轮结论)。
5. marker 存活:背调单家 100%(简单);获客高并发偶有 JSON 瑕疵(13/16、30/32),driver `looseArray` + 仪表盘 `parseJsonArrayTolerant` 双层容错兜底。

## 六、总结论(人话)

| 问题 | 答案 |
|---|---|
| 获客 10 vs 5 | **几乎不增加**,一个会话 ~2min 出 10 个;并发到 C=32 线性扩到 **63.5 个/min** |
| 背调 10 能不能一个会话 | **不能**,batch-10 必上下文溢出崩(0 产出还白烧付费);安全 batch≤5 |
| 背调 10 的正解 | **1 家/会话 fan-out**(完整性最佳:6 证据源、0 压缩、~49s/家),10 家 = 10 个并发单家任务 |
| 10-项会不会增加并发压力 | **不会显著增加**——C=32 重会话 0 rss_threshold、100% 成功,容量不降 |
| 成本 | 背调 ~$0.09/家(ImportYeti+Hunter+Abstract 各1)· 获客 ~$0.01/任务(Tavily) |
| batch 优化提示词有没有用 | 修对成本(付费 2×→1×、工具 69→41)但救不回完整性(仍压缩4次、报告变薄、更慢);**不如直接 1 家/会话** |

## 七、范围与边界

- 本测在**单盒大陆 + DeepSeek** 下;并发拐点 >32 但**未推到崩**(maxConcurrent=40 上限,本轮最高 C=32);要精确知重会话 knee 需再跑 C=40/48。
- 背调 1 家/会话的并发与上轮单家结论一致(~32 健康);"N 个操作员同时各 fan-out 10 家"的极端叠加未单独压。
- 优化 batch-5 的"变薄"含一部分提示词格式偏紧凑的成分,但"压缩 4 次 + 慢"是实打实。
