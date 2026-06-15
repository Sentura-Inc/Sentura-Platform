> **On-demand reference — not read by default.**
>
> Back-link: [`docs/MEMORY.md`](../../docs/MEMORY.md)

# Cross-Border E-Commerce — 大陆云服务器部署 (Mainland Cloud Deployment)

完整档案:把三个跨境员工(`cbe-lead-discovery` / `cbe-buyer-screening` / `cbe-accio-memory`)从空文件夹部署到中国大陆阿里云 ECS、用国产模型(DeepSeek)驱动、Docker sandbox 真实隔离、Dashboard 经 SSH 隧道在浏览器可访问的全过程。这是 Sentura 平台第一次在大陆真实环境跑通 cbe 员工的实时执行,暴露并解决了一长串大陆部署 + 团队配置的坑。本文件按"立即恢复速查 → 当前状态快照 → 按时间线的逐坑记录 → 已固化 vs 仅运行时 → 剩余工作 → 可复用学习点"组织。

## Sessions in this file

| Date | Session | Summary |
|---|---|---|
| 2026-06-13 | 大陆云服务器全流程部署 | 阿里云 ECS 4C16G Ubuntu 24.04 部署三个 cbe 员工,DeepSeek 驱动,Docker sandbox,Dashboard 经隧道可访问。解决 OpenClaw 缺包/版本校正、Docker Hub 大陆超时、apt 源、buildx、tool profile、pnpm 11 build、隧道等约 15 个坑。冒烟成功(DeepSeek 在 Docker sandbox 里回复"部署成功")。 |
| 2026-06-13 | 压测前审计修复 + 压测 Sweep 1 | 4 P0+P1-4 修复落地源码+服务器(302/302);压测 Sweep 1 走 gateway 生产路径,扫并发 1/4/8/12/30 → 369 请求 100% 成功、~75 任务/分钟天花板、优雅排队、**gateway 内存是单台瓶颈**(非 CPU/容器/429)。详见 [审计+修复](pre-loadtest-audit-2026-06-13.md) 与 [压测报告](loadtest-report.md);驱动 `scripts/cbe-loadtest.mjs`+`cbe-loadmon.sh`。下一步 Sweep 2 提 maxConcurrent 找 DeepSeek 真天花板。 |

---

## ⚡ 立即恢复速查 (Quick-Resume Cheat Sheet)

> 上下文压缩后,只看这一节就能继续。

### 服务器
- **公网 IP**: `47.96.40.237` (阿里云 ECS,华东1 杭州)
- **内网 IP**: `172.18.207.110`
- **实例**: `sentura跨境电商agent测试`,id `i-bp1citn6o5me932idgz5`,规格 `ecs.g9i.xlarge` (4 vCPU / 16 GiB),Ubuntu 24.04,系统盘 100GiB ESSD,**按量付费**(不用记得停机),安全组只开 SSH(22),带宽 5Mbps 按流量。
- **登录**: `ssh -i ~/.ssh/sentura.pem root@47.96.40.237` (密钥在本地 mac `~/.ssh/sentura.pem`,权限 400)
- **备用控制台**: 阿里云 Workbench(网页 SSH,走内部通道,安全组配错也能进)

### 代码在服务器哪里
- 仓库: `/root/sentura`(从 GitHub `Sentura-Inc/Sentura-Platform` 的 `ecommerce` 分支浅克隆 + 本地 11 个改动文件 rsync 补丁)
- OpenClaw: `/root/sentura/openclaw`(补齐了 18 个上游核心包,见下)
- OpenClaw 状态目录: `/root/.openclaw`(openclaw.json + .env + workspace + sessions)

### 怎么重启各服务(都用服务器端脚本,避开 SSH 抖动)
```bash
# 网关 (gateway) — 监听 127.0.0.1:18789
ssh -i ~/.ssh/sentura.pem root@47.96.40.237 'bash /root/gw-restart.sh'   # 输出 LISTENING_after_N

# Dashboard — 监听 *:3000,客户端 gateway 指向 ws://localhost:28789(隧道端口)
ssh -i ~/.ssh/sentura.pem root@47.96.40.237 'bash /root/dash-dev2.sh'    # 输出 DASH_LISTENING_after_N

# 员工冒烟(cbe-accio-memory 回 DeepSeek 一句话)
ssh -i ~/.ssh/sentura.pem root@47.96.40.237 'nohup bash /root/smoke.sh >/dev/null 2>&1 &'
# 然后看 /root/smoke.out
```
服务器端脚本(都在 `/root/`): `gw-restart.sh` `dash-dev2.sh`(或 `dash-dev.sh`) `smoke.sh` `dash-install.sh` `dash-fix.sh`。

### 怎么在本地 mac 浏览器看 Dashboard
1. 本地 mac 的 3000/18789 **被用户自己的本地 dev server 占用了**,所以隧道用备用端口 13000/28789。
2. 建隧道(macOS 没 setsid,用 `ssh -f`):
```bash
ssh -i ~/.ssh/sentura.pem -f -N -o ServerAliveInterval=20 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes \
  -L 13000:localhost:3000 -L 28789:localhost:18789 root@47.96.40.237
```
3. 浏览器打开 **http://localhost:13000**(不是 3000)。三个工作台路由 `/client-demos/cross-border/{lead-discovery,screening,accio-memory}` 都验证过 HTTP 200。
4. 隧道断了(本地 13000 不再监听)就重跑步骤 2。**不要用后台任务方式跑隧道**(会被 harness 回收);`ssh -f` 是独立守护进程。

### 模型 / 密钥
- 三个 cbe 员工 + 所有 meta-agent 主模型 = `deepseek/deepseek-chat`,每个 cbe 还挂 `qwen/qwen3.5-plus` + `moonshot/kimi-k2.6` 可选。
- DeepSeek key 在 `/root/.openclaw/.env` 的 `DEEPSEEK_API_KEY`(35 字符 `sk-...`,实测 `GET api.deepseek.com/models` 返回 200)。Tavily 等其它 key **未配**。
- platform_admin: `admin@sentura.local`,userToken `bbd9f1f8-b2f4-4b60-b761-1d94f35b2949`(也写进 `sentura/dashboard/.env.local` 的 `NEXT_PUBLIC_SENTURA_ADMIN_TOKEN`)。

---

## 当前状态快照 (2026-06-13 验证)

| 组件 | 状态 |
|---|---|
| gateway | 运行中,`127.0.0.1:18789` loopback |
| dashboard | 运行中,`*:3000`(next-server,Next.js 16.2.2 dev/Turbopack) |
| Docker | 29.1.3 active;镜像 `openclaw-sandbox:bookworm-slim` (346MB) + `debian:bookworm-slim`;sandbox 容器 `Up About an hour` |
| Docker 镜像加速 | `/etc/docker/daemon.json` = daocloud + 1ms + dockerproxy |
| openclaw/packages | 21 个(补齐 18 上游 + 团队 3 个 SDK) |
| cbe-accio-memory 配置(运行时) | model `deepseek/deepseek-chat`;`tools.profile: minimal` **但 alsoAllow=true(agent+sandbox 两层)**;`sandbox.mode: non-main`(Docker) |
| openclaw.json 备份 | `.bak` `.bak.1~4` `.last-good` `.pre-alsoAllow`(在 `/root/.openclaw/`) |
| 本地隧道 | `ssh -f` PID 1086,转发 13000→3000 / 28789→18789 |
| 本地仓库 | 分支 `ecommerce` @ `a43feb2f`,**11 个文件未提交**(国产模型配置改动,见下) |

---

## 逐坑时间线 (Chronological Issue Log)

### 0. 买服务器(决策)
- 选阿里云 ECS,4C16G(g9i.xlarge,通用型 1:4 内存,Node 服务吃内存),Ubuntu 24.04,100GB ESSD,按量付费,杭州。
- 安全组:去掉 RDP(3389,Windows 用的),只留 SSH(22),HTTP/HTTPS 不开(测试走 SSH 隧道)。可信系统取消(否则要 RAM 角色)。宝塔/Docker 扩展不选(自己装)。
- 决策前定了两件事:① LLM 换大陆可用的(选 DeepSeek 主力);② 地域选大陆测最终形态。

### 1. 连通性冒烟(决定去留)
服务器上 `curl -m 8` 逐个测,结果:`api.deepseek.com` 401(可达)、`dashscope.aliyuncs.com` 404(可达)、`api.moonshot.cn` 200、`api.tavily.com` 200、`data.sec.gov` 403(可达)、`rdap.org` 302、`api.company-information.service.gov.uk` 401、`registry.npmmirror.com` 200、`github.com` 200。**全部可达**,继续(没必要降级香港)。

### 2. 服务器环境
- 装 Node **v24.9.0**(从 npmmirror `cdn.npmmirror.com/binaries/node/latest-v24.x` 下载 tar.xz,解压到 /usr/local)+ npm 11.6.0 + pnpm **11.5.3**。npm/pnpm registry 全局指向 npmmirror。
- apt 基础包: git curl rsync build-essential htop tmux jq。

### 3. 代码上传
- rsync(本地 mac→杭州)极慢(~37KB/s,日本线路拥堵)。
- 改用服务器端 `git clone --depth 1 --branch ecommerce --single-branch`(token 经 stdin/credential helper 注入,不进 ps/history)→ 成功 307MB。第一次 clone 遇 `early EOF`,重试第 1 次成功。
- 杀掉 rsync,把本地 11 个已改文件(国产模型配置)用 rsync `--files-from` 补到服务器。

### 4. OpenClaw 构建 — 坑①:缺 18 个核心包
- `pnpm ui:build` 报 `@openclaw/media-core@workspace:* ... no package named ... in the workspace`。
- **根因**: `.gitignore:17` = `openclaw/packages`,整个目录被 git 忽略;`pnpm-lock.yaml` 声明 21 个 workspace 包,git 里只 force-add 了 3 个 SDK 包(`plugin-sdk`/`memory-host-sdk`/`plugin-package-contract`),**缺 18 个核心包**(agent-core、llm-core、media-core、gateway-client/protocol、normalization-core 等)。
- gitignore 注释自证这是**有意设计**:"The whole `openclaw/` tree is wiped on upstream re-pull" — 团队约定 openclaw 从上游 re-pull,packages 不入 git。团队成员本地工作区一直留着这些文件,所以没人发现 fresh clone 构建不了。GitHub 远程 `ecommerce` 分支也只有 3 个包(已核实)。
- 本地 mac clone 和旧备份 `~/Agent Factory/Sentura/` 都只有 3 个,旧备份版本还不匹配(4.19 vs 6.2)。npm 上没有这些私有包(404)。
- **用户授权**"从官方拉"。

### 5. OpenClaw 构建 — 坑②:版本校正 beta.1 → alpha.1
- 从官方 `github.com/openclaw/openclaw` `v2026.6.2-beta.1` 取 packages 补齐 21 个 → `pnpm build` 报 TS2322 `Property 'supportsPromptCacheKey' is missing in type 'ResolvedOpenAICompletionsCompat'`(`src/llm/providers/openai-completions.ts:1242`)。
- **根因**:团队 vendored 的 `src/` 比 beta.1 旧。诊断对比官方各 tag 的 `packages/llm-core/src/types.ts`:`v2026.6.2-alpha.1` = `supportsPromptCacheKey` **0 次**,`alpha.2`/`beta.1` = 1 次。团队 src 的返回对象不含该字段 → **团队实际 vendored 的是 alpha.1**(CLAUDE.md 标的 "2026.6.2" 是大版本号)。
- **修复**:删掉补进的 18 个 beta.1 包(保留团队 3 个),从 `v2026.6.2-alpha.1` 重补 → llm-core 确认 0 次该字段 → `pnpm install && pnpm ui:build && pnpm build` 全绿(build-all tsdown 134s)。
- **复用要点**:补上游包必须匹配团队 vendored 的精确 tag;用一个版本特有的符号(这里 `supportsPromptCacheKey`)grep 各 tag 定位。

### 6. Sentura 层构建 + 测试
- 根 `pnpm install` → `cross-border-intel` MCP build → MCP 测试 **17/17** → `scripts/test-cross-border-agents.ts` **296/296**(含我们今天加的国产模型断言,证明配置在服务器生效)。

### 7. DeepSeek key
- onboard 前先建 `~/.openclaw/.env`(权限 600)。用户在 Workbench 用 `read -rs`(不回显不进 history)粘 key。
- **第一次污染**:长度 105 + 含空白,`GET api.deepseek.com/models` 返回 401。清掉,给加强命令(`tr -d '[:space:]'` + `sed` 防重复)重粘 → 长度 35,`sk-` 开头,**HTTP 200 验证通过**。

### 8. onboard
- `node scripts/run-node.mjs onboard --non-interactive --accept-risk --auth-choice deepseek-api-key --deepseek-api-key "$DEEPSEEK_API_KEY" --gateway-bind loopback --skip-channels --skip-daemon --skip-health`。
- 生成 `~/.openclaw/openclaw.json`,默认模型 `deepseek/deepseek-v4-flash`,gateway loopback。

### 9. sentura-setup
- `SENTURA_CBE_AGENT_MODEL=deepseek/deepseek-chat SENTURA_META_AGENT_MODEL=deepseek/deepseek-chat bash scripts/sentura-setup.sh`。
- 注册 5 meta-agent(creator/tuner/orchestrator/mcp-builder/data-scavenger) + zuolian + 3 cbe 员工(全 deepseek/deepseek-chat,cbe 带 qwen/kimi 可选),9 个 Sentura 扩展,platform_admin,`cross-border-intel` MCP(command=node→dist/index.js),三个 cbe 绑 webchat。

### 10. Gateway
- `OPENCLAW_SKIP_CHANNELS=1 node scripts/run-node.mjs gateway run --bind loopback --force` → 18789 监听 ~6s。
- **SSH 抖动坑**:交互式重启 gateway 反复 SSH 255 中断;setsid 在 ssh 里输出丢失。**解决**:服务器端脚本 `gw-restart.sh`(`pkill` + `setsid` 脱离 + 自轮询端口),ssh 只触发,脚本内部完整执行。

### 11. 员工冒烟 — 坑③:需要 Docker
- 第一次冒烟报 `Sandbox mode requires Docker, but "docker" not found`。cbe 配 `sandbox.mode: non-main`,OpenClaw 默认 Docker backend。
- **用户决策**(AskUserQuestion):选"现在就装 Docker(真实形态)",而非临时 `sandbox=off`(后者被分类器拦,因削弱安全)。

### 12. Docker 安装 + sandbox 镜像 — 坑④⑤⑥
- 装 `docker.io` 29.1.3 active。
- sandbox 镜像 `DEFAULT_SANDBOX_IMAGE = openclaw-sandbox:bookworm-slim`(`src/agents/sandbox/constants.ts`),**必须本地 build**(`scripts/sandbox-setup.sh` + `scripts/docker/sandbox/Dockerfile`:`FROM debian:bookworm-slim@sha256:f9c6...` + apt 装 bash/ca-certificates/curl/git/jq/python3/ripgrep)。不自动 pull。
- **坑④ buildx 缺失**:`docker.io` 不带 buildx,Dockerfile 用 BuildKit `--mount=type=cache` → 装 `docker-buildx` 0.30.1。
- **坑⑤ Docker Hub 大陆超时**:`registry-1.docker.io ... i/o timeout`。配 `/etc/docker/daemon.json` registry-mirrors(daocloud/1ms/dockerproxy)→ `debian:bookworm-slim` 拉到,**固定 digest `f9c6...` 也拉到**(加速器完整代理历史 digest)。
- **坑⑥ 容器内 apt 卡死**:基础镜像有了,但容器内 `apt-get` 卡在 debian 大陆源(15+ 分钟无进展)。杀掉,用**临时 Dockerfile**(`/tmp/sandbox-aliyun.Dockerfile`,本地 Write 后 scp,不改团队 vendored 文件):FROM 同 digest + `sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources` + 同样 7 个包。`docker buildx build --load` → **成功 346MB**(装的包完全一致,只换源)。

### 13. 员工冒烟 — 坑⑦:tool profile 把工具滤光
- 第二次冒烟:**Docker sandbox 容器成功启动**(`openclaw-sandbox Up Less than a second`)✓,但 `No callable tools remain after resolving explicit tool allowlist`。
- **根因**:`tools.profile: "minimal"`(`src/agents/tool-catalog.ts:357`,`allow: listCoreToolIdsForProfile("minimal")`,**不含 `bundle-mcp`**,而 coding/messaging profile 有)。OpenClaw 多个 `allow` 规则是**层层过滤(交集)**:minimal profile 第一道滤网删了 memory_*/cross-border-intel__*,cbe 的 `tools.allow` 救不回。日志:`removed 10 tool(s) via tools.profile (minimal): cross-border-intel__*`(**MCP 成功注册了 10 个工具,只是被 profile 滤掉**)。
- **正确机制**:`tools.alsoAllow`(`tool-policy.ts:215` `mergeAlsoAllow`,union 追加到 profile.allow,绕过过滤)。这正是 CLAUDE.md 的 meta-agent 模式(Creator 用 `profile: coding` + `alsoAllow`),但 cbe 用了 `profile: minimal` + `allow` — **团队配置 bug**,296 项静态测试查不出(不真跑 agent runtime),只有真实执行才暴露。**说明团队从没在真实 gateway 上跑通过 cbe 员工的实时对话**。
- **修复**:`/root/fix-cbe-tools.js`(本地 Write+scp)把三个 cbe 的 `tools.allow → tools.alsoAllow`(agent 层 + sandbox 层),备份 `openclaw.json.pre-alsoAllow`。

### 14. 员工冒烟 — ✅ 成功
- 第三次冒烟:**`部署成功`** — DeepSeek 通过 cbe-accio-memory 员工在 Docker sandbox 容器里生成的中文回复。一次验证:① DeepSeek 驱动 OpenClaw embedded 员工 ② Docker sandbox 容器运行 ③ alsoAllow 修复生效。
- `AGENT_EXIT=124` 只是 CLI agent 回复后不自动退出被 timeout 杀(回复已打印);Dashboard 的 chat.send 路径有明确请求-响应边界,无此问题。

### 15. Dashboard — 坑⑧ pnpm 11 build + 坑⑨ 端口冲突
- `pnpm dev` 触发的 `pnpm install` 被 pnpm 11 的 build-script 批准机制拦死(`ERR_PNPM_IGNORED_BUILDS`: sharp/msw/unrs-resolver),退出 1。依赖其实"Already up to date"(在 `node_modules/.pnpm`,顶层符号链接只数到 18 个,误判为没装)。
- `dangerously-allow-all-builds=true`(.npmrc)key 不对;`package.json` 的 `pnpm.onlyBuiltDependencies` **pnpm 11 不再读 package.json 的 pnpm 字段**(警告说搬到了 `pnpm-workspace.yaml`)。
- **解决**:绕过 pnpm,直接 `./node_modules/.bin/next dev`(依赖齐全,build 脚本对 dev 非必需)→ 监听 3000。
- **坑⑨ 本地端口冲突**:本地 mac 3000/18789 被用户自己的本地 dev server 占用,且 dashboard 客户端硬编码连 `ws://localhost:18789`(`src/lib/gateway/client.ts:748`)。**解决**:备用端口 — dashboard 重启注入 `NEXT_PUBLIC_GATEWAY_URL=ws://localhost:28789`(写进 .env.local),隧道 `-L 13000:localhost:3000 -L 28789:localhost:18789`,浏览器开 localhost:13000。三路由 HTTP 200。

### 16. 隧道持久化 — 坑⑩
- `run_in_background` 的隧道被 harness 任务管理回收(status killed),浏览器随之"被拒绝"。
- macOS **没有 setsid**(Linux 才有)。改用 **`ssh -f`**(认证后 fork 成独立守护进程,脱离工具生命周期)→ PID 1086,持久。

### 17. 浏览器 hydration 报错(非问题)
- Next.js dev 红色覆盖层 "A tree hydrated but some attributes... didn't match"。diff 显示 `- data-immersive-translate-page-theme="light"` = **用户的「沉浸式翻译」浏览器扩展**注入属性导致 hydration mismatch,不是部署 bug。用户选择忽略(不影响使用)。可选彻底消除:`layout.tsx` 的 `<html>` 加 `suppressHydrationWarning`。

---

## 已固化 vs 仅运行时 (关键:别丢了这个 gap 表)

### ✅ 已在团队源码(本地仓库,但 11 文件未 commit)
今天**部署前**做的国产模型配置改动,在本地源码 + setup 脚本里,但**尚未 git commit**:
- `sentura/agents/cbe-{lead-discovery,buyer-screening,accio-memory}/config.json5`: models 加 deepseek/qwen/kimi
- `scripts/sentura-setup.{sh,ps1}`: `SENTURA_CBE_AGENT_MODEL` 开关 + Qwen/Kimi 别名 + 国产模型白名单
- `跨境电商/API_KEYS_OPENCLAW_SETUP.md`: §5.1.1 大陆模型指南
- `scripts/test-cross-border-agents.ts` + `docs/TESTS.md` + `docs/tests/tests-cross-border-ecommerce.md` + `docs/MEMORY.md` + `docs/memory/cross-border-ecommerce/phase-1.md`: +5 测试 296/296

### ⚠️ 仅在服务器运行时,未回写源码(重跑 setup 会丢)
- **`allow → alsoAllow` 修复**:只改了服务器 `~/.openclaw/openclaw.json`,**没改源 `config.json5` 和 setup.sh**。这是团队配置 bug 的真正修复点,必须回写否则任何重新 setup 的实例都会再犯。
- **Docker sandbox 镜像 build**:`openclaw-sandbox:bookworm-slim` 用临时阿里云源 Dockerfile build 的,这套流程(buildx + registry mirror + aliyun apt 源)没进 repo 的 setup 文档。
- **Docker registry 镜像加速** `/etc/docker/daemon.json`:服务器本地配置。
- **onboard/setup 的运行时配置**:gateway loopback、模型切 DeepSeek 等是部署时环境变量驱动,可复现但没文档化为大陆部署 runbook。

---

## 剩余工作 (Remaining Work)

1. **固化配置到源码**(优先):把 `allow→alsoAllow` 修复回写三个 cbe `config.json5` + `setup.sh`/`.ps1` + 测试;写一份大陆部署 runbook(Docker sandbox 镜像 build + registry mirror + aliyun apt 源 + 国产模型切换)。然后 commit 全部(含未提交的 11 个 + 这些)。
2. **国产 embedding**:`sentura-memory-lancedb` 用 OpenAI embedding,大陆缺 `OPENAI_API_KEY` → 现 fallback `memory-core`(无向量记忆)。换千问 embedding API 让 LanceDB per-agent 向量记忆在大陆可用。
3. **压测**(用户最初核心目标):测 4C16G 在多员工并发复杂任务下的真实容量 / 排队 / LLM 配额瓶颈。**带 Docker sandbox 真实形态压**(数据才代表生产)。注意:OpenClaw 默认 `agents.defaults.maxConcurrent=4`,压测要调 10/20/30 逐档。
4. **次要**:`dida-travel-demo` MCP 启动失败(`Connection closed`,Sitlink 的,不影响 cbe);Dashboard hydration 警告(浏览器扩展,可加 suppressHydrationWarning)。
5. **团队反馈**:fresh clone 因 `.gitignore` 缺 packages 无法构建(需上游 re-pull,且实际是 alpha.1)+ cbe 用 `allow` 应为 `alsoAllow` + sandbox 需 Docker — 这几条值得反馈团队 README/CI。

---

## 可复用学习点 (大陆云部署 OpenClaw/Sentura 的坑库)

1. **fresh clone 缺 `openclaw/packages`**(`.gitignore` 有意忽略,团队约定从上游 re-pull)→ 从官方 `openclaw/openclaw` 对应 tag 补齐;**必须匹配团队 vendored 的精确版本**(本例 alpha.1,不是大版本号 6.2),用版本特有符号 grep 各 tag 定位(本例 `supportsPromptCacheKey`)。
2. **Docker Hub 大陆超时** → `/etc/docker/daemon.json` registry-mirrors(daocloud/1ms 等);加速器能代理固定 digest。
3. **容器内 apt 慢** → 临时 Dockerfile `sed` 把 `deb.debian.org`/`security.debian.org` 换 `mirrors.aliyun.com`(不改 vendored 文件,本地 Write+scp)。
4. **`docker.io` 缺 buildx**(Dockerfile 用 BuildKit cache mount)→ 装 `docker-buildx`。
5. **tool profile `minimal` + `allow` 把 MCP/memory 工具滤光**(allow 是交集滤网)→ 用 `tools.alsoAllow`(union 追加,绕过 profile);agent 层 + sandbox 层都要改。
6. **pnpm 11 拦截原生 build 脚本**(sharp 等)→ 依赖其实已装,绕过用 `./node_modules/.bin/next dev`;或 `pnpm-workspace.yaml` 的 `onlyBuiltDependencies`(package.json 的 pnpm 字段 pnpm 11 已不读)。
7. **macOS 没 setsid** → 隧道用 `ssh -f`(独立守护进程,比后台任务持久;后台任务会被 harness 回收)。
8. **SSH 间歇 255** → 长任务/重启逻辑做成服务器端脚本(`setsid` + 自轮询),ssh 只触发。
9. **本地端口冲突 + 客户端硬编码 gateway URL** → 备用隧道端口 + `NEXT_PUBLIC_GATEWAY_URL` 指向隧道端口。
10. **memory 需 OpenAI embedding**,大陆缺 → 暂 fallback memory-core,生产换国产 embedding。
11. **DeepSeek key 粘贴污染**(带空白/多字符)→ 写入时 `tr -d '[:space:]'`,并实测 `GET api.deepseek.com/models` 返回码验证。
12. **管道吃退出码**:`cmd | tail` 用 `set -o pipefail` 才能捕获 `cmd` 的失败(`set -e` 防不住)。

---

## 2026-06-13 — 大陆云服务器全流程部署(本次会话)

见上方各节。一句话:**从空文件夹到"DeepSeek 在 Docker sandbox 里驱动 cbe 员工 + 浏览器看 Dashboard",全链路在大陆云服务器跑通,踩平约 12 类坑**。核心验证铁证:冒烟回复"部署成功"、三路由 HTTP 200、296/296 + 17/17 测试。最大的两个发现:① 团队 repo fresh clone 构建不了(packages gitignore + 实为 alpha.1);② cbe 员工 `allow` 应为 `alsoAllow`(团队从没真实跑通过 cbe 实时执行)。
