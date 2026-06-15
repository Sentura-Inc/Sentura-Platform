> **On-demand reference — not read by default.**
>
> Back-link: [`docs/MEMORY.md`](../../docs/MEMORY.md)

# Cross-Border E-Commerce — 压测前地毯审计 (Pre-Load-Test Audit)

2026-06-13。压测前对已部署系统(阿里云 ECS 4C16G,见 [`mainland-cloud-deployment.md`](mainland-cloud-deployment.md))做 8 维度对抗式多智能体审计(17 agents / 2.35M tokens / 24min)。结论 **GO_WITH_FIXES**:确认 43 条真实问题(4 P0 / 9 P1 / 12 P2)。**不能直接压测** —— 4 个 P0 会让数据无效或页面崩。全部带 file:line 证据并经对抗式验证。原始完整结果(含每条 verdict)曾在任务输出 `w3zkwnktv.output`(transient)。

## 4 个 P0(压测前必修)

### P0-1 全局 Main lane 硬顶 4 并发 —— 压测测的是假天花板,不是机器
- `server-lanes.ts:12` 把 `CommandLane.Main` 并发设为 `resolveAgentMaxConcurrent(cfg)`=`DEFAULT_AGENT_MAX_CONCURRENT=4`(`agent-limits.ts:3`),因为 setup 从没写 `agents.defaults.maxConcurrent`。Main 是**进程级单一 lane**,每个 agent 的 LLM/工具回合都嵌在 `enqueueGlobal→Main`(`run.ts:474/489/534`),pump 最多跑 `maxConcurrent` 个(`command-queue.ts:340`)。
- **后果**:无论驱动 10/20/30 个会话,全平台最多 4 个 agent 回合在跑。吞吐/延迟曲线是这个上限的人为产物,不是 4C16G 的真实容量。**这是压测数据无效的头号原因。**
- **修**:显式设 `agents.defaults.maxConcurrent`(4C16G 起步 8,逐档 4/8/12/16 找拐点),服务器 openclaw.json + `sentura-setup.{sh,ps1}` 都写(否则重跑回退)。必须配合 P0-2 否则只是放大 429。

### P0-2 一次 DeepSeek 429 冻结所有 agent 30 分钟(无 fallback 链)—— 压测压力自己把平台冻死
- 429(rate_limit)时 `run.ts:2454-2462` `suspendSession(laneId=globalLane=Main)` → `session-suspension.ts:135` `setCommandLaneConcurrency('main',0)`,30 分钟后才恢复(`DEFAULT_QUOTA_SUSPENSION_RESUME_MS`)。Main 非 probe lane,minConcurrent=0 合法(`command-queue.ts:414-416`),pump 啥都不出队。
- **没有 fallback 链**:fallback 只来自 `agents.defaults.model.fallbacks`(`model-fallback.ts`),但 setup 只写了 `agents.defaults.models` 注册表(qwen/kimi)——**那不是 fallback 源**;部署模型是裸字符串 `deepseek/deepseek-chat`。所以压测制造的 429 会让全平台黑屏 30 分钟。
- **修**:配真 fallback 链 `agents.defaults.model = { primary:'deepseek/deepseek-chat', fallbacks:['qwen/qwen3.5-plus','moonshot/kimi-k2.6'] }`(服务器 openclaw.json + setup + 每个 cbe config.json5;**per-agent `models:` map 不是 fallback 源**)。429 时切 provider 而非挂起。

### P0-3 cbe 工具策略源码用 profile:minimal + allow —— 解析后零工具;重跑 setup 会把活的员工打回零工具
- minimal profile 是**先执行的交集滤网**(`tool-policy-pipeline.ts:189`),`listCoreToolIdsForProfile('minimal')` 实际只含 `session_status`(`tool-catalog.ts:197/350-358);web_search/web_fetch/cron/memory_* 都是 `profiles:['coding']`,MCP 工具根本非 core。profile 第一道就把工具滤光,后面的 `allow` 交集只能更窄、加不回来。cbe 的 deny 又把 session_status 删了 → **净零可用工具**。
- 源码 `cbe-*/config.json5:34-50` 和 `sentura-setup.sh:586-588` 都用 `allow`;meta-agent 却正确用 `alsoAllow`(`agent-tools.ts:618` `mergeAlsoAllowPolicy` 在滤网前并入 profile)——证明作者知道区别、cbe 被漏了。**活服务器能跑全靠手改 openclaw.json**;setup 的 `Object.assign`(:591-593)无条件覆盖,任何 setup 重跑/换模型都静默把三个员工设成零工具,任务返回空却看起来成功 → 压测数据无效。
- **修**:三个 `cbe-*/config.json5` + `sentura-setup.{sh,ps1}`(agent 层)的 `tools.allow → tools.alsoAllow`。然后**冻结 setup**(压测窗口别对生产重跑),或先落地 alsoAllow 修复并经 dashboard chat.send 路径(非 CLI)复核每个员工真能解析出 web_search/cross-border-intel__*/memory_*。加 setup 自检:断言每个 cbe 能解析 cross-border-intel__*,否则非零退出。

### P0-4 Accio 结果页对空 purchase_intent[0] 无守卫 → 白屏,且把坏数据写进 localStorage
- `accio-memory/page.tsx:816` `const intent = summary.purchase_intent[0]` 然后 :831-832 无条件读 `intent.product`/`intent.models.join`。空数组 → `intent=undefined` → React render 期 TypeError(在 try 块外)→ 整页白屏。summaries 无条件写 localStorage(~527)、加载时重归一化(506)仍空 → **崩溃跨刷新持久,不清 storage 没法重启**。DeepSeek 对 schema `array().min(1)` 遵守弱(dashboard 没复用 schemas.ts),并发下空数组很可能出现 → 系统性少计 accio 成功。
- **修**::816 加 `if (!intent) return null` 或占位行;更好在 `normalizeSummary:300` 给空数组注入占位元素,并在写 localStorage 前 sanitize。理想 safeParse schemas.ts。

## 9 个 P1(压测前或上线前)

1. **静态测试只字符串匹配 config,对 allow-vs-alsoAllow 失明**(`test-cross-border-agents.ts:167` `config.includes(...)`,从不调真实 resolver)——假绿,正是它掩盖了 P0-3。加一个真 resolver 解析测试,断言 minimal profile + 策略下解析出的工具集**包含** web_search/cross-border-intel__*(当前 allow 配置应 FAIL,alsoAllow 后 PASS)。
2. **dashboard→gateway→agent→DeepSeek 标记解析全链路零运行时/E2E 覆盖**,压测是首次无基线执行。压测前加:解析函数单测(```json 围栏、噪声、截断、对象 vs 数组形状)+ 每员工一次真实 gateway smoke 断言成对标记 + JSON.parse 成功。
3. **DeepSeek 标记+JSON 输出契约从未验证,解析器是脆弱文本切片**(`page:316-329/437-450` indexOf+JSON.parse 无 try/catch,`Array.isArray()` 对象包裹时返回 [])。加围栏剥离、容忍对象/数组、区分解析失败 vs 空;压测前测 20-50 次固定运行的标记遵守率(≥95% 阈值),记入测试文档。
4. **Docker 容器无 memory/cpu/pids/nofile 上限**(`docker.ts:513-528` 只在 >0 时发 `--memory` 等;三个 cbe 只声明 `sandbox:{mode:'non-main'}`)。scope=agent → 3 cbe = 3 共享容器。deny 已挡 exec/process/browser 故 fork 炸弹不太可能,但设廉价上限:每 cbe `memory:'2g'/memorySwap:'2g'/cpus:1.0/pidsLimit:256/nofile:'4096:8192'`(3×2g 留 ~10g 给宿主 gateway)。
5. **付费预算闸门只 per-call,ImportYeti 用 budget>0 不对称绕过**(`tools.ts:667-668/674/705`)。N 并发各花到上限。压测保持 `enablePaidTradeData=false` 让付费路径休眠。加进程级 spentUsd 累加器。
6. **cross-border-intel adapter key 只在存在时接线,缺失源静默返回空、掏空背调结果**(`sentura-setup.sh:407` `if hasSetupEnv`)。压测前 dump 有效 env,记录哪些 adapter LIVE vs DEGRADED,别把空管道延迟当全管道性能。
7. **国产模型配置未 commit,fresh clone/重部署回退到 openai/gpt-5.5(大陆不可达)**(`sentura-setup.sh:345/349` 默认 preferredModel='openai/gpt-5.5')。活服务器已跑 deepseek,本次压测不受影响;连同 alsoAllow 修复一起 commit + 服务器 .env 设 `SENTURA_CBE_AGENT_MODEL=deepseek/deepseek-chat`。
8. **gateway loopback 信任假设(allowInsecureAuth=true, ownerAllowFrom=['*'], exec.host=gateway)一旦端口暴露=完全接管**。loopback 上没事;若开共享/演示绑定:allowInsecureAuth=false + Control UI 认证 + allowedOrigins,['*'] 换显式 operator id,exec.host 换 'sandbox'。
9. **跨境 /run 路由用共享 key 花真钱,无认证/限速/累计预算**(`lead.../run/route.ts:569` 每请求最多 24 次 Tavily;screening 每目标付费调用)。压测**走 dashboard chat.send/gateway 生产路径,不要驱动这些诊断 /run 路由**(它们 off-path、无认证、花真钱)。

## 12 个 P2(改进项,摘要)
MCP 超时(AbortError)冒泡成 isError 而非 coverage-gap 信封;非 2xx/200-不可解析体被当 found-zero;SEC company_tickers.json 每次全量拉(~1MB)无缓存且 host 硬编码;official_contact_email_search 串行最坏 8×30s 占 sandbox 槽;数值 env 无上界(过大 timeout 等于禁用);诊断 /run 共享一个 AbortSignal.timeout;loadOpenClawEnv 在 FS 错误时缓存 {} 永不失效;score_blocks.status 用 `as` 无白名单;RBAC bootstrap-escape 在 user store 空/损坏时授予 platform_admin(应 fail-closed);accio currency 硬编码 USD + 联系人类型静默改写;dashboard 手写 interface 与 MCP zod schema 漂移无单一真相源;accio sample 路由所有错误类都返回不透明 500。

## 压测方案(综合 load-readiness 维度)
- **走 dashboard chat.send/gateway 生产路径**,不走 Next.js /run 诊断路由。
- **飞行前闸门(全过才加载)**:① 落地 4 个 P0,经 dashboard 复核每员工解析出真实工具集 + 单条消息返回成对标记 + 可 JSON.parse(零工具/不可解析 = STOP);② 冻结 setup(压测窗口不重跑,会 Object.assign 覆盖回坏的 allow);③ 显式配置 maxConcurrent(起 8)+ fallback 链 + 每 cbe sandbox.docker 资源上限 + `CBE_INTEL_REQUEST_TIMEOUT_MS=30000` + `enablePaidTradeData=false`;④ 记录 cross-border-intel adapter LIVE vs DEGRADED + 从 ECS 做出站可达性 smoke(大陆出口噪声别当应用失败);⑤ 压测前测标记遵守率基线(每员工 20-50 次,≥95%)。
- **分档爬坡**(别直接上高并发):Rung0 校准(单会话×10,基线 p50/p95/token/RSS)→ Rung1 maxConcurrent=4 驱动 6-8 会话(确认排队非丢弃)→ Rung2 =8 驱动 12-16 → Rung3 =12 驱动 18-24 → Rung4(可选)=16 驱动 24-32。每档稳态 ~10min 再升,首个拐点(p95 拐点/队列持续增长/429 出现)停。
- **每档监控**:宿主(free RAM,gateway RSS+3 容器逼近 14G 告警;CPU load vs 4 核;swap);Docker(容器数应=3;per-container mem/cpu vs 2g/1cpu 上限;dmesg OOM-kill);lane/队列(Main lane active vs queued + 等待时长——active 卡在 maxConcurrent 而队列涨=并发瓶颈非 CPU);**DeepSeek 429 率 + 是否触发 Main lane 挂起(任何 30min 冻结=中止该档先修 fallback);fallback 切换事件(deepseek→qwen→kimi)是健康替代**;质量(标记遵守率、JSON.parse 成功率、工具调用成功 vs 空结果、accio 渲染错误、MCP isError 率);成本(per-task + 累计 token/USD,确认付费数据 $0)。
- **预期瓶颈顺序**:① Main lane 并发上限(放开前吞吐恒为 4)→ ② DeepSeek 429/限速(放开后的真天花板,无 fallback 一次 429 自挂 30min)→ ③ 宿主 gateway 内存(N 个并发 embedded 回合的 transcript/context 在**容器外**,docker 上限管不到,看 gateway RSS)→ ④ 慢 MCP/web_fetch 占 sandbox 槽 → ⑤ memory 降级(memory-core 无 embedding,memory_search 返回空,标记为降级别误读为失败)。

## P0 + P1-4 修复已落地(2026-06-13)

四个 P0 + sandbox 资源上限(P1-4)已修复,源码 + 服务器运行时双落地:

- **P0-1 maxConcurrent**:`agents.defaults.maxConcurrent` 显式设 8(可 `SENTURA_MAX_CONCURRENT` 覆盖)。源码 `sentura-setup.{sh,ps1}` + 服务器 openclaw.json。
- **P0-2 fallback 链**:三个 cbe 的 `model` 改为 `{primary:'deepseek/deepseek-chat', fallbacks:['qwen/qwen3.5-plus','moonshot/kimi-k2.6']}`。源码 setup(`cbeAgentModel` 变量)+ 三个 config.json5 注释说明 + 服务器 openclaw.json。429 时切 provider 而非自挂起。
- **P0-3 alsoAllow**:三个 `cbe-*/config.json5` + `sentura-setup.{sh,ps1}` 的 agent 层 + sandbox 层 `allow → alsoAllow`(源码,与服务器运行时一致)。配 `// alsoAllow (not allow)` 原因注释。**这是真正的持久化修复**——之前只在服务器运行时手改,现在源码也对了,重跑 setup 不再回退。
- **P1-4 sandbox 资源上限**:三个 cbe `sandbox.docker = { memory:'2g', memorySwap:'2g', cpus:1, pidsLimit:256, ulimits:{nofile:'4096:8192'} }`(`cbeSandboxDocker` 变量)。源码 + 服务器。3×2g 留 ~10g 给宿主 gateway。
- **P0-4 accio 渲染守卫**:`accio-memory/page.tsx:816` `summary.purchase_intent?.[0]` + 所有 intent 字段可选链 + `next_actions?.[0]`。空数组渲染占位「未提取到采购意向」而非白屏。源码 + scp 到服务器(dashboard 热重载)。
- **测试**:`scripts/test-cross-border-agents.ts` 更新——非 main sandbox 断言改匹配多行结构、+3 docker 上限断言、+3 alsoAllow 防回退断言。**302/302 通过**。P1-1 的真 resolver 测试仍待补(廉价 alsoAllow 字符串守卫已加)。
- **验证**:gateway 带新配置重启 `LISTENING_after_1`;冒烟 DeepSeek 回「部署成功」(工具解析 + 模型驱动完好);容器资源上限待 docker inspect 确认。

**仍未做(压测前 P1 剩余 / 后续)**:P1-1 真 resolver 测试、P1-2/3 标记解析 E2E + 遵守率基线、P1-6 adapter LIVE/DEGRADED 记录、P1-8/9 安全(开公网才需要)、国产模型 11 文件 git commit、meta-agent 也加 fallback(本次只改 cbe)。

## 关键认知
- 这次审计直接**颠覆了"调大 maxConcurrent 就能压出真实容量"**的假设:不仅要调 maxConcurrent,还要先解决 429-自挂起(P0-2)和零工具回退(P0-3),否则压出来的数字要么是 4 的人为上限、要么是空结果、要么平台中途黑屏 30min。
- 又一次印证 **296 静态测试查不出运行时问题**(P1-1):静态字符串匹配对 allow-vs-alsoAllow 失明,正是它让 alsoAllow bug 漏到生产。
