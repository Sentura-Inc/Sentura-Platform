> **On-demand reference — not read by default.**
>
> Back-link: [`docs/MEMORY.md`](../../docs/MEMORY.md) · 配套:[部署档案](mainland-cloud-deployment.md) · [压测前审计](pre-loadtest-audit-2026-06-13.md)

# 跨境电商 cbe 员工 — 大陆云压力测试报告(Sweep 1 + Sweep 2 + Sweep 3 + Phase 2 全工具双轨)

**日期**:2026-06-13(深夜)　**环境**:阿里云 ECS `ecs.g9i.xlarge`(4 vCPU / 16 GiB,Ubuntu 24.04,华东1 杭州),IP `47.96.40.237`
**被测对象**:三个 cbe AI 员工(`cbe-lead-discovery` 营销获客 / `cbe-buyer-screening` 筛选背调 / `cbe-accio-memory` 记忆处理),DeepSeek `deepseek-chat` 驱动,Docker non-main sandbox 隔离
**配置**:`maxConcurrent=8`(Sweep 1 全程固定)、per-cbe model fallback 链(deepseek→qwen→kimi)、容器资源上限 2GiB/1CPU/256pids、付费贸易数据关闭

---

## 一、给非技术读者的一句话结论

**单台 4 核 16G 的云服务器,扛 30 个员工"同时"发起任务毫无问题——150 个任务全部成功、零报错、零崩溃。代价是排队:排在第 30 位的人要等约 23 秒(空闲时只要 4 秒)。这台机器的吞吐上限是约 75 个任务/分钟(≈4500/小时)。真正先到顶的资源不是 CPU,而是 gateway 进程的内存。**

> **⚠️ 重要更正(Sweep 3 实测,务必看):上面这个 "75 任务/分钟" 是"纯推理"(只让员工动脑写、不查资料)的最轻负载天花板。可这三个员工真实工作就是要查境外公司注册局/域名/邮箱、网页搜买家——真实带工具负载下,吞吐只有约 10~15 任务/分钟(背调 10 / 营销获客 15)、单任务约 20~42 秒,比纯推理慢约 5~8 倍;30 人同时发真活会排队 2.5~3 分钟。真实场景的容量请以 §七 Sweep 3 为准。**

### 名词速查(都说人话)
- **并发**:同一时刻有多少个任务一起在跑(就像同时有多少人在窗口办事)。
- **吞吐**:每分钟能干完多少个任务。
- **时延 / p50 / p95**:一个任务从发出到拿到答案要等多久;p50 = 一半任务比它快,p95 = 95% 的任务比它快(剩下少数最慢的)。
- **排队**:任务多到超过服务器同时处理能力时,多出来的就排队等、先到先处理,**不丢也不崩**。
- **gateway(网关)内存**:总调度程序占用的内存——本次最先到顶的资源。
- **maxConcurrent**:我们给服务器设的"同时最多处理几个任务"的闸门值。

---

## 二、测试方法(到底怎么测的、给员工发了什么、为什么可信)

### 一句话:模拟"很多人同时让 AI 员工干活",看服务器顶不顶得住
我写了个压测脚本,扮演一大群用户,不停地给三个 AI 员工派活,让他们**真的用 DeepSeek 想一遍、写出答案**,同时另起一个监控脚本盯着服务器各项指标,看它在多少人同时用时会先卡在哪。

### 给员工发的到底是什么(实际提示词,原文照贴)
脚本轮流给三个员工各发一道**贴合他们本职工作**的题。三道题原文就是:

- **营销获客员工** `cbe-lead-discovery`:
  > 用中文写一段约120字的分析:一家做太阳能逆变器的中国出口商想开拓德国市场,列出3个最该优先接触的客户类型和理由。只输出分析正文,不要调用任何工具。
- **筛选背调员工** `cbe-buyer-screening`:
  > 用中文写一段约120字的尽调要点:评估一个声称年采购量10万台LED灯的英国买家是否可信,列出4个最关键的核验信号。只输出正文,不要调用任何工具。
- **记忆处理员工** `cbe-accio-memory`:
  > 用中文把这段对话浓缩成3条采购意向要点:客户想买工业级3D打印机,预算单台2万美元,月需求约15台,倾向FDM大尺寸机型。只输出3条要点,不要调用任何工具。

每道题都是这个员工平时真会接到的活儿,答案约 120 字;空闲不排队时,员工平均花 **3~4 秒** 用 DeepSeek 写完。

### 一个请求从头到尾发生了什么(走一遍)
1. 脚本(扮演一个用户)把上面某道题发给某个员工;
2. 服务器把这次任务排进**总处理流水线**——也就是真人在网页后台(dashboard)聊天时走的**同一条路**,不是抄近道的测试接口;
3. 轮到它时,员工带上自己的工作设定把任务发给 DeepSeek,DeepSeek 在**它自己的远端服务器**上算出约 120 字答案;
4. 答案回来,这一发记为"完成",脚本记下它花了几秒、成没成功;
5. 脚本立刻补发下一道题,**始终保持设定数量的任务"同时在跑"**(比如设 30,就永远有 30 个在并行)。

### 为什么让员工"只动脑写、不去查资料"
提示词里那句"不要调用任何工具"是**故意的**:这次不让员工去查英国公司注册局、搜买家网页。因为查外部资料每次快慢不定、还要花 API 的钱,会把测量搅浑。只让它"纯想 + 写",每一发的活儿量稳定、可复现、不花冤枉钱,才能**干净地看出服务器本身在多少人同时用时会先卡在哪**。带查资料的"重活"留到以后单独测。

### 走的是"真路",不是"测试近道"
- ✅ 走的是网页后台真人聊天的同一条流水线(技术上是 gateway 的 `agent` 入队 + `agent.wait` 等结果两步),压的是真实生产路径。
- ❌ 没走那条只给测试用、不验证身份、还会真花钱的诊断接口(`/run`)——审计明令禁止拿它压测。
- 脚本直接跑在**服务器本机**上,不让我家里的网络延迟混进测量。
- 驱动脚本:[`scripts/cbe-loadtest.mjs`](../../scripts/cbe-loadtest.mjs)。

### 怎么确认员工是真在干活、不是假跑
- 服务器留的运行记录显示每一发都走完了"收到任务 → 模型算完 → 结束"整套流程;
- 记录里写明是 **DeepSeek 真的在算**(`provider: deepseek`),还标了用字量(输入 82 字、输出 152 字);
- 压测一开始本来只有 1 个员工的隔离容器在跑,任务一来,**另外两个员工的容器立刻被拉起**——三个员工都真被调动了。

### 怎么盯服务器
另一个监控脚本 [`scripts/cbe-loadmon.sh`](../../scripts/cbe-loadmon.sh) 每隔约 3.5 秒记一次:网关程序占多少内存、机器还剩多少内存、CPU 忙不忙、几个容器各占多少资源。

---

## 三、Sweep 1 完整数据(maxConcurrent=8 固定,扫"涌入并发")

| 档 | 并发 C | 总数 N | 成功 | 错误 | p50 | p95 | max | mean | 吞吐/min | wall | gwRSS峰 | 可用内存低点 | load |
|----|--------|--------|------|------|------|------|------|------|---------|------|---------|------------|------|
| R0 | 1 | 3 | 3 | 0 | 4.0s | 4.2s | 4.2s | 3.7s | 16.3 | 11s | 527M | 12.9G | 0.1 |
| R1 | 4 | 40 | 40 | 0 | 4.1s | 6.3s | 6.3s | 4.0s | 56.7 | 42s | 988M | 11.1G | 0.28 |
| R2 | 8 | 80 | 80 | 0 | 6.1s | 7.9s | 8.4s | 6.1s | 76.0 | 63s | 1301M | 8.5G | 1.02 |
| R3 | 12 | 96 | 96 | 0 | 9.4s | 11.3s | 13.6s | 9.2s | 73.9 | 78s | 1481M | 6.0G | 1.0–1.4 |
| **R30** | **30** | **150** | **150** | **0** | **23.3s** | **26.5s** | **30.8s** | **22.4s** | **74.5** | **121s** | **1610M** | **2.1G** | **1.0** |

**合计 369 个任务,成功率 100%,0 错误 / 0 超时 / 0 丢弃 / 0 个 DeepSeek 429。**
每发 token:~82 in / 152 out / 13568 cacheRead(workspace 上下文走 prompt cache,边际成本极低)。

---

## 四、关键发现

### 1. 吞吐天花板锁死在 ~75 任务/分钟(被 maxConcurrent=8 决定)
并发从 8→12→30,吞吐纹丝不动(76→73.9→74.5)。一旦涌入并发超过 maxConcurrent,多出来的请求只增加排队、不增加吞吐。这是 8 个处理槽 × DeepSeek 每发耗时的硬乘积。

### 2. 排队是优雅的,不是雪崩
超过 8 之后,时延随涌入并发线性增长(C=1/8/12/30 → 4s/6s/9s/23s),但**全程零丢弃零报错**。请求只是 FIFO 等待,服务器稳住不崩。

### 3. maxConcurrent=8 是双重角色:吞吐闸门 + DeepSeek 429 护盾
不管前面挤 12 还是 30 个,**同一时刻只有 8 个真正打到 DeepSeek**。所以提高涌入并发永远压不出 429——这也是 Sweep 1 一个都没见到 429 的原因。要压出 DeepSeek 真天花板,必须提高 maxConcurrent(见 Sweep 2)。

### 4. 瓶颈不是 CPU、不是容器,是 gateway 内存
- **CPU**:4 核 load 全程 ~1.0,大量空闲。
- **容器**:per-容器内存全程 432KiB 纹丝不动,CPU 0%。原因——**API 模型的推理在 DeepSeek 远端算,sandbox 容器只跑 agent 编排循环 + 网络等待**。本地几乎不耗算力。
- **内存(真正在动的)**:gwRSS 从空载 447MB 一路爬到 1610MB,且**负载停止后停在 1630MB 不回落**(可用内存的回升只是 buff/cache 释放)。375 个累积会话 → `(1630−447)÷375 ≈ 3.1MB/会话` 粘在 gateway 堆里、不随负载结束释放。**这是单台 gateway 的真实天花板**,且在 docker 上限之外、宿主层不受保护。

### 5. P0/P1 修复在压力下验证有效
- maxConcurrent=8 生效(8 路真并行,math 对得上 8÷mean=吞吐),证明 P0-1 修复(原本硬顶 4)落地。
- 容器 2GiB 上限在 docker stats 可见,P1-4 生效。
- accio 空 `purchase_intent` 守卫(P0-4)未触发崩溃。

---

## 五、回扣你最初的架构问题(1 个 gateway vs N 个)

| 公司规模 | 单台 4C16G + maxConcurrent=8 够不够 | 建议 |
|---------|-----------------------------------|------|
| **30 员工** | ✅ 够。优雅排队,尾延 ~23s,吞吐 75/min | 1 个 gateway。若嫌 23s 尾延慢,Sweep 2 找到安全的更高 maxConcurrent 即可压低 |
| **300 员工** | ⚠️ 看活跃度。若同时活跃几十人,吞吐(4500/小时)和内存(~3MB/会话累积)都开始吃紧 | 提高 maxConcurrent + 会话压缩/驱逐;或开始考虑横向扩 gateway |
| **3000 员工** | ❌ 单台不够 | 必须横向扩(N 个 gateway 分租户/分部门)+ 会话生命周期管理。内存累积是硬约束 |

**核心洞见**:决定"1 个还是 N 个 gateway"的不是 CPU,而是 **(a) 吞吐天花板 75/min/台** 和 **(b) gateway 常驻内存随活跃会话累积**。这两个数是容量规划的真正输入。

> **真实更正(见 §七 Sweep 3)**:这里的 75/min 是"纯推理"天花板;**真实带工具负载只有约 10~15/min/台**(背调 10 / 营销获客 15),所以横向扩 gateway 的需求来得比这张表预测的早得多。下面这张表是"骨架能力上限",真实容量请按 §七 的数除以约 5~8。

---

## 六、Sweep 2 结果(maxConcurrent 扫描,2026-06-13 深夜)

Sweep 1 的 75/min 是被 maxConcurrent=8 闸门**人为锁住**的。Sweep 2 提高 maxConcurrent(12/16),让 >8 个请求真正并发打 DeepSeek,找最优值与真天花板。每档**改配置 + 健壮重启 gateway**(清常驻内存 + 重设 Main lane 大小),驱动并发=maxConcurrent 以打满。

| maxConcurrent | 驱动 C | N | 成功 | 吞吐/min | mean 时延 | 判读 |
|---------------|--------|---|------|---------|----------|------|
| **8**(Sweep1 最优) | 8 | 80 | 80/80 | **76.0** | 6.1s | ✅ 最优 |
| 12 | 12 | 96 | 96/96 | 68.2 ↓ | 10.0s | 过拐点 |
| 16 | 16 | 96 | 96/96 | 65.8 ↓↓ | 13.8s | 更差 |

**核心结论:调大 maxConcurrent 单调地降吞吐、涨时延——8 就是这台 4C16G + 单 DeepSeek key 的最优值,再往上是负优化。** 两个叠加原因:
1. **宿主 workspace-sandbox prep 争抢**:每个新会话开跑前要做 workspace-sandbox 准备,gateway 日志实测单次 `workspace-sandbox:5383ms`。并发越高,host 同时做的 prep 份数越多 → CPU/IO 争抢 → prep 阶段膨胀(这是本地瓶颈,不是 DeepSeek)。(注:每发用全新 session 是最坏情况;生产里持续对话复用 session,prep 摊薄。)
2. **DeepSeek 单 key 软降速**:并发越高,每发响应越慢。

**没压出硬 429**:即便 16 路并发,DeepSeek 这个 key 也只软降速、不返回 429(容忍度 >16)。所以 **P0-2 的 429→fallback 链(deepseek→qwen→kimi)在本次没机会在真 429 下触发**——这本身是好消息(DeepSeek 没限速),但 fallback 仍是只在配置/单测层面验证、未在真实 429 下实测的安全网。

### ⚠️ Sweep 2 工程坑:gateway 重启竞态(已解决)
首次 M16(maxConcurrent=16)出现 **0/128 全超时**,一度误判为"host 扛不住 16 并发"。gateway.log 铁证推翻:`23:32:13 [gateway] signal SIGTERM received; shutting down`——gateway 开跑 1 秒就被 SIGTERM 干掉。根因:旧 `gw-restart.sh` 的 `LISTENING_after_1` 在端口刚 bind(gateway 没预热完)就返回,且 `--force` 抢端口时 SIGTERM 了正在服务测试的实例。**修复**:`gw-restart2.sh` 改为等 `agent runtime plugins pre-warmed`(完全预热)才返回 + 彻底杀进程。重跑 M16 → 96/96 成功、SIGTERM=0。**教训:压测里"全失败"先怀疑测试基建(进程竞态/SSH 抖断),别急着当容量结论。**

### 容量规划落点(给产品)
- **单台 4C16G 用 maxConcurrent=8**,吞吐 ~75 任务/分钟 ≈ 4500/小时,30 并发优雅排队(尾延 ~23s)。
- 想提吞吐**不是调大 maxConcurrent**(负优化),而是:① 换更多核/更快盘的机器减小 prep 争抢;② 横向扩 gateway(多实例分租户)线性加吞吐;③ 生产里复用会话减少 prep 开销;④ 若 DeepSeek 单 key 成瓶颈,多 key 轮询。

## 七、Sweep 3:真实工具调用压测(模拟员工真实工作)

前两轮(Sweep 1/2)是"纯推理"——只让员工动脑写、不查资料。但这三个员工的本职就是查外部资料。所以 Sweep 3 让员工**真的跑多回合 + 真调境外工具**,测真实工作负载的容量。**两个工具最重的员工都测了**:背调员工(查公司注册/域名/邮箱)+ 营销获客员工(网页搜索找买家)。

### 怎么测的(真实任务)
- 驱动:[`scripts/cbe-loadtest-tools.mjs`](../../scripts/cbe-loadtest-tools.mjs)(环境变量 `CBE_MODE` 切换员工),同样走 gateway 生产路径(`agent` + `agent.wait`)。
- **背调员工 `cbe-buyer-screening`**:对 8 家真实美国公司(Apple / Tesla / Microsoft / Nike / …)做**轻量真实背调**——实际调用 ① RDAP 查域名注册;② DNS/邮箱检查(MX/SPF/DMARC);③ SEC 查公开披露,再写约 120 字可信度小结 + trusted/cautious/high_risk 结论。
- **营销获客员工 `cbe-lead-discovery`**:用 **`web_search`(Tavily)** 找 8 个国家(英 / 德 / 法 / 西 / 意 / 荷 / 波 / 瑞典)不同手机配件的**下游买家官网**(零售/电商/维修连锁,排除批发商/工厂/目录站/社媒),给公司名 + 域名 + 理由。
- 只用免费 / 低价工具,不碰付费数据源。

### 工具真的调起来了(已坐实,不是假跑)
- **背调**:答案含 apple.com 的**真实 RDAP 注册日期 1987-02-19**(模型编不出来);token 从纯推理的 82 input 涨到 **~3900 input / ~53000 缓存**(工具结果喂回上下文)。
- **营销获客**:答案返回**真实英国公司** Carphone Warehouse(英国最大手机零售连锁)、MobileBitz(约 70 家门店的维修+配件连锁);token 涨到 **~11000 input**——"70 家门店"这种细节模型编不出来,确系真搜。

### 真实负载数据(两员工 × 两档)

| 员工 | 档 | 并发 | 总数 | 成功 | mean | p95 | max(尾延) | 吞吐/分钟 |
|------|----|------|------|------|------|------|----------|----------|
| **背调**(RDAP/DNS/SEC) | C=8 | 8 | 24 | 24/24 | 41.7s | 51s | 73.8s | **10.0** |
| **背调** | C=30 | 30 | 30 | **30/30** | 104s | 172s | **187s** | 9.6 |
| **营销获客**(Tavily 搜索) | C=8 | 8 | 16 | 16/16 | 26.1s | 40.6s | 40.6s | **15.1** |
| **营销获客** | C=30 | 30 | 30 | **30/30** | 74.8s | 143.9s | **153s** | 11.7 |

(另:背调标定 C=1 均值 24.6s;营销获客探针 20.2s;一个背调冷启动探针 54.3s 未计入。)**合计 100+ 个真实任务,100% 成功,0 错误 / 0 超时 / 0 个 DeepSeek 429。** 全程 host load <0.7、容器 CPU ~0、gwRSS 峰 ~1.5G。

### 关键发现

**1. 真实任务比纯推理慢约 4~7 倍**
- 单任务:纯推理 4s → 真实 ~20-25s 单跑、~26-42s @8并发。
- 慢在多回合循环("想 → 调工具 → 读结果 → 再想 → 写")+ 每个外部 API 一次**跨境网络往返**。

**2. 真实吞吐 ≈ 10~15 任务/分钟(纯推理 76 的 1/5~1/8),取决于员工的工具组合**
- 营销获客 **15/分钟**(Tavily 搜索快)> 背调 **10/分钟**(要 RDAP+DNS+SEC,而 SEC 从大陆**可达但慢**(直连实测 ~3s/次)、其多步流程在并发下超时重试,所以更慢)。
- 之前纯推理的 75/分钟是**最轻负载天花板,把真实容量高估了约 5~8 倍**。真实可用容量:单台 4C16G ≈ **10~15 任务/分钟 ≈ 600~900/小时**。

**3. "30 员工同时干真活":全成功,2.5~3 分钟清完,最后一个等 2.5~3 分钟**
- 背调 C=30 尾延 187s(~3min)、营销获客 C=30 尾延 153s(~2.5min,更轻所以更快);两者都 30/30 成功。
- 吞吐仍被 8 槽位锁死(超过闸门只排队不增吞吐),**优雅排队不丢不崩**。

**4. 瓶颈变了:从"内存"变成"槽位 + 境外 API 延迟 + 多回合"**
- host load 全程 <0.7,容器 CPU ~0——**真实负载也不碰本地算力**,活儿全是 DeepSeek 远端推理 + 跨境 API 网络等待。
- 两个员工 8 并发重任务都没把 DeepSeek 压出 429(maxConcurrent=8 仍把同时打 DeepSeek 的数量卡在 8)。

**5. 跨境延迟落差大:境外 API 都可达,但从大陆调美国端又慢(给"选址"的实测数据点)**
- **直连实测(从大陆 ECS 干净 curl,2026-06-15)**:DeepSeek(境内)**0.12s** / Tavily 0.66s / RDAP 0.74s / Companies House 1.66s / **SEC data.sec.gov 2.96s(最慢)** / **OpenAI 超时不可达** / Anthropic 403(服务商层地理封锁,非 GFW)。
- 即:选址报告列的境外 API(除 OpenAI/Claude 外)**从大陆都可达**——但**跨境延迟落差约 25 倍**(DeepSeek 0.12s vs SEC 2.96s)。
- **SEC 是"可达但慢",不是失败**(订正本报告早期表述):背调的 SEC 工具是多步流程(拉 ~1MB `company_tickers.json` + submissions 查询),在并发负载 + 工具超时设置下**超时**,员工重试后改靠 RDAP/DNS——是**延迟/超时问题,非网络封锁**。
- 含义:**可达 ≠ 好用**。从大陆调美国 API 慢,是真实任务慢(26-42s)的主因之一。海外部署(新加坡/东京)到美国 API 延迟更低,**真实任务会更快**——和选址调研的备选论点呼应(海外不只是合规更干净,性能也更好)。

### 重要边界(别过度解读)
- **这是大陆机器、带境外 API 摩擦的数**:SEC 可达但慢(~3s,多步流程在并发下超时)拖慢了背调;换到海外真实吞吐会更高。
- **测了背调 + 营销获客两个工具重员工**;记忆员工(accio)较轻,未单独压测。
- **服务器配置**:测试机 `.env` 原只有 DeepSeek key,本轮补了免费 `SEC_USER_AGENT` + 用户提供的 Tavily key(免费档,本轮测试用量远在 1000 次/月免费额度内);Companies House / Hunter 等仍缺 key 未参与。

### 容量重估(真实数字,供规划)
| 公司规模 | 单台 4C16G(maxConcurrent=8)够不够(真实带工具) |
|---------|-----------------------------------|
| **30 员工** | 偶发真实任务够(600~900/小时 ÷ 30 ≈ 每人每小时 20~30 个);但 30 人**同时**发真活会排队 2.5~3 分钟。 |
| **300 员工** | 不够。真实吞吐只有纯推理估计的 1/5~1/8,横向扩 gateway 的需求来得早得多。 |
| **3000 员工** | 必须多机横向扩 + 按地域就近部署(减小跨境 API 延迟)。 |

---

## 八、Phase 1:全工具(8/8)功能验证(2026-06-17)— 摘要

> **注意:这一章不是压测,是功能验证**(8 工具能不能串起来 + 返回真数据 + 国别路由对不对),并发=1、只 2 单。**完整详细报告**已单独成文:**[`functional-verification-report.md`](functional-verification-report.md)**(逐工具证据 / 时间分析 / 诚实成本账 / 工程坑 / 复现)。此处仅留摘要,供压测读者衔接。

Sweep 1/2/3 测的是**吞吐**(免费源 RDAP/DNS/SEC)。配齐 8 个真实 key 后,本阶段验**全链路功能**:`cbe-buyer-screening` 员工经 gateway 生产路径(`agent`+`agent.wait`)对 **Tesco(英国)+ Apple(美国)** 两单顺序背调(operator 授权付费源)。

**结果:两单并集 8/8 工具全部真实开火,国别路由正确。**

| 任务 | 开火工具 | t_e2e / t_llm / 回合 | 结论 |
|---|---|---|---|
| Tesco-UK | CH·RDAP·DNS·**Hunter**(accept_all 74)·**Abstract**·**ImportYeti**(2 票)·Tavily = **7/8**;SEC 正确跳过 | 47.8s / 34.7s / 6 | trusted_candidate 97/100 |
| Apple-US | **SEC**·RDAP·DNS·**ImportYeti**(2428 票)·Tavily = **5/8**;CH 正确跳过 | 38.5s / 29.7s / 6 | trusted_candidate 100/100 |

两个**诚实细节**(详见专文):
- **SEC(Apple)**:`sec_lookup` 工具开火了,但 `data.sec.gov` 多步流程从大陆**返回 fetch error**(与 Sweep 3 "SEC 可达但慢"一致)——员工**自愈**经 web_search/EDGAR 取得真 SEC 数据(CIK `0000320193`)。"工具开火 + 拿到数据"成立,但干净数据来自 fallback。
- **成本**:ImportYeti 响应的 `creditsRemaining` 两次都 **= 100(未减)**→ `/company/search` 端点不扣 $9/100 额度;Hunter/Abstract 在免费月配额内。**本次全工具背调真实增量花费 ≈ $0**(原"$0.18"是保守上限)。

**资源**:gwRSS 384→707MB,load ≤0.07,**0 次 429**,无超时——功能验证负载极轻。**全工具链路打通,可进入 Phase 2 配额感知压测。**

---

## 九、Phase 2:配额感知全工具压测(双轨,2026-06-17)

> 功能验证(第八章)证"对不对";本章压测证"扛不扛得住 + 真成本 + 哪些工具在压力下掉链子"。驱动 [`scripts/cbe-fulltool-stress.mjs`](../../scripts/cbe-fulltool-stress.mjs)(复用功能验证驱动 + worker 池并发 + 预算熔断,全 §4 埋点),证据 [`research/results/`](results/)。**全程分阶段 + 每阶段 checkpoint,遇到失败即停修复**:pre-flight(网关预热/maxConcurrent=8/配额快照)→ Track A 烟测(2 单)→ Track A 爬坡 → Track B 烟测(1 单)→ Track B 批量。

### 执行总览:**114/114 任务全成功,0 崩溃 / 0 挂起 / 0 超时**

| 轨 | 配置 | 完成 | 吞吐 | p50 | p95 | max | gwRSS 峰 |
|---|---|---|---|---|---|---|---|
| A·C=4 | 免费源,N=24 | 24/24 | 8.5/min | 23.8s | 37.1s | 40.1s | — |
| **A·C=8** | 免费源,N=40 | 40/40 | **18.8/min** ⬅峰 | 22.2s | 31.8s | 32.4s | **1530MB** |
| A·C=12 | 免费源,N=40 | 40/40 | 17.8/min | 33.6s | 57.3s | **83s** | — |
| B·C=3 | 全 8 工具,N=10 | 10/10 | 3.7/min | 41.9s | 47.5s | 47.5s | 1355MB |

### Track A — 免费源吞吐(测天花板)
- **C=8 是甜点**:吞吐峰值 18.8/min;C=12 吞吐不升反降(17.8)且尾延翻倍(p95 32→57s、max 83s)——**第三次坐实 maxConcurrent=8 最优**(Sweep 1/2 同结论)。
- 比 Sweep 3 的 10-15/min 高,因 Track A 任务更轻(只 3 个免费工具)。**gwRSS 峰 1530MB** 再次坐实内存是单台瓶颈(Sweep 1 是 1610MB)。
- 免费源成功率:RDAP 40/40、DNS 40/40、Tavily 34/35 全稳。

### Track B — 全 8 工具 + 真成本(严控预算)
- 10/10 成功,**并集 8 工具全开火**(UK 目标走 CH、US 目标走 SEC,+ 共用 RDAP/DNS/Hunter/Abstract/ImportYeti/Tavily);9/10 做了付费邮箱校验(Best Buy 1 单员工自行跳过=agent 非确定性,非失败)。
- **预算熔断生效验证**:计数器累计 ImportYeti 11 / Hunter 9 / Abstract 9,均在上限 20 内,未触顶;熔断逻辑经烟测确认可用。
- **真成本 ≈ $0**:ImportYeti `creditsRemaining` 跑完 11 次调用后**仍 = 100(未减)**——坐实 `/company/search` 不扣 $9/100 额度;Hunter `/account` 实测仅消耗 5 次(计数器记 9,差额因 Hunter 对重复邮箱**缓存去重**不计费)→ 真实月配额烧得比调用数更少。

### ⚠️ 压力下暴露的 3 个工具级发现(均未导致任务失败,但要记)
1. **SEC 从大陆服务器 0/45 全 `fetch failed`(已根因 + 已修复 ✅)**:`sec_lookup` 在 Track A 40/40 + Track B 5/5 全部 `fetch failed`。**系统化排查推翻了初判**(初判"10MB 文件/30s 超时"是错的——实测失败发生在 **~250ms**,且文件只有 796KB)。**真根因**:服务器是 **IPv4-only**(无 IPv6 路由),但 Node 24 全局 `fetch`(undici)默认开 Happy-Eyeballs `autoSelectFamily`,会对双栈主机(SEC 的 Akamai 边缘 `www.sec.gov`,CIK 解析第一步要拉 `company_tickers.json`)**并发尝试 IPv6**,IPv6 腿在 ~250ms `autoSelectFamilyAttemptTimeout` 超时后被 undici 报成快速 `ETIMEDOUT`("fetch failed")**而非干净回退 IPv4**(`data.sec.gov` 恰好回退成功所以单独可用)。**对照实证**:同主机同 UA 下 `curl` 成功(回退 IPv4)、Node `fetch` 失败 → 不是封锁、不是超时。**修复**(`sentura/mcp-servers/cross-border-intel/src/index.ts` 进程启动处):`net.setDefaultAutoSelectFamily(false)` + `dns.setDefaultResultOrder("ipv4first")`(纯 Node 核心模块、无新依赖;`CBE_INTEL_FORCE_IPV4=false` 可在 IPv6-only 部署关掉)。**验证**:重启网关后真实背调 **SEC 9/9 `found`**(Apple/MSFT/Tesla/Nike/Starbucks/Ford + Apple,`resolver_http_status=200`+`submissions_http=200`),从 0/45 → 全绿。SEC 现为这台机上**真正可用**的免费源。
2. **Abstract 免费档在并发下限流(C=3 时 2/9 报 429)— 已修复 ✅**:实证 4 并发 → `429,429,200,200`,**不是月配额**(才用 ~11/100)而是**~1-2 并发的速率限**,且 Abstract **不回 `Retry-After` 头**;Hunter 同并发 4/4 不限流(它没这问题)。**修复**(`tools.ts` 的通用 `fetchJson`):**429/503 自动重试 + 指数退避 + 抖动**(3 次,base 600ms ×2,+0-400ms 抖动;有 `Retry-After` 则优先用它)。429 不耗月配额所以重试免费;抖动把并发重试错开填进 Abstract 的空闲档。通用化后 SEC/Hunter/ImportYeti/CH 全受益。**验证**:重跑 C=3 N=6 全工具 → **Abstract 6/6 成功**(原 2/9),0 个 429 冒到任务层。**代价**:命中限流时退避加时延(p50 42→60s)——对 🔴 源是"宁慢勿丢"的正确取舍。
3. **Companies House 命中只有 2/5 — 已根因 + 已修复 ✅(初判又错了一次)**:初判"员工没解析出注册号"是**错的**。看真实轨迹:员工**完全做对了**——先 `company_registry_search({company_name,country:"GB"})` → CH 200 found 拿到 Currys 注册号 `07105905`,再 `company_profile({registry:"companies_house",company_number:"07105905"})` → 却被工具返回 `unavailable_api`。**真根因是工具 bug**:`company_profile` 的 CH 分支(`tools.ts:243`)除了 `registry==="companies_house" && company_number && key` 外还**多要求 `country==="GB"`**;但员工刚从 CH 搜索拿到号、自然不再传 `country`,`undefined≠"GB"` → 一个完全合法的 CH 查询被丢进 `unavailable_api`(谁碰巧也传了 country 才成功,所以非确定性 2/5)。**修复**:去掉那个多余的 `country==="GB"` 闸——`company_number`+`registry=companies_house` 本身就唯一确定一个 UK CH 实体,`country` 冗余。**验证**:重跑 4 家 UK 公司 → **CH 4/4 found**(Tesco/Currys/Sainsbury/Argos 全绿,原 2/5)。**教训**:差点照初判去"强化技能 prompt",但技能本就对、员工本就对——是工具把对的输入拒了;systematic-debugging 的"看真实调用参数"才揪出来。

### 容量结论(真实全工具)
- **免费链路**:单台 4C16G + maxConcurrent=8 稳定 ~18/min(轻任务)~10-15/min(Sweep3 重任务);瓶颈是 gateway 内存(峰 1.5GB)+ 槽位 + 境外 API 延迟。
- **全工具链路**:~3.7/min(每单 ~40s、6 回合、8 工具串行+并发混合);🔴 付费邮箱源必须低并发(C≤2)防 429。
- **付费成本**:配齐后真实增量 ≈ $0(ImportYeti 搜索不扣额、Hunter/Abstract 月配额内且去重)——成本不是规模化的约束,**SEC 大陆不可用 + 🔴 源并发限流**才是。

---

## 十、P0-2 DeepSeek 429 fallback 验证(Tier 0,2026-06-17)

> 当初审计的 P0-2 给三个 cbe 员工配了 `model:{primary:deepseek/deepseek-chat, fallbacks:[qwen/qwen3.5-plus, moonshot/kimi-k2.6]}`,目的是"一次 DeepSeek 429 别冻死整个平台 30 分钟"。但所有压测里 DeepSeek 从没被压出硬 429(maxConcurrent=8 是天然护盾),这条 fallback **写了从没真触发过**。Tier 0 用**故障注入**把它逼出来验。

### 怎么测的(故障注入,可控可恢复)
读源码先确认机制是 **OpenClaw 原生**(`src/agents/model-fallback.ts`:429→`reason:rate_limit`→逐请求走链,带 `model-fallback/decision` 日志)。然后:写个 15 行本地 mock(对 `/chat/completions` 一律返回 HTTP 429),把 `models.providers.deepseek.baseUrl` 临时指向 mock,重启网关,跑任务,看 fallback 行为;跑后还原 baseUrl + 重启 + 验真 DeepSeek 恢复。

### 结果:机制活、429 不冻平台 ✅,但 fallback 现在**接不上**(provider 未注册)
- **单任务**:DeepSeek 调用命中 mock → 429,gateway.log 完整记录逐级 failover:
  `failover decision: decision=fallback_model reason=rate_limit from=deepseek/deepseek-chat rawError=429`
  → `candidate_failed candidate=deepseek/deepseek-chat reason=rate_limit next=qwen/qwen3.5-plus`
  → `candidate_failed candidate=qwen/qwen3.5-plus reason=model_not_found next=moonshot/kimi-k2.6`
  → `candidate_failed candidate=moonshot/kimi-k2.6 reason=model_not_found next=none`
  → `FallbackSummaryError: All models failed (3)`。**全程 8.13s 失败,不是 30 分钟挂起。** ✅
- **并发**:4 任务 C=4 同时撞 429 → **8s 全部快速失败、互不阻塞,Main lane 没冻**。✅ 坐实"一次 429 不会冻死平台"。
- **但**:Qwen/Kimi 候选返回 **`model_not_found`** —— 不只是缺 key,是 **`models.providers` 里压根没声明 `qwen`/`moonshot` 这两个 provider 和它们的 model**(`.env` 也只有 `DEEPSEEK_API_KEY`)。错误信息直接给了修法:`Add { "id": "qwen3.5-plus" } to models.providers["qwen"].models[]` + 注册 moonshot + 配 key。

### 结论
**P0-2 的核心保证成立**:DeepSeek 429 会在 ~8s 内逐级 fallback、不会自挂起冻平台(原审计最怕的就是这个)。**Tier 0 时 fallback 还是"空网"**(provider 未注册 + 无 key),任务快速失败而非接住。

### Tier 1 —— 把空网补成真网(已完成 ✅ 2026-06-17)
用户改用 **GLM(智谱)+ 千问(DashScope)** 做两条 fallback(都是大陆同区、延迟低)。
1. **连通性**:curl 实测 `qwen-plus` HTTP 200 / **0.42s**、`glm-4.6` HTTP 200(`/api/paas/v4` 路径正确,没踩 /v1 坑)。
2. **接线**:在 `models.providers` 声明 `qwen`(`dashscope.aliyuncs.com/compatible-mode/v1`,model `qwen-plus`)+ `glm`(`open.bigmodel.cn/api/paas/v4`,model `glm-4.6`),key 用**显式 `apiKey` 字段**(OpenClaw 自定义 provider 无 env 约定,`getEnvApiKey` 对未知 provider 返 undefined,只能显式给;值从 `.env` 读、写进服务器 `openclaw.json`,不入仓库)。3 个 cbe 员工 fallback 链改为 `[qwen/qwen-plus, glm/glm-4.6]`。
3. **端到端验证(再注入 429)**:
   - DeepSeek 429 → `candidate_succeeded candidate=qwen/qwen-plus`,trajectory `answered by: provider=qwen model=qwen-plus`,**任务 ok** —— **Qwen 真接住了**。
   - DeepSeek + Qwen 都 429 → `candidate_succeeded candidate=glm/glm-4.6`,**任务 ok** —— **GLM 兜底也真接住了**。
   - 还原后真任务正常(DeepSeek 主、不 fallback)。

**结论:P0-2 fallback 现在是真网。** DeepSeek 挂 → Qwen 顶;DeepSeek+Qwen 都挂 → GLM 顶;三层都验过真出答案、任务成功,且全程 429 不冻平台。已干净还原,平台无残留。
> **durability 已落地 ✅**:不只改了服务器 runtime,也回写了 repo 源,**重跑 setup 不再打回旧的**:① `sentura/agents/cbe-*/config.json5`(×3)model 别名 → `qwen/qwen-plus`+`glm/glm-4.6`;② `scripts/sentura-setup.{sh,ps1}` 的 `cbeDomesticModelRefs` 同步改 + **新增声明 `models.providers.qwen`(`dashscope.aliyuncs.com/compatible-mode/v1`)+ `.glm`(`open.bigmodel.cn/api/paas/v4`),apiKey 用 `envRef('DASHSCOPE_API_KEY')`/`envRef('GLM_API_KEY')`**(env-ref,密钥留在 `.env`、不入 openclaw.json;实测 OpenClaw 运行时会解析 provider apiKey 里的 `${}`)+ 别名 Kimi→GLM;③ `scripts/test-cross-border-agents.ts` 断言同步。**关键工程发现**:OpenClaw `getEnvApiKey` 对**自定义 provider**(不在内置硬编码表)返 undefined、无 `<ID>_API_KEY` 大写兜底,所以 qwen/glm 必须显式给 `apiKey`(`env-api-keys.ts:getApiKeyEnvVars`)。

---

## 十一、待办 / 后续

- [x] **修 SEC 大陆不可用(发现①)— 已完成 2026-06-17**:根因 = IPv4-only 主机 + undici Happy-Eyeballs 抢 IPv6;修复 = MCP 进程启动 `setDefaultAutoSelectFamily(false)`+`setDefaultResultOrder("ipv4first")`。验证 SEC 0/45 → 9/9 `found`。
- 次要优化(可选):`sec_lookup` 返回的 `submissions` 整块 ~32KB,轨迹存储会截断(不影响员工用前部 status/cik/sic,但压测 parser 需正则兜底取 status——已修 `cbe-fulltool-stress.mjs`/`cbe-functional-test.mjs`)。后续可让工具只回最近 N 条 filings 瘦身。
- [x] **修 Abstract 并发限流(发现②)— 已完成 2026-06-17**:`tools.ts` 通用 `fetchJson` 加 429/503 重试 + 指数退避 + 抖动;验证 Abstract C=3 时 2/9 → 6/6。
- [x] **修 CH 命中率(发现③)— 已完成 2026-06-17**:根因是工具 bug(`company_profile` CH 分支多要求 `country==="GB"`,员工常省略 country),非"没拿到号";去掉冗余 `country` 闸,CH 2/5 → 4/4。**不需要配 OpenCorporates key**。
- 三个 Phase 2 工具级发现(SEC / Abstract / CH)**全部已修复并验证**;剩 ImportYeti 偶发 1/8 未命中(无海关记录或瞬时,非系统性,未追)。
- **其余 P1 残留**(与本压测无关,后续):P1-1 真 resolver 测试、P1-2/3 标记解析 E2E + 遵守率基线、adapter LIVE/DEGRADED 记录、国产模型文件 git commit、meta-agent 也加 fallback。P0-2 fallback 机制已 **Tier 0 验证**(见第十章:429→8s 逐级 fallback、不冻平台 ✅);**Tier 1(真用 Qwen/Kimi 顶上)待办**:`models.providers` 注册 qwen+moonshot provider/model + 配 DashScope/Moonshot key + 再注入 429 验真接上。

- **Phase 2 终极压测(配额感知双轨)**:Track A 免费源高并发测吞吐天花板 / Track B 全 8 工具小批量(N=10~20,低并发,预算熔断 ImportYeti≤30)测全链路真成本。驱动 `scripts/cbe-fulltool-stress.mjs`(待写,复用功能验证驱动 + 配额预检 + 调用计数器)。
- 订正 `server-location-llm-decision-report.md` 第 0 章表:Hunter/ImportYeti 已从"付费/缺口"变"配齐可用"。
- **其余 P1 残留**(与本压测无关,后续):P1-1 真 resolver 测试、P1-2/3 标记解析 E2E + 遵守率基线、adapter LIVE/DEGRADED 记录、国产模型文件 git commit、meta-agent 也加 fallback。P0-2 fallback 机制已 **Tier 0 验证**(见第十章:429→8s 逐级 fallback、不冻平台 ✅);**Tier 1(真用 Qwen/Kimi 顶上)待办**:`models.providers` 注册 qwen+moonshot provider/model + 配 DashScope/Moonshot key + 再注入 429 验真接上。

---

## 十二、如何复现

```bash
# 服务器上(loopback,gateway 在跑):
# 1) 起监控
setsid bash /root/sentura/scripts/cbe-loadmon.sh >/dev/null 2>&1 &
# 2) 逐档跑(并发 总数 档名)
cd /root/sentura/openclaw
OPENCLAW_DIR=/root/sentura/openclaw node /root/sentura/scripts/cbe-loadtest.mjs 8 80 r2
# 2b) Sweep 3 真实工具任务(背调员工真调 RDAP/DNS/SEC,需先在 .env 配 SEC_USER_AGENT)
OPENCLAW_DIR=/root/sentura/openclaw node /root/sentura/scripts/cbe-loadtest-tools.mjs 8 24 r8tool
# 2c) Phase 1 全工具功能验证(8 key 配齐后,顺序跑 Tesco+Apple,付费源开;§4.4 采样器另起)
MON_LOG=/root/cbe-func-out/monitor-$RUN.log GW_LOG=/root/gateway.log setsid bash /root/cbe-loadmon2.sh >/dev/null 2>&1 &
OPENCLAW_DIR=/root/sentura/openclaw OUTDIR=/root/cbe-func-out node /root/cbe-functional-test.mjs
#    只重解析磁盘轨迹(不烧额度):REPARSE_RUN=<run> ... node /root/cbe-functional-test.mjs
# 2d) Phase 2 双轨压测(配额感知)
#    Track A 免费源高并发(测吞吐):
TRACK=A OPENCLAW_DIR=/root/sentura/openclaw OUTDIR=/root/cbe-stress-out node /root/cbe-fulltool-stress.mjs 8 40 r8
#    Track B 全 8 工具低并发 + 预算熔断(测全链路真成本;🔴 源 C≤2 防 429):
TRACK=B IY_CAP=20 HUNTER_CAP=20 ABS_CAP=20 OPENCLAW_DIR=/root/sentura/openclaw OUTDIR=/root/cbe-stress-out node /root/cbe-fulltool-stress.mjs 3 10 b1
# 3) 看监控
tail -f /root/loadmon.log
```
合格判据:成功率 100%,无 agent_timeout,无大量 429(出现 429 时应观察到 fallback 切换而非 Main lane 30min 挂起),gwRSS 不逼近宿主上限,容器内存不触 OOM-kill。

---

# 第十一章 — 两员工补测轮(cbe-accio-memory + cbe-lead-discovery,2026-06-19)

> 第八~十章只覆盖 **cbe-buyer-screening**。本章补齐另外两个员工。**完整独立报告见 [two-agent-round-report.md](two-agent-round-report.md)**,此处留摘要。

**范围**:accio-memory(Accio 聊天→结构化摘要,零外部 API、只读记忆)、lead-discovery(NL brief→web_search 找买家→去重→LeadCandidate,仅 Tavily+免费 RDAP/DNS)。三层:L1 功能 / L2 handoff 链路 / L3 最高强度压测。新脚手架 `scripts/cbe-{lib,agent-functional,agent-stress,handoff-e2e,gen-fixtures}.mjs`(AGENT-env)。

**L1 功能**:accio 核心全绿(A1A2A8 18/18、A3 不编价、malformed emptyconv 硬停/badfields 报错)+ **LanceDB 前后 0 文件(只读零写入铁证)**;lead L4-L8 全绿(去重完美、增强只开 2 工具、guardrail 拒绝、缺货诚实)。

**L2 handoff**:确认非运行时跨员工调用(两发送方结构性禁 `sessions_send/spawn/gateway`,negative-assert 通过)=产物式剪贴板交接。**发现+修 handoff 数据丢失 bug**:背调仪表盘 `buildScreeningPayload` 只解 `{leads}`/裸数组 → accio `{targets}` + lead 完整信封被**静默吞空**;改 `unwrapTargets` 接 4 形状,E2E 0→2 全过。

**L3 拆护盾压测**(逐档抬 maxConcurrent):

| maxConcurrent | 成功率 | 吞吐 | gwRSS | 真 429 | 跨会话串扰 |
|---|---|---|---|---|---|
| 8 | 95% | 4.4/min | 1366M | 0 | 0 |
| 24 | 99% | 12.7/min | 1549M | 0 | 0 |
| 32 | 98% | 13.9/min | 1931M | 0 | 0 |
| 48 | **10%(崩)** | — | 触 1.5G 阈值 | 0 | 0 |

结论:**拐点 32↔48,生产安全并发 ≈32,吞吐 ~14/min 封顶(DeepSeek 单 turn 延迟决定)**;**DeepSeek 付费档全程 0 真 429 → 这盒逼不出 provider 429**(网关 `rss_threshold` 1.5G 默认值+延迟先到顶,而宿主 14G 空闲 load<1 → **天花板是 OpenClaw 软配置非硬件**,调高 rssThreshold 可解锁);**跨会话串扰 8→48 档全 0**(每会话 nonce 全扫,隔离铁证);marker 存活 ~90% accio/~95-100% lead。

**DeepSeek 运维事件**:测试期同事额度耗尽→真实 `402`→**fallback 组织性触发、qwen 接住 40 次(史上首次非注入实证)**;用户充 $20+换新 key 后**网关仍 402**,抓包+`secrets audit` 定位根因=`agents/main/agent/auth-profiles.json` 明文旧 key 优先级压过 .env/apiKey(cbe 员工继承 main profile),改该文件 key→恢复(e2e 191s→64s、0 billing)。

**修复**:F-handoff(`screening/page.tsx` unwrapTargets,commit `3665947f`);F-accio-2/F-lead-2 marker 非法 JSON → accio/lead 仪表盘解析器加 `parseJsonArrayTolerant` 逐元素抢救 + buildEmployeePrompt 严格 JSON 指令(commit `93288e7d`);auth-profiles key(服务器)。**建议**:调高 rssThreshold、大 accio 导出首选 glm-4.6(200K,规避 qwen context-overflow)、auth-profiles key 迁 SecretRef。CE14.1~CE14.x。

---

# 第十二章 — 10 项/任务压测(背调/获客各查 10 个,2026-06-19)

**问题**:用户问"背调和获客分别要查 10 个公司/客户,耗时和压力会不会显著增加?"并要求设计一套 10-项压测方案。约定:**开付费路线、10 家=1 批、两员工提示词开局直接对 10 个**。

**方法**:新驱动 [`scripts/cbe-batch10.mjs`](../../scripts/cbe-batch10.mjs)(复用 `cbe-lib.mjs` + 移植 fulltool 成本抽取),PHASE=A 真实工具 + 付费授权(`CBE_ENABLE_PAID_TRADE_DATA=true`/`$1`/家),低并发标定。先小样确认链路(铁律),再阈值扫描。采集磁盘轨迹 token/工具/回合 + sessions.json 富字段 + 真实美元成本。

## Phase A 结果(单会话,真实+付费)

| 任务 | 结果 | e2e | 回合/工具 | 产出 | token | 付费 |
|---|---|---|---|---|---|---|
| **获客 find-10** | ✅ | 107.8s(1.8min) | 6 / 33 | **10/10** | 27.6K | $0.009 |
| **背调 batch-3** | ✅ 干净 | 92.8s | 5 / 26 | 3/3 | 45.8K | IY $0.27 |
| **背调 batch-5** | ✅ 勉强 | 181.9s | **12 / 69** | 5/5 | 17.6K* | IY $0.90 |
| **背调 batch-10** | ❌ **崩** | 81s(failed) | 7 / 45 | **0/10** | — | 白烧 H×10+A×10 |

\* batch-5 末态 token 反而比 batch-3 低 = OpenClaw 中途触发**上下文压缩**(丢老工具结果)才撑过 5 家;`totalTokens` 是末态非累计。

**batch-10 崩溃铁证**:session `status=failed`、轨迹 808KB、`"stopReason":"error"` + `"errorMessage":"Context overflow: estimated context size exceeds safe threshold during tool loop."` + DeepSeek **413 Payload Too Large** 连发。

## 结论(两员工相反)

1. **获客:5→10 几乎不增加。** find-10 单会话 1.8min/27.6K tok/10 个达标,与 5 个时相当——获客攒"公司名+URL"轻文本,翻倍无压力,**可开局直接对 10 个**。
2. **背调:5→10 不是"变慢"是"做不了"。** 单家 ~42s、batch-3 ~31s/家(每家耗时基本线性),但**一个会话塞不下 10 家**:每家拉重型工具结果(SEC 单家 ~32KB+注册局+DNS+邮箱校验),单家 ~15K tok、3家 ~46K、10家外推 ~150K → 爆 DeepSeek 上下文 → **整单失败 0 产出,还白烧付费**(崩前已 Hunter×10+Abstract×10)。
3. **背调单会话安全批量上限 ≈ 5 家(干净 ≤3,≥6 危险,10 必崩)**;**重工具员工的"多个"必须 fan-out**(拆 ≤3-5 家/会话的多会话,或 1家/会话并发);越接近上限成本/耗时越不成比例(batch-5 每家 ~14 工具、付费 2×)。
4. **想 batch 更大** → 换大上下文窗模型(glm-4.6 200K / qwen-long / [1m] 类)或先做证据裁剪再喂。

## Phase B(并发阶梯)— 完成,详见独立最终文档

用户定:获客 find-10 + 背调 **1 家/会话**(完整性最佳,见下),两者真烧付费。maxConcurrent=40 阶梯 C=8/16/32。**全程 0 rss_threshold、96/96 全成功**:获客 find-10 吞吐近线性 14.5→32.3→**63.5 项/min**;背调单家 ~13.7/min 封顶(DeepSeek 延迟)、付费 1×/家。**10-项重会话(~25K)没有显著降低单盒并发容量**(C=32 仍 0 告警,拐点 >32)。

**完整性裁决**:背调 batch 越大压缩越多报告越薄(单家 6 证据源/0 压缩 > batch-3 7 源/0 压缩 > 优化 batch-5 5 源/4 压缩 > batch-10 崩);优化提示词修对成本(付费 2×→1×、工具 69→41)但救不回完整性。**背调"10 个"正解 = 1 家/会话 fan-out。** 全部数据 + 提示词全文见 → [`final-test-report.md`](final-test-report.md)。CE15.1~CE15.5。
