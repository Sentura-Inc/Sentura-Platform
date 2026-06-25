# ecommerce(Phase 2)部署到服务器 — 任务记录 + Runbook

> 专门针对"给服务器拉 ecommerce 最新版"这次任务的完整记录。**✅ Layer 1 已部署完成(2026-06-25)**,见 §0.1。下方 §1-§6 是部署前的 runbook/决策(保留为参考)。

## 0.1 ✅ 执行结果(2026-06-25,Layer 1 完成并验证)

用户选**"代码+agents 先上 + PG 备好"(Layer 1)**,完整 operator 登录鉴权(Layer 2)延后。服务器现在在 `ecommerce`=`88379879`。**关键发现:MCP `cross-border-intel`(agent 工具层)不 import cross-border-store、无 pg 引用 → agent 背调/获客不依赖 PostgreSQL,openclaw 网关也 file-based;PG 只服务 dashboard 业务持久化。**

执行链(每步都验证):
1. **快照/备份**(STAMP `20260625T095923Z`):分支 `backup/pre-ecom-20260625T095923Z`(标旧 HEAD `a43feb2f` 防 GC)+ `.env.local.pre-ecom-…` + `~/.openclaw.cfgbak.…`(.env / openclaw.json / 4 个 auth-profiles.json)+ `git stash -u`(收 38 改动)。**回滚网全在,未删。**
2. **`git reset --hard origin/ecommerce`**(88379879;544 文件 / +111829 行)→ **跳过 `git clean`**(stash 已清未跟踪,避免误删备份)。
3. **openclaw 不重装/不重建**:版本同 `2026.6.2`、`openclaw/package.json` 与 `pnpm-lock.yaml` 没变、`dist/` 在;330 个 `openclaw/packages` 全是 "A"(只是新纳入 git 跟踪)→ 网关跑现成 dist。
4. **根 `pnpm install`**(只增 `pg ^8.21` + `@types/pg`,5s)→ **重建 MCP**(`tsc`)→ **dashboard `pnpm build` 通过**(静态页 33/33,无报错)。
5. **PostgreSQL = 唯一新建**:docker `postgres:16-alpine` 容器 `sentura-cbe-pg`(**仅绑 `127.0.0.1:5432`**,命名卷 `sentura-cbe-pgdata`,库 `sentura_cbe`,`postgres:postgres`)→ `CBE_DATABASE_URL` 写进 `sentura/dashboard/.env.local` → `CBE_DATABASE_URL=… pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed`(**8 迁移全 applied + seed:tenant `cross-border-ecommerce` / 1 admin + 2 operator**,建 32 表)→ **DB-only load smoke `scripts/test-cross-border-phase2-load-smoke.ts --require-db` = 47/47 PASS**(`db_only_preflight_passed`)。
6. **网关重启 `gw-restart2.sh`**(WARM,**绝不 setup**)。复核保住:`maxConcurrent=8`、付费闸 `CBE_ENABLE_PAID_TRADE_DATA=true`/`$1`、8 个数据源 key、3 个 cbe agent 的 `model.fallbacks`(GLM/Qwen)。
7. **真实任务冒烟**(PHASE=A 真实+付费):背调 Tesco(UK→Companies House,48s/7 工具/付费 IY+1 $0.09)+ Apple(US→**SEC found** CIK 0000320193/AAPL,agent 报告写入 ✅);获客 find-10(69s,**仅 2/10**,根因缺 GOOGLE_MAPS_API_KEY 退化到纯 web_search)。dashboard 重启后 `/employee` 200、DB 路由 `401 cbe_login_required`(PG 连通 + 登录鉴权生效,无 pg 错误)。

### ⚠️ 三个遗留(必须跟进)
1. **SEC IPv4 修复在 ecommerce 上游丢了**:同事"适配"重构 MCP 时丢了我们的 `setDefaultAutoSelectFamily(false)+setDefaultResultOrder("ipv4first")`,部署后实测 `cbe_intel_sec_lookup`=**fetch failed**(curl -4 SEC=200 / -6=000,Node 默认 fetch=ETIMEDOUT)。**已热修服务器**(往 `sentura/mcp-servers/cross-border-intel/src/index.ts` 顶部插回 IPv4 pin + `CBE_INTEL_FORCE_IPV4` 开关;补丁 `/root/cbe-sec-ipv4.patch`、原文件 `/root/cbe-ecom-index.ts.orig`),重建+重启后 Apple 直连+agent 双双 found。**我们 `cbe-loadtest-and-research` 分支的 index.ts 本就有这段** → **请同事在 ecommerce 上游补回**,否则每次重拉都丢、SEC 再挂。
2. **缺 `GOOGLE_MAPS_API_KEY`**:Phase 2 把 Google Maps 设主获客源,服务器没这 key → find-10 退化(2/10)。恢复需 `~/.openclaw/.env` 加 key + 手工往 `openclaw.json` 的 `mcp.servers.cross-border-intel.env` 加 `GOOGLE_MAPS_API_KEY: "${GOOGLE_MAPS_API_KEY}"`(禁 setup)。
3. **Layer 2 延后**:dashboard 跑新代码+连 PG 了,但 operator 登录密码未发放 → 员工数据页 `401 cbe_login_required`。要让试点用户用,需配 operator 密码(migration 004)+ `NEXT_PUBLIC_CBE_ADMIN_USER_ID`/`NEXT_PUBLIC_CBE_USER_ID` 指向 seed 的 user id。已加随机 `SENTURA_CBE_SESSION_SECRET`+`NEXTAUTH_SECRET`(session 安全,不崩)。

## 0. 一句话现状(部署前,已过时,保留)

服务器 `/root/sentura` 在 `ecommerce` 分支、HEAD=`a43feb2f`;已用**浅克隆 PAT** `git fetch --depth=1 origin ecommerce` 成功(tip=`88379879`)。**尚未 reset/部署**。我们测试轮的 38 个本地改动还在服务器工作区(未提交),且**全部已 commit 在 `cbe-loadtest-and-research` 分支(GitHub),丢不了**。

## 1. 环境 / 坐标

- 服务器:阿里云 ECS `47.96.40.237`,SSH `ssh -i ~/.ssh/sentura.pem root@47.96.40.237`(加 `-o ServerAliveInterval=8`)
- 仓库:`/root/sentura`,remote `https://github.com/Sentura-Inc/Sentura-Platform.git`
- 运行时(**不在仓库**):`~/.openclaw/`(`.env` / `openclaw.json` / `agents/main/agent/auth-profiles.json`)
- 网关:`gateway run --bind loopback`(只听 127.0.0.1:18789);Control UI 经 SSH `-L 18789` 隧道访问
- 当前运行时配置:maxConcurrent=8、付费闸 `CBE_ENABLE_PAID_TRADE_DATA=true`/`$1`、DeepSeek 主 + qwen/glm fallback、8 个 API key 都在

## 2. 关键决策 / 已确认(别再纠结)

1. **会不会覆盖我们的修复?** reset 会覆盖**服务器工作区**的 38 个本地改动,但它们**已在 `cbe-loadtest-and-research` 分支云端**(已核验:SEC IPv4 4处、Abstract retry 14、CH 5、模型fallback 2、parseJsonArrayTolerant 2、unwrapTargets 2)→ 丢不了,可随时取回。
2. **会不会回归?** **不会**——同事(微信确认)已**把我们的压测改进融进 ecommerce**(重写 MCP/dashboard 时按报告改的,**不是原样**,所以 grep 我们的标记找不到 ≠ 漏了)。cbe 分支保留不删。
3. **API key 要重配吗?不用。** key 在 `~/.openclaw`(.env / openclaw.json / auth-profiles.json),**reset 碰不到**。8 个 key、付费闸、fallback、maxConcurrent 全保。**唯一会冲掉的动作 = 重跑 `sentura-setup`/onboard → 所以部署时绝不跑 setup。**
4. **PAT 已暴露,必须撤销**:fetch 用的 GitHub PAT 因我一条 `ps` 被带进过聊天 → **用完去 GitHub Settings 撤销**(一次性的,撤了不影响)。后续再 fetch 需重新给 PAT(浅克隆 + HTTP/1.1,见 §5)。

## 3. ecommerce 是大版本 Phase 2(544 文件 / +111829 行)

- **新增 PostgreSQL 数据层** `sentura/lib/cross-border-store/`(db/migrate/schemas/seed/ids)+ **8 个 SQL 迁移** `migrations/001..008`(initial_schema、lead_scope_coordinator、manager_cost_controls、**operator_password_login**、workload_queue_and_screening_batches、screening_address_locations、screening_retry_memory_approval、accio_manual_import_formats)。依赖 `pg ^8.21`。
- **MCP `cross-border-intel` 大改写**(tools.ts +491、schemas +121、server.test +409、config +14)
- dashboard / 多个 sentura-extension 更新;大量新文档(DESIGN/SCREENING/MEMORY_PROCESSING/PHASE-2/MARKET_ACQUISITION/UI/**P2.6-LOAD-SMOKE-RUNBOOK**/启动说明)

## 4. ⚠️ 真正要新配的不是 API key,是 Postgres

Phase 2 从 **PostgreSQL** 读写(`pg` 依赖;P2.6 runbook 里 `source sentura/dashboard/.env.local` 取 DB 连接)。之前部署是 file-based,**没有 Postgres**。所以部署要新增:

- **一个 PostgreSQL 实例**(本机装或连现有)
- **`sentura/dashboard/.env.local`**:DB 连接串(DATABASE_URL 之类)+ 可能的 operator 登录密码(`004_operator_password_login` 迁移暗示)
- **跑 8 个迁移**(机制待定:`sentura/lib/cross-border-store/migrate.ts`;cross-border-store package.json 只有 build/typecheck,无 migrate script → 迁移由 migrate.ts 被某根脚本/应用启动时调用,**部署时先读 PHASE-2.md / 启动说明.md 确认怎么跑**)

> **待部署时先读**(已 fetch,`git show origin/ecommerce:<path>`):`跨境电商/PHASE-2.md`(权威)、`跨境电商/P2.6-LOAD-SMOKE-RUNBOOK.md`(冒烟步骤,DB-only 不烧 provider)、`跨境电商/启动说明.md`、`跨境电商/API_KEYS_OPENCLAW_SETUP.md`(看是否新增 env)。

## 5. 部署 Runbook(待用户点头后执行,逐步报告、可回滚)

0. **(若 origin/ecommerce 引用过期)重新 fetch**(需 PAT,用户本地终端跑,静默):
   ```bash
   ssh -t -i ~/.ssh/sentura.pem root@47.96.40.237 'read -rsp "PAT: " T; echo; cd /root/sentura && GIT_TERMINAL_PROMPT=0 git -c http.version=HTTP/1.1 -c credential.helper="!f(){ echo username=token; echo password=$T; };f" fetch --depth=1 origin ecommerce && echo OK; unset T'
   ```
1. **snapshot 回滚点**:记录 `git rev-parse HEAD`;`tar czf /root/sentura-pre-ecommerce-$(date).tgz`(或至少备份 `~/.openclaw` + 38 改动清单)。`~/.openclaw` 单独备份(`cp -r ~/.openclaw ~/.openclaw.bak`)。
2. **取代码**:`cd /root/sentura && git reset --hard origin/ecommerce && git clean -fd`(clean 会删未跟踪的 _loadtest*.mjs 等;确认无要留的)。
3. **装依赖**:`pnpm install`(根 + 新 cross-border-store);openclaw 若变动 `cd openclaw && pnpm install`。
4. **Postgres**:装/连 PG → 建 `sentura/dashboard/.env.local`(DB 连接 + operator 密码等,按 §4 文档)→ **跑 8 个迁移**(机制按 PHASE-2.md)。
5. **重建**:MCP `cd sentura/mcp-servers/cross-border-intel && pnpm build`(tsdown→dist,网关从 dist 加载);dashboard `cd sentura/dashboard && pnpm build`(或 dev);openclaw 若变 `pnpm build`。
6. **不跑 setup/onboard**(保 key)。**重启网关**:`bash /root/gw-restart2.sh`(race-safe,等预热)。
7. **冒烟**:① `pnpm exec tsx scripts/test-cross-border-phase2-load-smoke.ts`(静态)→ `--require-db`(DB-only,不烧 provider);② cbe 真任务冒烟(背调单家 + 获客 find-10)**重点验 SEC IPv4 大陆没回归**(`cbe_intel_sec_lookup` 返回 found 非 fetch failed);③ 确认 key/付费闸/fallback 还在(`secrets audit` / 看 openclaw.json)。
8. **收尾**:撤销 PAT;若一切 OK 删 snapshot;记录到 docs/MEMORY + 持久记忆。

## 6. 风险 / 红线

- **PAT 用完撤销**(已暴露)。
- **绝不跑 `sentura-setup`/onboard**(会重写 openclaw.json → 丢 key/付费闸/fallback)。
- **Postgres 是新硬依赖**:确认部署后"网关 + cbe agent"是否硬需 PG,还是只有新 dashboard/store 功能需要(若 agent 运行不依赖 PG,可先让 agent 跑通、PG 功能后补)。
- **SEC IPv4 大陆回归**是最高风险项(团队在别处开发未必撞到)——必须冒烟实测。
- **动的是生产服务器**:每步报告 + 留 snapshot;`git clean -fd` 前确认没有要留的未跟踪文件(本轮我们的 `/root/cbe-*.mjs` 在 `/root/`,不在 `/root/sentura/`,clean 不影响)。
- reset 前确认服务器没有正在跑的 cbe 任务(避免中断)。
