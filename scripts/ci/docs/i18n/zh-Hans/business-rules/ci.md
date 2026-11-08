---
traducao_de: 1c63ebcf9d7719601a0fe7777f0d97952aa6e76e
id: rn-ci
title: 'Regras de negócio — CI'
sidebar_label: CI
description: 'As RNs hospedadas na raiz ci.'
keywords: [regras de negócio, ci]
---

# CI

## PR Gates

### RN-037 — Infra 成为一个领域：Workflows 按提供方生成 CI，Lead 整合为单个 PR {#rn-037}

ADR 0038 模型的第二个实例，继 QA 领域（RN-036）之后——有一个结构性区别：Infra 领域的两个委派**总是**运行（Dockerfile/compose 由 Lead 自己完成——“委派给自己”；CI 流水线由 Workflows 子智能体完成），从不豁免其中之一。`Workflows` 根据上下文的 `gitProvider` 决定流水线格式
（`GetInfraContextUseCase`，从 `project_repositories.provider` 读取——**不是**从 `GitProvider` 的 `capabilities` 读取，后者对 GitHub 和 GitLab 是**相同**的）：`"gitlab"` 生成 `.gitlab-ci.yml`；任何其他值
（`"github"`、`"local"` 或未知）生成 `.github/workflows/ci.yml`。
每个文件在完成前都经过 `validate_infra_file`——Dockerfile 用 hadolint，GitHub Actions 工作流用 `actionlint`
（[ADR 0039](../adr/0039-actionlint-e-validacao-do-pipeline-de-ci-gerado.md)；
`.gitlab-ci.yml` 没有本地校验，这是有文档记录的缺口，而不是半个方案）。

整合：两个委派者的文件按 `path` 合并（冲突时 Workflows 胜出）为**单个** PR——提议 PR 的机制
（`propose_infra_pr`）从“工具直接调用 api”变为“工具通知 Lead，由它整合并调用一次”——api 收到的
`open_infra_pr` 与往常**相同**，逐字节一致
（`ExecuteInfraPrUseCase` 未动）。任何委派者失败（来源
`infra`/`modelo`/`codigo`/`politica`）**永远不会**打开部分 PR——与 RN-036 相同的规则，再往上一层。

每个委派者（即使是对自己委派的 Lead）都被作为一行 `delegations` 追踪——完全按 RN-036 留下的样子复用，只有**一处**修正：
`task_id` 列变为**可空**（Infra 领域在**会话**上委派，infra PR 背后没有 backlog 任务），路由
`POST /internal/sessions/:sessionId/delegations` 不再嵌套在
`/tasks/:taskId` 之下——`taskId` 现在放在请求体中，可选。循环 K
和预算在 Infra 领域没有专门的列（原来的 InfraAgent 从来没有按任务的预算，这项工作也没有引入）。

- **位置：** `apps/engine/lib/engine/infra/infra_lead.ex`（`consolidar/2`）、
  `infra_lead_server.ex`（接线）、`workflows_agent.ex`、
  `tools/validate_infra_file.ex`（按扩展名分派）、
  `apps/api/src/application/use-cases/execution/get-infra-context.use-case.ts`
  （`gitProvider`）、`record-delegation.use-case.ts`（`taskId` 可选）
- **测试：** `apps/engine/test/engine/infra/infra_lead_test.exs`（合并与阻塞，纯函数）、`infra_lead_server_test.exs`（接线：单个 PR 包含两组文件、两个委派、`gitProvider: "gitlab"` →
  `.gitlab-ci.yml`、Workflows 失败 → 没有 PR）、`workflows_agent_test.exs`
  ——以及 `ExecuteInfraPrUseCase`/`InfraGateRunner`
  契约未改变的证明：`execute-infra-pr.use-case.spec.ts` 和
  `infra_gate_runner_test.exs` **完全不修改**即通过
- **来源：** [ADR 0038](../adr/0038-hierarquia-de-agentes.md)、[ADR 0039](../adr/0039-actionlint-e-validacao-do-pipeline-de-ci-gerado.md)

在 `apps/web` 一侧（第 8d 阶段）：团队面板以与 QA（RN-036）相同的方式分组 `infra`/
`infra-workflows`，信息流叙述该领域的委派——使用 `apps/web/src/lib/agents.ts` 中同一个 `AREAS`/`areaFor` 注册表，UI 中没有 Infra 专用代码。

---

## `dbre` 角色变成两个机械脚本（RN-400..403，ADR 0093）

### RN-401 — linter 不是 CI gate：它扫描整个仓库，而不是 PR 的 diff {#rn-401}

针对仓库中真实的迁移运行 `pnpm --filter api lint:migracao` 会在已合并并接受的迁移中**发现**三处（`0006_whole_princess_powerful.sql:22` 和 `0034_quick_saracen.sql:33`——
`DROP COLUMN`；`0007_groovy_bullseye.sql:2`——`ALTER COLUMN ... SET DATA
TYPE`）。这不是要顺手修正的缺陷（与 CLAUDE.md 中保护 Z/AD/AE 发现的规则相同）：这些是已被接受的迁移，删除它们会抹去为什么做出该决定的证据。这也是为什么脚本以 `!= 0` 退出，却**没有**接入
`.github/workflows/ci.yml`——一个使整个仓库失败的 gate 会永远让每个 PR 失败，原因却是一个不属于该 PR 的发现。要成为真正的阻断 gate，需要把范围限定到针对 PR 基线的 **DIFF**（与
`scripts/ci/pr-police.ts` 相同的技术），留待 `dbre` 需要**阻断**合并时再做——如今它是手动意见，不是自动判定。

- **位置：** `apps/api/scripts/lint-migracao.ts`（`principal`，文件末尾的退出码）；决定记录在文件头和 ADR 中
- **测试：** 不适用于 CI（没有步骤）；针对真实仓库的手动运行记录在 ADR 0093 的“后果”一节
- **ADR：** [0093](../adr/0093-dbre-linter-de-migracao-e-relatorio-de-backup.md)

## 仪表盘上的“N 个智能体在线”——**实时**状态，从不是历史在场（RN-409，ADR 0097）

### RN-411 — 第四个待处理工作信号：dev agent 说的是 `dev.*`，而不是 `agent.status` {#rn-411}

这是通过**真实**使用而非测试发现的：在一个执行会话中，五个 dev agent 启动后变为 `idle_tripped`（[RN-047](engine.md#rn-047) 的熔断器，卡住等待用户手动解除某个任务的阻塞），而 30 秒的心跳
（`Engine.Sessions.SessionServer.handle_info(:heartbeat_timeout, state)`）在工作——以及对人的决定的等待——仍在继续时，从底下关闭了会话。

`GetSessionPendingWorkUseCase` 针对同一问题早已有第三个信号
（[RN-064](web.md#rn-064)）：智能体已激活、之后没有 `idle`，就会保持会话。但这个信号只读取 `agent.status`，即**对话型**智能体（Criativo/PO/Arquiteto/Dev
Lead/UX Designer/Staff/Infra）的词汇。`Engine.Dev.DevAgentServer`（经由
`Engine.Dev.AgentIo`）从不发出 `agent.status`——它在会话事件日志中使用**自己的**词汇：`dev.started`、`dev.working`、
`dev.awaiting_gate`、`dev.awaiting_approval`、`dev.idle`、
`dev.idle_tripped`、`dev.blocked`、`dev.blocked_by_container`、
`dev.error`。一个有 dev agent 正在工作**或**卡住的执行会话，按第三个信号总是返回 `pending: false`，因为它根本没有 `agent.status`。

**第四个**信号查找会话中已出现的每个 `actor.id`
（`dev-<modulo>`/`dev-<modulo>-2`，与
[RN-195](web.md#rn-195) 相同的键）的**最后一个** `dev.*` 事件——与第三个信号相同，但针对多种事件类型而不是一种，因为 dev agent 的状态不是**一个**带可变 `payload.status` 的类型，而是每次转换各自不同的事件**类型**。标准：当最后一个是 `dev.working`、`dev.blocked` 或 `dev.idle_tripped` 时 `pending: true`——三者都意味着“有工作在进行，或需要人来行动”，而卡住等待解除阻塞**就是**待处理工作（这正是会话在真实执行中被关闭时用户正在做的事）。只有
`dev.idle`（没有任何任务可取，真正排空了）不计入。

`dev.awaiting_gate` 和 `dev.awaiting_approval` 作为最后一个事件，最初**不**触发这个信号——它们被排除在当时决定的标准之外。`awaiting_gate` 是一个**已知**的残余缺口；[RN-412](api.md#rn-412) 关闭了它，连同 `awaiting_approval`（通过一个新论据，而不是原来的那个——见 RN-412）。

`dev.blocked_by_container` 是**之后**加入的，基于同样的论据和同样真实的发现。该类型诞生于
[RN-502](engine.md#rn-502)/[ADR 0143](../adr/0143-agentes-de-dev-so-depois-do-container.md)——dev agent 在项目有已记录的 `running` 容器之前不认领任务——而用例的 `DEV_EVENT_TYPES` 列表没有跟上。由于用例**查询**的正是这个列表，该事件变得不可见：api 甚至看不到它来忽略它。在 `exp004` 的真实运行中（会话
`f782257e`），五个 dev agent 在 22:41:38 发出了 `dev.started` 和
`dev.blocked_by_container`，engine 在 22:42:07 因
`heartbeat_timeout` 关闭——整整 30 秒——而该会话的事件在 13 分钟和 32 分钟后仍在到达。每个智能体最后一个**可见**的事件是 `dev.started`，它被有意排除在标准之外。五个智能体都在等待一个**人**启动容器，这正是其他信号已在使用的待处理工作的定义。

关于该列表是“完整的词汇，经直接阅读 engine 代码确认”的断言，在写下时是真的——而正是它悄悄地过时了。现在让它保持为真的是**机制**：`scripts/ci/vocabulario-de-eventos-dev.spec.ts` 从 `apps/engine/lib/**/*.ex` 提取 `dev.*` 类型，并在它们与用例的两个列表不一致时失败，指出缺少的类型。它**比较**而不是**生成**（`agent-areas.ts` 的先例），因为这一对中只有一半是可推导的：`DEV_EVENT_TYPES` 是机械的，`DEV_PENDING_TYPES` 是判断——哪些状态意味着“需要人来行动”。

**同一种**漂移在 **WEB** 中还有第三个实例，该机制已经把它也覆盖了。`DEV_STATUS_EVENTS`
（`apps/web/src/lib/agent-status.ts`），团队面板用它来说明每个 dev agent 的状态，也不认识
`dev.blocked_by_container` 和 `dev.awaiting_approval`——而在那里后果不是不可见，而是**撒谎**：两者都落入 `switch` 的
`default: return 'trabalhando'`，于是在 `exp004` 中，面板说五个已经停了好几个**小时**、等待人启动容器的 dev agent 正在工作。两者都映射到
`aguardando`，与 `dev.awaiting_gate` 已经使用的状态相同（智能体在它**之外**的某件事发生之前不会继续），`AgentStatus` 中没有新状态；`dev.error` 以前不在任何列表中，因而让面板回退到之前的 `dev.working`，现在映射到 `falhou`。列表不再是列表：它变成了**映射** `tipo -> AgentStatus`，这去掉了 `default`，使得不回答一个类型意味着什么就无法添加它。交叉测试获得了 engine × web 这一对，还有一项 api 没有的要求——对每个类型做出**显式决定**，要么映射，要么在 `DEV_STATUS_EVENTS_FORA` 中声明（`tipo -> motivo`，目前为空）——因为在面板中，某个 `dev.*` 类型**可以**合理地无关紧要；不可以的是因为遗忘而被排除。

- **位置：** `apps/api/src/application/use-cases/sessions/get-session-pending-work.use-case.ts`
- **测试：** `apps/api/test/application/use-cases/sessions/get-session-pending-work.use-case.spec.ts`
  （dev agent 以 `dev.working`/`dev.blocked`/`dev.idle_tripped`/`dev.blocked_by_container`
  作为最后一个事件 → `pending: true`，包括 `exp004` 场景中的五个智能体，以及 `dev.blocked_by_container` 胜过之前的
  `dev.idle`；`dev.idle` → `pending: false`；没有 `dev.*` 事件的会话保持之前的行为；只有每个智能体的**最后**一个事件重要；`dev-<modulo>-2` 也能保持会话；会话之间的隔离）、`scripts/ci/vocabulario-de-eventos-dev.spec.ts`（engine 的 `dev.*` 词汇 × api 的两个列表**以及** × 面板的映射，外加证明 `DEV_STATUS_EVENTS_FORA` 这一阀门的三个构造用例，如今没有任何真实数据会用到它）以及
  `apps/web/src/lib/agent-status.test.ts`（`dev.blocked_by_container` 和
  `dev.awaiting_approval` → `aguardando`，`dev.error` → `falhou`，从不是
  `trabalhando`；以及最新的事件继续起决定作用）
- **来源：** 通过真实使用发现——一个真实执行会话，五个 dev agent 处于 `idle_tripped`，在用户仍在手动解除任务阻塞时被心跳关闭；以及后来在 `exp004` 中，五个处于 `blocked_by_container` 的 dev agent，同样的机制

---

## RAG 检索留下痕迹，痕迹冻结权重（RN-479..481）

### RN-498 — RAG 的 golden-set 在 CI 中真正运行，**定时**——gate 仍然是 `warn` {#rn-498}

RN-490 记录了 RAG 的 golden-set（ADR 0132）以手动 `mix
golden_set.rag` 诞生、“从不在 CI 中”，原因与 QA 的 golden-set（ADR 0123）相同：没有 API LLM 的密钥或新的基础设施，就无法在 CI runner 中运行真正的 Ollama。这条 RN 关闭了这一半——只针对 RAG，从不针对 QA——用一个专门的工作流
（`.github/workflows/golden-set-rag.yml`，`schedule` + `workflow_dispatch`），在真实的 Ollama 服务中拉取 `nomic-embed-text`（与产品其余部分固定的版本相同，如今是 `0.34.4`），并真正运行 `mix golden_set.rag`。

**让这对 RAG 可行而对 QA 不可行的区别：** RAG 的 golden-set 只调用 **embedding** 模型——CPU、确定性、没有采样——从不调用做判断的**聊天**模型，而那正是 QA 的 golden-set 所需要的（昂贵，本质上测量的是非确定性的东西，正如 ADR 0123 本身记录的真实轮次在 6 次中命中 1 到 5 次不等）。`ubuntu-latest`，没有任何 GPU，在这里足够——对 QA 则不够。QA 的 golden-set 因这条 RN **没有任何改变**：仍然完全手动，在 CLAUDE.md 中是 `TODO(humano)`。

**`severidade: warn`（`apps/api/config/gates.yml`）**仍然**是 `warn`，而原因变了。** 不再是“没有带 LLM 的 CI”——而是节奏：工作流是**定时**的（每晚 + 手动触发），从不按 `pull_request` 运行。`block` 会承诺一个并不存在的合并锁——与第 2 步时已经成立的推理相同，现在应用于正确的原因。检索命中率的回退会在 24 小时内（或立即，通过 `workflow_dispatch`）变成可见的趋势信号，从不是阻断 PR 的 gate——这一权衡被产品负责人明确接受，考虑到每个窗口都要拉取模型并运行 17 次检索（几分钟）的成本。

**工作流中不需要生成任何密钥。** `seed-golden-set-rag.ts`
从不定义 `NODE_ENV`，而 api 在生产中会以示例字面值拒绝的四个密钥（RN-114）只在
`NODE_ENV === 'production'` 时才检查——脚本落入开发分支，毫无怨言地使用开发字面值，不同于 `docker/smoke.sh`，它有意以 `NODE_ENV=production` 启动，因此用
`openssl rand` 生成自己的密钥。

**`test_helper.exs` 中对 `:golden_set_rag` 标签的永久排除（RN-490）不变。** 它保护普通的 `mix test`——包括任何有 Ollama 运行的开发者的机器——从不保护新的工作流，后者显式调用 `mix golden_set.rag`，与一直以来手动运行时所需的方式相同。

**测量后修正：上面的工作流一次都没有绿过。** 连续五次定时运行（2026年9月5日至9日）都失败了，而且有**三个**叠加的缺陷，每一个都掩盖了下一个：

1. **`mix golden_set.rag` 是一个调用 `test` 的别名，而 Mix 在 `:test` 环境之外拒绝这样做**——`** (Mix) "mix test" is running in the "dev"
   environment`——在运行任何东西之前。`apps/engine/mix.exs` 中的 `def cli` 改为为**两个** golden-set 任务声明 `preferred_envs`：正是这一点让这条简短的、各处唯一记录的命令无需环境前缀就能工作。要求调用者使用 `MIX_ENV=test`，就是把修正转嫁给所有教授这条命令的文字——以及再次忘记的人。
2. **作业从未启动 api**，而当 `API_URL` 无响应时测试会**跳过**（ADR 0132 中声明的环境前提）。修正第 1 项之后，作业会在什么都没测量的情况下变绿。现在它真正启动 api（构建、`node dist/main.js`、等待 `/health`）——满足前提，而从不放宽测试，那会是为了适应 CI 而改变判断。真正做工作的仍然是 `seed-golden-set-rag.ts`，它启动自己的 Nest 上下文；这个实例的存在是为了响应 `/health`。
3. **种子因镜像门槛的 409 而死。** 它把项目创建为 `runner` 恰恰是为了**逃避**门槛（RN-105），依赖的是 RN-169/RN-421 给予 `mounted`/`runner` 的豁免——该豁免**已被 RN-494 撤销**（ADR 0135），而脚本的注释仍在引用它。现在种子通过真实路径**穿过**门槛：通过 `DecidirImagemDoProjetoUseCase` 决定镜像，即 Arquiteto 的 `choose_project_image` 所用的同一个用例，在它打开的一个 `consultiva` 会话中进行（决定事件需要 `session_id`，它是 `NOT NULL`）——从不手工 INSERT 制品，那会让 golden-set 针对一个生产无法产生的状态进行测量。

**作业改为要求 golden-set 确实**测量**了。** 守卫是结果行（`N/N casos acertaram`），它只在 17 个用例运行之后才打印；没有它，该步骤会失败并点名原因。它是必要的，因为测试从**正文**返回的 `{:skip, motivo}` **是惰性的**——ExUnit 中不存在运行时跳过，看到的是 `Result: 1 passed`。测量时恰恰就是这样：种子因 409 而死时，测试通过了。`excluded` 在这里**不能**作为信号，与 `ci.yml` 中姊妹守卫所检查的相反：合法的输出带有一千多个被排除项，即 engine 的所有其他测试，因标签而被排除。

三项修正之后，在这台机器上沿作业将要走的路径测量：**top-5 中 17/17**，与记录下限的两轮手动运行相同。

- **位置：** `.github/workflows/golden-set-rag.yml`、`apps/api/config/gates.yml`
  （`rag-acertivo`）、`apps/engine/mix.exs`、
  `apps/api/scripts/seed-golden-set-rag.ts`
- **ADR：** [0138](../adr/0138-golden-set-do-rag-em-ci-agendado.md)
- **来源：** 产品负责人的计划，第 2 部分 / 第 3 步

## FASE 29 — 一行安装：为所发布的东西签名

| 情况 | 系统的做法 |
|---|---|
| 无效的状态转换 | 类型化错误（`InvalidSessionTransitionError` 等），转换为 4xx——绝不写入不一致的状态 |
| 代理超出迭代或 token 上限 | 终止并记录带有失败来源的阻塞产物 |
| Task 耗尽 K 次循环 | 带原因地阻塞，不会永远打转（RN-015） |
| LLM provider 中途宕机 | 记录为**基础设施**失败，绝不是「模型停了」（RN-023） |
| 同一假设上的两个并发决定 | 显式冲突（RN-022） |
| engine 副本宕机 | 会话被另一个副本接管，或以 `closed_abnormally / node_shutdown` 结束——绝不成为孤儿 |
| `QaLeadServer`/`SecOpsAgentServer` 在 gate 循环中途宕机 | `Engine.Gates.GateRescuer` 自行恢复——重启区域（未记录裁决）或重新发送丢失的调用（裁决已记录）——无需人工干预（RN-140） |
| 速率限制不可用 | 请求**放行**：守卫防的是滥用，不是越权访问 |
| 速率限制**超出**（429） | 界面说出 api 的回应，轮询停止；应用绝不以更多流量回应限制（RN-088） |
| 凭据错误、账户不存在或账户被锁定 | **同样**的 401 回应，argon2 成本相同（RN-032） |
| 重新提交已使用过的 refresh | 族被吊销并产生安全事件；合法用户也会被登出（RN-030） |
| 没有服务密钥的内部流量 | api 返回 403，engine 返回 401——绝不到达 controller（RN-035） |
| provider 在目录同步期间拒绝密钥 | 该 provider 被**跳过**并附失败来源；没有任何模型被标记为消失（RN-041） |
| binding 的模型从 provider 中消失 | 级联落到下一层并「提示」跳过了哪个作用域——绝不静默更换模型（RN-041） |
| 模型价格变动 | 从现在起生效；已记录的成本以及产生它的价格保持不变（RN-042） |
| 创建 handoff 失败（Criativo→PO，Arquiteto→Infra/Dev Lead） | 持久的 `agent.error`，代理进程「继续」存活；之前已记录的内容（product_brief、规则）不会丢失（RN-116） |
| **挂载文件夹**项目路径位于 `BRABO_PROJECTS_BASE` 之外 | 创建被**拒绝**（400），点名基目录并建议 `<base>/<nome>`——项目不会诞生后再卡住（RN-170/RN-501） |
| Infra 启动容器时**挂载文件夹**项目文件夹不可达 | `container_start` 以「点名」的 `failed` 结束（变量、路径、文件夹所有者、下一步），生命周期**不会**进入 `provisioning`（RN-501） |
| 缺少 `BRABO_PROJECTS_BASE` | api 回应 `projectsBase: null`，项目创建**不提供**挂载文件夹模式——绝不提供安装无法兑现的模式（RN-500） |
| 文件夹浏览器收到基目录之外的 `path`（包括前缀陷阱 `<base>2`） | **400** 并点名基目录——格式错误，而不是 403：没有任何角色可以浏览基目录之外（RN-504） |
| 文件夹浏览器收到基目录之内、但 api 无法打开的 `path` | **404** 并说明是两者中的「哪一个」（不存在 / 存在但无法读取）——绝不是带 `fs` 消息的 500（RN-504） |
| 浏览的文件夹只有文件、symlink，或超过 500 个子文件夹 | 列表带着 `arquivos`/`simbolicos`/`truncado` 返回，界面「说明」排除了什么——满是代码的文件夹绝不会显示为空（RN-504） |
| `BRABO_PROJECTS_BASE` 与 Brabo 的检出重叠（两个方向） | `pnpm dev` **拒绝启动**，点名两个路径。api 的任何校验都抓不到这一点：它对照的是 `process.cwd()`，在它的容器中是 `/workspace`（RN-500） |
| broker 中缺少 `BRABO_PROJECTS_HOST_BASE` 且 `mounted` 项目执行 `container_start` | 拒绝并**点名变量**（503，来源 `infra`），不触碰任何容器——绝不落到另一个根，那会指向另一个项目的文件夹（RN-503） |
| 文件夹位于基目录之外的「遗留」`mounted` 项目 | spec 返回 `localizacao.tipo: 'indisponivel'`，原因点名基目录和路径；broker 以 409 拒绝，修复办法是**移动文件夹**，而不是更换模式（RN-503） |
| broker 宕机（它在 `profiles` 下启动，默认「不」启动）且 `mounted` 项目执行 `container_start` | 操作以 `failed` 结束，原因为 `BrokerIndisponivelError` 的原因，绝不是异常——生命周期中没有任何转换（RN-503） |
| 数据库中项目位置不一致（模式/路径对在创建之外被写入） | 执行激活以 **400** 拒绝并附 pt-BR 原因，绝不是没有正文的 500（RN-478） |
| 社交登录：provider 的邮箱匹配现有账户但「未」验证 | 以 403 拒绝，不记录任何关联——未验证的邮箱不是身份证明（RN-274） |
| 社交登录：`state` 无效/过期，或属于另一种「用途」（git 连接流程） | 拒绝，不调用 provider，也不写数据库（RN-273） |
| 会话中没有任何 `product_brief` 就校验需求 | 在记录任何事件「之前」拒绝（400）——还没有可校验的东西（RN-406） |
| 在 dev agent 工作中或卡住时转换 `execution_mode` | 在触碰 permissions.json 或容器生命周期「之前」拒绝（409）——绝不迁移一个活着的代理（RN-447） |
| 附加的本地文件夹超出文件数或总字节数上限 | 拒绝（400），整批——绝不静默截断（RN-456） |
| 本地文件夹中的单个文件过大或扩展名不可识别 | 只是被「跳过」（`filesSkipped`），绝不拖垮整个上传（RN-456） |
| 确认一个已不再处于 `pending_confirmation` 的模型拉取请求 | 拒绝（409）——确认不可重复执行（RN-462） |
| Hugging Face 模型拉取在 Ollama 中失败 | 请求以 `failed` 结束并声明来源（基础设施/模型），目录中不激活任何东西（RN-462） |
| 通过浏览器配置期间 runner 二进制不可用（发布没有资产、GitHub 宕机） | 选定的文件夹和两个配置文件「保留」；界面说明原因，并把指引换成 `npm install -g @brabo/runner` 路径（RN-473） |
| runner 未在等待上限内连接 | 界面说明没有看到，声明这不是缺席的证明，并指向代码标签页——绝不会永远「核实中」（RN-474） |
| runner 文件夹中存在无效的设备密钥（JSON 损坏，或没有 `kid`） | CLI 拒绝并「点名」文件和原因，提供两条出路——绝不是用法块，那是对什么都没配置的人的回答（RN-475） |
| 在存在 bootstrap 行之前创建仓库就失败 | 状态端点报告 `provision_failed`，原因读自 `proposed_action`，`failedStep` 为「空」——没有尝试任何 Gitflow 步骤，点名一个就是捏造（RN-477） |
| bootstrap 的 `step.check` 失败（令牌过期、403、超时） | 行中变为 `status: 'failed'` + `lastError`，event log 中有 `bootstrap.step_failed`——以前它在不触碰任何东西的情况下抛出，界面永远轮询下去（RN-477） |
| 配置在界面上限内未收敛 | 等待在 3 分钟时「停止」，声明这不证明失败，并提供再次查找——不会触发第二个 POST（RN-477） |
| 把一个模型应用到所有代理而 api 拒绝了「其中一部分」 | 通过的行保持已记录并被重新读取；提示说明多少中的多少，并「点名」留下的那些——绝不说「已保存」或「未保存」，那两者都是谎言（RN-476） |
| RAG 搜索遥测的 INSERT 失败 | 搜索**照样回应**，带 `searchId: null`，失败变成来源为 `infra` 的日志——测量工具不会拖垮它所测量的东西，也不会悄无声息地消失（RN-479） |
| 对那次搜索未返回的 `searchId`/`chunkId` 投票 | 有指导意义的 400，不记录任何东西——没有排名的投票无法区分「索引贫乏」与「权重错误」，没有意义的数字比没有数字更糟（RN-480） |
| 在 `vector_available` 一直为 `false` 的窗口中运行 `medir:rag` | **否决（exit 1）**：测量的不是混合搜索，而是它的词法一半，对照它来校准向量权重就是对照另一个系统校准（RN-479） |
| 在没有当前有效 `module_map`、列表为空、模块重复、模块不在映射中或镜像无效（`latest`/无 tag/`rationale` 过短）时调用 `route_modules_to_infra` | 400 点名缺少什么或什么有误——对代理而言是模型会改正的错误 tool-result，绝不崩溃（RN-487） |
| `container_start` 选定了不在 Arquiteto 当前有效路由候选中的镜像 | 操作变为 `failed`，点名被拒绝的镜像并列出有效候选——既不决定镜像也不调用 broker（RN-491） |
| 启动容器时 broker 拒绝或不可用（`BrokerRecusouError`/`BrokerIndisponivelError`） | 操作变为 `failed` 并附 broker 的消息——绝不传播，绝不悬而未决（RN-491） |
| `type: decision_record` 的 `emit_artifact` 缺少 `context`/`options`/`choice`/`consequences` | 错误 tool-result 点名缺少的键——模型在循环的下一轮改正，绝不崩溃（RN-505） |
| 已核实且已连接的 `runner` 项目中的终端/worktree，但「没有」`running` 容器 | 「点名」的拒绝（`RunnerReadiness`），绝不落到裸宿主机——Docker 是真实的前置条件，没有回退（RN-507） |
| `RunnerGit` 在没有 RN-507 三个前置条件的情况下尝试实体化 worktree | 在任何 `exec` 「之前」以点名消息抛出——绝不盲目尝试、让频道超时来解释（RN-507） |
| worktree 清理的周期性作业遇到没有连接 runner 或没有 `running` 容器的 `runner` 项目 | 本轮「跳过」该项目，悄无声息——绝不是错误，绝不停止修剪其他项目（RN-507） |
| 为 `container`/`mounted` 项目，或没有连接 runner 的 `runner` 项目提议 `container_start_via_runner` | Infra Lead 在本地「拒绝」并点名原因，一次也不调用 `propose_action`（RN-508） |
| 没有已决定镜像时批准 `container_start_via_runner`（RN-105） | 操作变为 `failed`，点名缺少决定——绝不调用 engine（RN-508） |
| runner 连接到一个项目，其 `execution_mode` 要求一项它在 `join` 中未声明的能力 | join **被拒绝**，点名该能力并要求更新二进制——致命拒绝，不重试，绝不静默降级（RN-514） |
| runner 声明了「本」服务器不认识的能力 | 该名字被**忽略**，join 通过——比 engine 更新的 runner 可以连接（RN-514） |
| `exec` 被分派给未声明 `exec` 能力的 runner | 以相同的 `exec_result` 格式回应调用方，`exitCode` 126，原因放在 `output` 中——绝不让 `RunnerRouter` 等到超时（RN-514） |
| `pty_*` 被转发给未声明 `pty` 能力的 runner | 消息「不」被投递，`:web` 收到点名的 `pty_error`——绝不会永远「加载中」（RN-514） |
| 镜像目标位于项目的 `workspacePath` 之内，或包含它 | **400** 点名环的方向——两者是同一个拒绝，比较按「段」进行，所以 `/base-outra` 「不」算在 `/base` 之内（RN-515） |
| 在 `execution_mode: container` 项目中声明镜像目标 | **400** 并「点名」原因（源头是服务器上的卷，本地代理看不到它）——绝不接受，也绝不复制（RN-515） |
| 请求体中没有 `mirrorPath` 键的 `PUT .../mirror-path` | **400**——省略会与请求「清除」无法区分，而静默清除就是缺陷；清除是显式的 `null`（RN-515） |
| 以 root 运行 `brabo-runner service install` | **点名的拒绝**，不写文件也不运行命令——服务按设计属于用户，root 会打破产品三道边界的前提（RN-518） |
| 在 Windows（或 Linux/macOS 之外的任何平台）上运行 `brabo-runner service <qualquer>` | **拒绝并点名平台**，说明这是已声明的决定并指向前台运行——绝不是沉默的失败，绝不是什么都没装的「已安装」（RN-518） |
| 在没有有效设备密钥的文件夹中运行 `service install` | **拒绝并点名文件**——服务以密钥认证，绝不用令牌，令牌会留在 unit 中的磁盘上（RN-518） |
| `service install` 期间 `systemctl`/`launchctl` 不可用 | unit 文件**保留**，回答说明没有激活，并点名待执行的命令——删除它会变成「什么都没发生」，而这是假的（RN-518） |
| 没有已安装的 unit 且没有 `--dir` 时运行 `service uninstall` | 回答「未安装」且**不碰任何文件**：没有 unit 的记录，按 `cwd` 猜测会删掉另一个项目的密钥（RN-518） |
| 在 PATH 中没有服务管理器的机器上运行 `service status` | 回答「已安装，但「无法」询问」并使用自己的退出码——「不知道」绝不变成「已停止」（RN-518） |
| `/containers` 页面上从未配置过容器的 workspace 项目 | 以 `registrado: null` 和文字 **"nunca provisionado"** 出现在列表中——绝不是 `stopped`，绝不是「未观察」，也绝不消耗 broker 的 20 次核实之一（RN-521） |
| 在没有已决定 `artifact.project_image` 的项目上点击「启动」 | 按钮甚至不会激活：界面以文字「说明」还需要决定镜像，而不是提议一个已知会以失败告终的操作（RN-521/RN-105） |
| 在 `workspaceVerifiedAt` 为空的 `runner` 项目上点击「启动」 | 按钮惰性，有「自己的」原因（「从来没有本地代理确认过文件夹」）——绝不与「没有已决定的镜像」坍缩（RN-521） |
| 在文件夹已确认但 runner 可能已关闭的 `runner` 项目上点击「启动」 | 界面「提供」按钮并写下保留说明：文件夹的确认不是代理的存在（RN-468），如果它没在运行，操作在被批准时失败（RN-521） |
| `/containers` 页面上角色低于 `maintainer` | 控件惰性，原因以文字说明「一次」；状态、镜像和资源仍然「可见」（RN-521/RN-102，ADR 0064） |
| `brabo-runner --base <caminho>` 的路径是相对路径、带 `..`、等于 `/`、指向文件，或（在 Linux 上）位于 `$HOME` 之外 | **拒绝并点名原因**，以代码 2 退出——现在输入的、无法兑现的明确请求，与被拒绝的 `--dir` 处置相同（RN-529） |
| `--base` 位于本项目文件夹「之内」，或与之相等 | 拒绝 `base-dentro-da-raiz`：每个新项目都会诞生在这个项目之内。「相反」方向（项目文件夹在基目录之内）是正常安排，可以通过（RN-529） |
| `$XDG_CONFIG_HOME/brabo/runner.json` 损坏，或带有守卫拒绝的基目录 | 拒绝在 `stderr` 中「说明」，点名失去的东西，runner **在没有基目录的情况下继续运行**——因为一个它还没用到的配置而拖垮正在服务某个项目的代理是不相称的（RN-529） |
| 存在但未声明 `base` 的基目录文件 | 这是**缺席**，不是拒绝：没有同意基目录的配置，而不是损坏的配置——runner 照常运行（RN-529） |
| 文件夹（`--dir`）位于所配置基目录「之外」的项目 | 仍然**有效**，没有警告：基目录是创建规则，`--dir` 的词法是永久的——与 `project-workspaces-root.ts` 中写下的禁令相同（RN-529/RN-501） |
| 项目段是「绝对」的、带 `..`、指向基目录本身，或通过 symlink 逃出基目录 | 以自己的原因点名拒绝，在双遍检查（词法和 `realpath`）中——绝不接受后重新解释，因为穿过网络的是「段」（RN-529，ADR 0130） |

## 出错时

[FASE 28](../explanation/fase-28-pasta-do-usuario.md) 明文拒绝了一行安装程序，只要产物尚未签名（BRB-005），这就是为什么 [FASE 29](../explanation/fase-29-instalacao-de-uma-linha.md) 在安装**之前**先签名。第 2 次会话，[ADR 0149](../adr/0149-assinatura-dos-artefatos-publicados.md)。

### RN-524 — 发布的产物由工作流身份签名，在同一次运行中校验，校验失败时拒绝而不是警告 {#rn-524}

每个正式 tag 都为它发布的东西签名，并**在发布 Release 之前校验所签的东西**：

- **五个镜像**按 **DIGEST** 签名（本规则写下时是四个；第五个 broker 随 [ADR 0162](../adr/0162-broker-publicado-e-oferecido-pelo-instalador.md) 加入），读自 `.release/images.json`——绝不按 tag。tag 是可移动的指针：为 `:5.0.0` 签名，证明的是签名那一刻该 tag 指向的东西，而不是有人下载时它所指向的东西。digest 是清单早已记录、生产 overlay 早已应用的东西（ADR 0119）；
- runner 的**二进制**（本规则诞生时是五个目标，自 [ADR 0174](../adr/0174-runner-sem-binario-darwin-x64.md) 去掉 `darwin-x64` 后是**四个**）由**一个**签名的 `checksums.txt` 覆盖，而不是每个二进制一个签名——校验了三个而忘了第四个的人无从知道自己忘了；
- 签名是 **keyless** 的（GitHub Actions 的 OIDC）：签名的身份就是工作流本身，不存在托管的私钥。自有密钥对意味着又一个 CI 密钥，而本仓库已经见过一个 PAT 悄无声息地过期并否决了两次 `tag-release` 运行（[ADR 0139](../adr/0139-o-alarme-de-esteira-ganha-destinatario.md)）；
- **校验失败是点名的拒绝，绝不是警告。** 点一下就能接受的警告，就是不存在的校验。

清单**声明它覆盖了什么**。矩阵有意设为 `fail-fast: false`，所以一个没有构建成功的目标不会妨碍其他四个拥有清单——但作业会在日志中点名被排除的目标，因为列出四个而对第五个沉默的 `checksums.txt` 比没有更糟：校验了四个的人会以为自己校验了整个发布。这一半曾是**书面意图加上没有兑现它的机制**：在 `needs: build` 下，一个构建失败的目标不是不妨碍，而是把它「推迟」了一天——见 [RN-565](#rn-565)，它让这一半成真并测出了这个数字。

**位置：** `.github/workflows/release.yml`（步骤「Instalar o cosign」和「Assinar
as imagens publicadas」，`permissions` 块中带 `id-token: write`）；
`.github/workflows/build-runner-binaries.yml`（作业 `checksums`，自 [RN-565](#rn-565) 起**没有** `needs:`——等待的是资产，并有上限）。

**测试：** `scripts/ci/actions-pinadas.spec.ts` 覆盖 `sigstore/cosign-installer` 按 SHA 的固定（旁边带版本注释，它告诉人和 Dependabot 那个哈希是哪个版本）。签名本身只能在真实的 tag 中证明——已声明，与发布流水线的其余部分一样。

**来源：** FASE 29，第 2 次会话。为镜像和二进制关闭 **BRB-005**。「不」覆盖二进制的操作系统*代码签名*（macOS 公证、Windows Authenticode），那需要付费身份，仍在待办中。

## `install.sh` 完成安装（RN-547，FASE 30）

### RN-549 — 干净机器上的 E2E 证明「整个」安装：五个环节、在运行中等待的代理，以及无人回到终端即被接手的第一个项目 {#rn-549}

[FASE 30](../explanation/fase-30-runner-por-maquina.md) 的第 8 次会话，最后一次——也是唯一能回答整个阶段所追问问题的一次：*在一台干净的机器上，`install.sh` 结束时本地代理是否在运行且已配对，人是否无需回到终端就能以 Runner 模式创建第一个项目？* 在此之前，答案是一个书面意图：[RN-547](produto.md#rn-547) 串联了五个命令，并以书面形式声明在它的测试中 `brabo-runner` 是 shell 替身、api 是 `node:http`——*"o que se prova é o ENCADEAMENTO, nunca a integração"*。

**测试装置不是在这里诞生的：它被「扩展」了。** `.github/workflows/install-e2e.yml` 自 FASE 29（[RN-534](produto.md#rn-534)）起就存在，已经在 Actions 的临时 runner 中运行已发布的安装程序——字面意义上就是一台干净的机器，没有 Brabo、没有 `.env`、没有标记。它证明的东西止步于 `.env`：计划、状态、三个绝不删除的承诺、无 TTY 路径，以及在模拟 TTY 下的启动。第二个工作流会为了测量便宜的一面而重复昂贵的一面（等待 Release、下载、校验签名）。

**它「不」在 `pull_request` 中运行，后果是声明出来的，而不是藏起来的。** 安装程序对照 Release 的**已签名** `checksums.txt` 校验自身来源（[RN-526](produto.md#rn-526)），后者只在正式 tag 之后存在；让它在 PR 中运行的唯一方式是给它一扇「跳过」校验的门——[ADR 0150](../adr/0150-instalador-de-uma-linha.md) 拒绝的那扇门，一旦打开就对任何人有效，而不只是 CI。因此：**写下这个 E2E 的 PR 并没有执行它**，它的检查在没有演练其新增内容任何一行的情况下通过。这与 RAG golden-set 的决定（[ADR 0138](../adr/0138-golden-set-do-rag-em-ci-agendado.md)）相同，原因也相同。

**由此有了在 PR 中「运行」的那一半，这就是它存在的理由。** 只在 tag 中运行的工作流，其错误会在 tag 中出现，那时发布已在推出，没人再看那个弄坏它的 PR。`scripts/dev/install-e2e.spec.ts` 测量这个 E2E 悄无声息地腐烂的两种已知方式：有人**放宽**闸门（在触发器中加上 `pull_request`，或传入一个跳过校验的标志），以及有人**改写** `install.sh` 中的一句话——于是工作流中的每个 `grep` 都不再匹配任何东西，断言不是失败，而是「消失」。提示的金丝雀是推导出来的，而不是背下来的：TTY 的回答按文件、**按顺序**传入，安装程序中新增的一个 `read -r` 会让之后的所有回答错位——基目录会变成密码——，所以测试会数提示的个数，并让人去看回答文件。

**E2E 开始证明的东西，每条断言都有归属。** [RN-547](produto.md#rn-547) 的五个环节，逐一针对「真实」的 api 和二进制——账户（[RN-546](produto.md#rn-546)）、在机器上生成的密钥对和盖上的 `kid`（[RN-551](runner.md#rn-551)）、公钥的登记（[RN-552](api.md#rn-552)）以及按机器的 unit（[RN-545](runner.md#rn-545)）。再加上在「磁盘」而不是输出上测量的 [RN-475](web.md#rn-475) 不变量（runner 读取的文件有 `kid`、有 `d`，并且 `finish` 完成时 `.parcial` 已消失），`.env`、标记和日志中都没有密码，以及标记中存在 `ownerEmail`。

**「否定」证明最有价值，那就是待办块的缺席。** [RN-547](produto.md#rn-547) 要求在一个点名的最终块中报告每个失败的环节——并照样以 **0** 退出。一个看退出码的 E2E 会在五个环节坏了四个的情况下给出绿色。*"Nenhuma pendência"* 是断言五个都完成的唯一方式，包括工作流说不出名字的那些。

**代理「在运行」并等待的信号是那「一行」，绝不是管理器的状态——这一选择是本 E2E 的核心决定。**
`perguntarEstado` 把 `activating` 映射为 `rodando`（[RN-088](web.md#rn-088)，有道理：「启动中」不是「已停止」），所以 `systemctl is-active` 和 `brabo-runner service status --machine` 都会对一个两秒后就会死掉的进程回答*在运行*。这恰恰是固定的 `sleep` 所掩盖的竞态，而在这里测量错误的产物——磁盘上的一个二进制、一个写好的 unit——是 E2E 不证明任何东西就给出绿色的最容易的方式。所选的信号是进程在「进入」等待时写下的那一行（[RN-550](runner.md#rn-550)）：它只在代理从磁盘读取了机器密钥、拿到票据、和真实的 api 对话并收到一个「空」列表之后才存在——一次性证明了配对和等待。而且它不是
状态采样：它是已经写进 journal、不会撤销的事实。所以带上限地等待它不是竞态——要么它出现，要么上限耗尽，该步骤失败并显示整个 journal。`service status --machine` 在它**之后**进入，作为退出码回答了运维者将看到的内容的确认，绝不取代它。

**阶段的结果由 API 测量，而不是由浏览器。** 断言的主体是「代理」，不是页面：它观察的是 `GET /runner/projects`（[RN-543](produto.md#rn-543)），api 的一个事实。浏览器会通过「同一」路由创建项目，多一层会因与承诺无关的原因失败的东西——而且不会让断言更强，因为断言仍然是代理 journal 中的那一行。浏览器层是存在的（`e2e/`，[ADR 0120](../adr/0120-e2e-de-navegador-contra-o-compose-de-producao.md)），它回答的是另一个问题（三个源、`httpOnly` cookie、CSRF），有自己的 lockfile，并假定生产 compose 在运行：把它拖到这里，会让安装程序的 E2E 依赖于在一台本应干净的机器上安装的第二个测试装置。证明向导是 web 套件的工作，那里已经覆盖了。这一步测量的是整条链：在终端中诞生的账户**通过登录**，无需任何验证链接；[RN-410](api.md#rn-410) 的个人 workspace 存在；项目以 `runner` 诞生；代理在 [RN-550](runner.md#rn-550) 的 15s/30s/60s 节奏内自行接手它。

**幂等性由 E2E 无需重新安装就能到达的那一半来测量。** api 对第二次 `first-account` 确实回应 `409`——使用「生成」的密码，绝不是常量，因为 `exigirSenhaValida` 在冲突「之前」运行，弱密码会得到 `400`，测量的就是错误的东西。安装程序如何「处理」这个 `409`（保持沉默，而不变成待办）是 HTTP 状态码的分类，在 `install-fechamento.spec.ts` 中针对测试服务器覆盖：在这里重复它需要第二次完整安装，那会走「迁移」路径（[RN-530](infra.md#rn-530)）——经证明的备份、删除、重建——是另一项交付。

**这个 runner 与干净机器之间唯一的分歧来自「环境」，并已点名。** 在真实机器上，安装者有登录会话，`systemd --user` 已经在运行；Actions 作业以非交互方式运行，没有会话，没有会话时 `systemctl --user` 没有可以对话的总线——`service install
--machine` 会因为一个不属于产品的原因变成待办，而 E2E 会「证明」一个实验室故障。`loginctl enable-linger` 让用户管理器运行起来；它不是安装程序的标志，不跳过任何校验，也不改变 unit 的行为。

**编写它时出现了两个缺陷，两者都是不可见的，因为工作流从未运行过。** 第一个在测试装置本身：回答文件以 `nao-migrar` 开头，在干净机器上它会落到「标记」的问题上——它不匹配 `s|S|sim|SIM`，脚本说 *"Nada foi gravado"* 并以 0 退出，而紧随其下的标记断言就会失败。迁移问题位于 `if [ -n "$marcador" ] || [ -n "$sinais" ]` 之下，而在干净机器上两者都为空：这个问题不会出现。已更正为「七个」真实回答。

**第二个是「发现」，有意没有在这里修复。** 已发布的 `install.sh` **无法在干净机器上独自启动任何东西**：它用 `docker compose -f docker/docker-compose.install.yml` 启动栈，这是一个相对于其运行目录的「相对」路径——而这个文件**不是 Release 的资产，不进入已签名的 `checksums.txt`（[RN-524](#rn-524)），脚本也不在任何地方下载它**（它唯一下载的是 `cosign`、清单、自身哈希和 runner 二进制）。compose 还 bind-mount 了 `./postgres/init.sql`，所以是「三个」文件而不是一个。按照 runbook 的 `sh -c "$(curl … install.sh)"` 操作的人，会在已经校验签名、选定基目录并写入 `.env` **之后**，死于 *"no such file or directory"*。修复意味着决定 compose 是成为已签名的资产，还是安装程序改为克隆——这是另一项交付，不是在发现这个漏洞的 E2E 中顺手要做的事。工作流按 tag 手工带来这三个文件，在一个「说明」这是发现的步骤中；PR 中的测试要求两半（该步骤存在，并且安装程序仍在不下载的情况下使用 compose），而安装程序自行获取它们的那一天，测试会失败——那时正确的做法是删除这个步骤，而不是放宽测试。

**「未」纳入的：** 任何跳过来源校验的门；`apps/` 未被触碰（发现变成了报告，而不是顺手的修复）；没有第二个安装程序 E2E 工作流；没有放宽任何闸门——尤其是，E2E 仍然不在 `pull_request` 中。

- **代码：** `.github/workflows/install-e2e.yml:16`（仍然没有 `pull_request` 的触发器）、`:111`（发现的那一步——安装程序不下载的三个文件）、`:172`（systemd 的用户会话，已声明的分歧）、`:204`（带「七个」回答的完整安装）、`:241`–`:245`（RN-547 的五个环节，每行一个）、`:253`（否定证明——没有待办）、`:267`–`:274`（`kid`、`d` 和 `.parcial`，在「磁盘」而不是输出上测量）、`:278`（没有泄露的密码）、`:307`（代理在运行，凭 journal 的那一行而不是管理器）、`:354`（通过 api 的第一个项目，以及代理接手它）、`:415`（第二个账户的 `409`）
- **测试：** `scripts/dev/install-e2e.spec.ts`——在 PR 中运行的那一半：从「文档」读取的触发器（而不是从文本，那会匹配到解释为什么没有 `pull_request` 的注释）、两个文件中都没有跳过校验的标志、工作流与 `install.sh` 之间的语句契约（五个环节加上一贯的四个）、断言所依赖的 `apps/runner` 的两行、交互提示的金丝雀、journal 行与 `service status --machine` 之间的「顺序」，以及 compose 发现的两半。经变异验证：改写安装程序的一句话以及在触发器中加入 `pull_request` 都会失败
- **已「声明」的缺口：** 这个 E2E **不在写下它的 PR 中运行**，它的任何检查都不证明所新增内容的任何一行——第一次真实执行是下一个正式 tag。同样不在范围内，而且不是因为遗忘：经由「迁移」路径（[RN-530](infra.md#rn-530)）的第二次安装程序执行——备份、恢复证明、删除和重建——、macOS（完整步骤是 Linux 的：`launchd`，以及托管 runner 没有的 Docker），以及浏览器
- **ADR：** [0155](../adr/0155-a-primeira-conta-nasce-no-terminal.md)
- **来源：** FASE 30，第 8 次会话——
  [阶段的范围划定](../explanation/fase-30-runner-por-maquina.md)

## 设备密钥获得界面，界面说明吊销的范围（RN-561）

### RN-565 — 已签名的清单随 Release「已有」的东西发出，不等待永远构建不出来的平台 {#rn-565}

已签名的 `checksums.txt`（[RN-524](#rn-524)）是另外两条规则的前提：没有它，`GET /runner-releases/binary` 以 `release_sem_manifesto` 拒绝（[RN-525](produto.md#rn-525)），`install.sh` 拒绝它自己（[RN-526](produto.md#rn-526)）——**在所有平台上，包括那些正常附加了二进制的平台**。一个延迟的清单不是延迟的清单：对在这段间隔内安装的人来说，它就是缺失的清单。

**测量，针对现有的三个 tag。** 在 `v4.0.0`、`v4.0.1` 和 `v5.0.0` 中，`darwin-x64` 目标（`macos-13`）在队列中停留了 **24h00m01s**，被 Actions 的上限取消——三个中都是「同一个」数字，这说明它从未被调度。其他四个作业最多在 **4m18s** 内结束（`v4.0.1` 中的 `linux-x64`，17:38:28Z → 17:42:44Z）。`checksums` 作业带有 `needs: build`：`always()` 保证它会「运行」（被取消的依赖也覆盖在内），却从不保证「何时」运行。

**规则：** 清单作业**不依赖矩阵**。它等待的是 Release 的**资产**，而不是**作业**——带上限——，并发布存在的东西，在日志中点名它没有覆盖的内容。一个目标的缺失是预期的结果（`::notice::`），绝不是错误；**Release** 的缺失仍然是点名的错误，因为这个工作流只「附加」、从不创建；而**没有任何**附加的二进制仍然是错误，因为一个空的 `checksums.txt` 会断言发布没有二进制，而实际发生的是整个矩阵都失败了。

**二进制的上限是 1200 秒，这个数字不是随意的：** 它是 `build` 作业本身的 `timeout-minutes: 20`——一个**有 runner** 的目标在开始后最多可能花费的时间。它有意不覆盖的是**排队**时间，而不覆盖排队时间正是全部要点。所有目标都到达时循环会提前退出，这是正常路径。

**作业「所做」的事情一样都没变。** 它仍然从资产（而不是那里为空的 `dist-bin/`）组装清单，用 `cosign` keyless 签名，并在附加之前校验——[RN-524](#rn-524) 不变，一个清单而不是五个签名。而在上限「之后」才附加的目标也不会成为孤儿：`--clobber` 本来就是为此存在的，重做清单就是用同一个 tag 执行一次 `workflow_dispatch`。

**本规则「不」做的：** `darwin-x64` 仍然构建不出来。更换标签、去掉该平台或为 runner 付费是负责人的决定，而清单不能依赖它——正是因为依赖它，清单才一直发不出来。

> 之后在 AT-065 中测量（2026-09-13，通过演练用的 `workflow_dispatch`）：
> `macos-13` 是没有 runner 的标签（GitHub 已于 2025 年 12 月退役该镜像；在队列中 30 分钟，被取消，run `34769280227`）。`macos-15-intel` 在 3–22 秒内调度并构建，但在 `--self-test-pty` 上失败，因为在 Bun 下，`node-pty` 的 `onData` 不交付子进程的输出（oven-sh/bun#25822，仍开放）；同样的证明在同一 runner 上在 Node 下通过（run `34770476634`）。
> 待定的决定不再是关于 runner 的，而是等待 Bun 还是去掉该平台。上面的规则不因此改变。

> **于 2026-09-27 决定（[ADR 0174](../adr/0174-runner-sem-binario-darwin-x64.md)，AT-065）：
> 该平台已移除。** 矩阵变为「四个」目标，`ALVOS_ESPERADOS` 随之调整——缺失正是对照它来声明的，把 `darwin-x64` 留在那里会让每个清单永远宣布一个本是决定的缺失。Mac Intel 没有 runner（npm 已在 AT-774 中移除）：`install.sh` 说明这一点而不尝试下载，代理 `GET /runner-releases/binary` 以指向 npm 的自己的 400 拒绝 `darwin-x64`，浏览器面板甚至不请求下载。本 RN 的规则不变：它仍适用于任何失去 runner 的目标，而当矩阵、api 的列表、安装程序的 `case` 和浏览器的列表出现分歧时，`scripts/ci/alvos-do-runner.spec.ts` 会失败。

- **代码：** `.github/workflows/build-runner-binaries.yml:283`（作业，现在没有 `needs:`）、`:318`（`timeout-minutes: 40`，容得下两次等待）、`:358`（作业级的 `ALVOS_ESPERADOS`，让两个步骤读取同一个列表）、`:397`（等待的步骤）、`:401`/`:402`（两个上限）、`:410`（缺失的 Release，这是错误）、`:433`（二进制的上限，这是 `notice`）、`:499`（点名未覆盖内容的清单）
- **测试：** `scripts/ci/checksums-nao-espera-a-matriz.spec.ts`——作业没有 `needs:`、两个上限都存在、二进制的上限由 `build` 的 `timeout-minutes` 推导（而不是复制）、它容得进作业自身的 `timeout-minutes`、目标缺失是 `notice` 而 Release 缺失是 `error`、`ALVOS_ESPERADOS` 与矩阵一致，以及本次改动不触及的 ADR 0149 的四项保证（一个签名、附加之前校验、`id-token: write`、清单中的 `install.sh`）。它是「静态」的，其局限在文件顶部声明：该作业只能在正式 tag 中证明，而它从未在任何 tag 中运行过
- **已「声明」的缺口：** 自 [ADR 0187](../adr/0187-runner-sem-binario-win32-x64.md) 起矩阵有「三个」目标（`win32-x64` 按 ADR 0174 的同一模式移除，`ALVOS_ESPERADOS` 随之调整），而 Release 仍然收到**两个**——`darwin-arm64` 已在演练中证明（[RN-688](runner.md#rn-688)），只差一个正式 tag 来演练它。清单诞生时将覆盖两个，并会**说明**这一点，这就是部分与沉默之间的区别。而当整个矩阵都失败时，作业会在拒绝之前耗尽两次等待
- **ADR：** [0149](../adr/0149-assinatura-dos-artefatos-publicados.md)
- **来源：** AT-051（EP-009/HS-035）

## 按功能的回归测试与运行之间的关联（RN-1031..1035，RN-1043..1045）

### RN-1031 — 功能目录与「路径 → 功能」映射放在同一个文件里，spec 通过标签与之绑定 {#rn-1031}

`brabo-qa/funcionalidades.yml` 是唯一来源：每个功能有 `id`（kebab-case，稳定，绝不改名；停用用 `status: aposentada`）、`nome`、`descricao`、`tema`（来自 ADR 的 `temas.yml`）、`status` 和 `caminhos: {<repo>: [globs]}`。它放在 `brabo-qa` 而不是 `brabo-contracts`，因为 contracts 按 TAG 消费，映射的每次调整都会变成一个 tag，并在六个消费方各做一次升级。Playwright 的 spec 通过测试自身的标签（`{ tag: '@f-<id>' }`）与功能绑定，过滤用 `--grep`：目录不保存文件列表。`brabo-qa` 的一个测试会拒绝重复的或不是 kebab-case 的 id、不在 `temas.yml` 中的主题、匹配不到兄弟仓库任何文件的 glob（映射腐烂），以及没有对应条目的 `@f-<id>` 标签；没有 spec 的功能只是被列出。

- **代码：** `funcionalidades.yml:1`（目录与文件契约）、
  `scripts/ci/funcionalidades.ts:29`（`validarCatalogo`）
- **测试：** `scripts/ci/funcionalidades.spec.ts`（校验器）和
  `scripts/ci/qa-regressivo-catalogo-real.spec.ts:12`（真实目录有 14 个
  活跃功能，且 glob 能匹配）
- **ADR：** [0268](../adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **来源：** AT-769（EP-033）

### RN-1032 — 面向 `dev` 的 PR 只运行它触及的功能的回归测试，使用「绝不」被要求的 `Regressivo do brabo-qa` 检查 {#rn-1032}

在目标为 `dev` 的 PR 上，`qa-e2e-gatilho.yml` 的 `regressivo-dev` 作业把 PR 的文件与 [RN-1031](#rn-1031) 的映射交叉比对，并带着被触及的功能触发 `brabo-qa`。结果以 `Regressivo do brabo-qa` 检查的形式返回，由 App 在 `head_sha` 上创建：`success`、`failure`（可见，但合并仍然自由）或 `neutral`（未触及任何内容、仅文档、fork 的 PR、没有 spec 的仓库）。名称有意与 `E2E do brabo-qa` 区分：「main 要求 E2E」的 ruleset 绑定的是那个上下文，而回归测试从不进入任何 ruleset（`rulesets.md` 记录了「不要求」这一行）。该作业带有 `continue-on-error`，`/qa-aceitar` 在 `dev` 上不适用；当映射显示功能被触及而没有任何 `@f-<id>` spec 变化时，App 会发一次提醒评论。

- **代码：** `.github/workflows/qa-e2e-gatilho.yml:74`（作业
  `regressivo-dev`，带 `continue-on-error`）、`scripts/ci/qa-e2e-resumo.ts:22`
  （按模式的检查名称）、`scripts/ci/qa-regressivo-lembrete.ts`（唯一的提醒评论）
- **测试：** `scripts/ci/qa-e2e-resumo.spec.ts`（按模式的名称）和
  `scripts/ci/qa-regressivo-selecao.spec.ts:33`（按映射选择）和
  `scripts/ci/qa-regressivo-lembrete.spec.ts`（提醒）
- **ADR：** [0268](../adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **来源：** AT-769（EP-033）

### RN-1033 — 三条跨领域的文件规则先于映射生效：无、整个目录、无归属 {#rn-1033}

依次为：(1) 文档、`*.md`、`CHANGELOG.md`、`.github/**`（`qa-e2e.yml` 本身除外）、仓库的测试和 `.claude/**` 不触及任何功能，检查结果为 `neutral`；(2) 锁文件和清单、`Dockerfile`、应用入口、schema 与迁移、web 客户端、engine 的 `config/**` 以及 `brabo-qa` 的套件（`e2e/suporte/**`、`playwright.config.ts`）运行整个目录，contracts 的 TAG 升级也归入这里；(3) 没有任何 glob 匹配的路径运行冒烟测试 `instalacao` + `autenticacao`，摘要把它列为「映射中无归属」，以便修正映射。`brabo-contracts` 在自己的 PR 上没有回归测试。

- **代码：** `scripts/ci/qa-regressivo-selecao.ts:67`（`selecionar`）、
  `scripts/ci/qa-regressivo-selecao.ts:43`（`SMOKE`）
- **测试：** `scripts/ci/qa-regressivo-selecao.spec.ts:41`（规则 1）、
  `:55`（按仓库的规则 2）、`:58`（规则 3）
- **ADR：** [0268](../adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **来源：** AT-769（EP-033）

### RN-1075 — `brabo-runner` 由自身的 CI 证明：linux-x64 二进制进入 PR，与 engine 的契约只在 TP-01 中验证 {#rn-1075}

`brabo-runner` 在 `brabo-qa` 中没有 `qa-e2e.yml`、镜像或 `@f-runner`/`@f-projetos` spec；目录回归不会在其 PR 上运行（负责人于 2026/11/08 的决定，选项 b）。PR 由其 `ci.yml` 的 `runner` 作业证明：lint、类型、测试、带 `smoke` 的 `dist`，以及带 `build:bin` + `smoke:bin`（`--self-test-pty`，真实 PTY）的 linux-x64 二进制。**runner ↔ engine 契约**（ticket join、能力、exec、目录）在 PR 上**不会**被验证：只在实时 TP-01 中验证。`funcionalidades.yml` 中的 `runner` 键保留在目录里，仅用于映射。

- **代码：** `brabo-runner` 的 `.github/workflows/ci.yml` 中的 `runner` 作业
- **测试：** 作业本身（日志含 `--self-test-pty` 的 `ok:`）
- **ADR：** [0268](../adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **来源：** AT-853（EP-033）

### RN-1034 — 面向 `main` 的 PR 在 `E2E do brabo-qa` 中运行整个目录，没有 spec 的功能显示为「无覆盖」但不会失败 {#rn-1034}

`E2E do brabo-qa` 检查（[ADR 0267](../adr/0267-o-e2e-do-brabo-qa-e-portao-da-main.md)）运行所有 spec，并生成 `funcionalidade | specs | resultado` 表。目录中没有 spec 的功能以 `sem cobertura` 进入，并且**不会失败**（负责人于 2026/11/06 的决定）：若规则相反，`main` 会连续数周保持红色，`/qa-aceitar` 也会变成例行公事。现有的测试无需改动即可通过；`spec` 或 `ambiente` 的红色仍可通过 `/qa-aceitar` 接受，`digest` 或 `assinatura` 的红色则永远不行。

- **代码：** `scripts/ci/qa-e2e-resumo.ts:28`（表格行中的 `sem cobertura`
  结果）、`scripts/ci/qa-e2e-resumo.ts:22`（`main` 的检查名称）
- **测试：** `scripts/ci/qa-e2e-resumo.spec.ts`（表格和无覆盖
  的行）
- **ADR：** [0268](../adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **来源：** AT-769（EP-033）

### RN-1035 — 面向 `dev` 的 PR 只为自己的仓库发布已签名的 `sha-<12>` 镜像，清理任务删除孤儿镜像 {#rn-1035}

为了让回归测试有东西可运行，api、engine、web 和 broker 的 `ci.yml` 在基线为 `dev` 时也发布 `ghcr.io/viralabs-dev/brabo-<app>:sha-<12 primeiros do head>`，带 Trivy 和 keyless 的 `cosign sign`，与 `main` 相同。fork 的 PR 拿不到密钥：镜像被跳过，回归测试说明「不在 fork 的 PR 中运行」。触发器在 PR 所在仓库使用 `sha-<12>`，在其他仓库使用最新的 `-dev.N`。每次 `synchronize` 都会留下一个孤儿 `sha-*`，因此 `limpeza-ghcr.yml` 会删除所有已关闭 PR 的 `sha-*` 以及超过 7 天的。

- **代码：** `scripts/ci/qa-e2e-imagens.ts:83`（为
  `dev` 和 `hotfix` 选择 `sha-<12>`）
- **测试：** `scripts/ci/qa-e2e-imagens.spec.ts`（按基线的选择）
- **ADR：** [0268](../adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **来源：** AT-769（EP-033）

### RN-1043 — 每个读取其他仓库的运行都在 Summary 顶部发布 `## Vínculos`，且该辅助程序绝不让作业失败 {#rn-1043}

通过 `brabo-ci` 的 action `vinculos`，每个关联仓库的作业的 Summary 都带有 `## Vínculos` 表（来源、带链接的兄弟仓库 `repo@SHA`、目标以及被触发的运行）和一张 Mermaid 图，紧跟在 checkout 之后。所有值在进入 Markdown 之前都要过正则：仓库 `viralabs-dev/brabo(-x)?`、40 位十六进制的 SHA、数字 PR、组织的 GitHub URL、操作者。不匹配的变成 `?` 并产生 `::warning::`。无效的 `origem` 只是被丢弃并给出警告。该步骤带有 `continue-on-error`：辅助程序绝不让作业失败。在 `brabo` 中，`docs-check`、`docs-deploy`、`docs-audit` 和 `regenera-gerados` 传入 `montar-layout.sh` 写下的 `.git/irmaos-sha.lst` 中的 SHA（[ADR 0274](../adr/0274-os-gerados-leem-os-irmaos-por-uma-trava-de-shas.md)），而 `release.yml` 则按路径传入 `infra`。

- **代码：** `scripts/ci/vinculos.ts:57`（`montar`）、`.github/actions/vinculos/action.yml:31`
  （`continue-on-error`）、`scripts/ci/validar-payload.ts:112`（`validarOrigem`）、
  `.github/workflows/docs-check.yml:89`（`brabo` 转交兄弟仓库）
- **测试：** `scripts/ci/vinculos.spec.ts`（fixtures、恶意值、空
  来源）和 `scripts/ci/validar-payload.spec.ts`
- **ADR：** [0271](../adr/0271-os-runs-do-actions-mostram-os-vinculos-entre-os-repos.md)
- **来源：** AT-773（EP-033）

### RN-1044 — dispatch 或 tag 的目标运行带有含来源的 `run-name`，dispatch 的关联以 `c=<run_id>-<attempt>` 的形式写在名称里 {#rn-1044}

可复用工作流的 `run-name` 会被忽略：以调用方的为准。`brabo-qa` 的 `e2e-pr.yml` 命名为 `E2E ← <repo>#<pr> · <sha7> · <ator> · c=<correlação>`（dev 模式下为 `Regressivo ← …`）；由 tag 触发的运行，如 `brabo` 的 `release` 和 `install-e2e`，命名为 `release <tag> ← tag do carimbo`。`repository_dispatch` 返回 204 且没有 id，`client_payload` 也不会出现在 runs 的 API 中；只有 `display_title` 可以查询。因此触发器发送 `origem.correlacao = <run_id>-<attempt>`，它进入 `run-name`，而 `qa-e2e-disparar.ts` 每 5 秒查询一次 `brabo-qa` 的 runs，最多 60 秒，匹配 `c=`。`attempt` 使关联在每次 re-run 中都是唯一的。没有 `origem` 的旧 payload 会产生空字段而不会出错。由 tag 触发的运行的来源取自 `tag-release` 写入带注释 tag 消息中的 `Carimbo: <url>` 行。

- **代码：** `scripts/ci/qa-e2e-imagens.ts:113`（payload 中的
  `origem.correlacao`）、`scripts/ci/qa-e2e-vinculos.ts:18`（`acharRun`）、
  `scripts/ci/qa-e2e-disparar.ts:133`（关联）、`scripts/ci/tag-release.ts:35`
  （`comCarimbo`）、`.github/workflows/release.yml:3`（tag 的 `run-name`）
- **测试：** `scripts/ci/qa-e2e-vinculos.spec.ts`（`c=` 的匹配）和
  `scripts/ci/qa-e2e-imagens.spec.ts`
- **ADR：** [0271](../adr/0271-os-runs-do-actions-mostram-os-vinculos-entre-os-repos.md)
- **来源：** AT-773（EP-033）

### RN-1045 — App 的检查从一开始就指向 `brabo-qa` 的运行，来源运行记录被触发运行的链接 {#rn-1045}

`e2e-pr.yml` 的 `anunciar` 作业没有 `needs`，与 `e2e` 并行，用 payload 的 `check_run_id` 更新检查，设置 `brabo-qa` 运行的 `details_url` 和 Vínculos，使用只有 `checks: write` 的 App 令牌以及干净的 `dev` checkout。`fechar` 在结尾保留 `details_url` 并附上 Vínculos。`anunciar` 失败只会警告。在来源运行中，触发器把它通过 [RN-1044](#rn-1044) 的关联找到的 `brabo-qa` 运行写入 `disparados`；若 60 秒内没找到，则记录检查的链接（它已经指向 qa）和一条警告。`alarmar-prova.sh` 在文件存在时把 `vinculos.md` 附到 issue 正文。

- **代码：** `scripts/ci/fechar-check.ts:39`（收尾时的 Vínculos）、
  `scripts/ci/qa-e2e-vinculos.ts:42`（`vinculosDoGatilho`）、
  `scripts/ci/qa-e2e-disparar.ts:154`（找不到运行时的警告）
- **测试：** `scripts/ci/fechar-check.spec.ts` 和 `scripts/ci/qa-e2e-vinculos.spec.ts`
- **ADR：** [0271](../adr/0271-os-runs-do-actions-mostram-os-vinculos-entre-os-repos.md)
- **来源：** AT-773（EP-033）

## npm 包的发布（RN-1042）

### RN-1042 — 包只通过 tag 发出，使用该版本的 dist-tag，且所有包使用同一个版本 {#rn-1042}

`publish-npm.yml` 是可复用的，在调用方通过 tag 触发时运行（`on: push: tags: ['v*']`）。`scripts/ci/publish-npm.ts` 从 tag 中取出版本（去掉 `v`），只接受 `vX.Y.Z` 或 `vX.Y.Z-dev.N`；其他任何形式都会在发布前失败。`-dev.N` 进入 dist-tag `dev`；正式版进入 `latest`，孤立的预发布版本绝不会占用 `latest`。列表中的每个包在 `pnpm pack` 之前都得到同一个版本（`npm version --no-git-tag-version`），`actions/attest` 和 `npm publish` 使用同一个 `.tgz`，不带 `--provenance`。重新发布同一版本，只有在 registry 已保存同一个文件（相同的 `dist.integrity`）时才通过；完整性不同则失败。

- **代码：** `scripts/ci/publish-npm.ts:17`（`versaoDaTag`）、`scripts/ci/publish-npm.ts:25`
  （`distTag`）、`.github/workflows/publish-npm.yml:90`（各包使用同一版本）、
  `.github/workflows/publish-npm.yml:100`（对同一个 `.tgz` 的 `npm publish`）
- **测试：** `scripts/ci/publish-npm.spec.ts`（dist-tag `dev` 和 `latest`，去掉 `v`）
- **来源：** AT-770（EP-033）

## 仓库之间的合并依赖（RN-1047..1050）

### RN-1047 — PR 用 `Depende-de: viralabs-dev/<repo>#<n>` 声明依赖，格式错误的行会失败而不是悄悄通过 {#rn-1047}

PR 的每个合并依赖都是正文中的一行：`Depende-de:` 后跟 `viralabs-dev/<repo>#<n>`，可在文本任意位置，前面有无 `- ` 均可。规则逐行匹配，区分大小写。仓库必须在母文件夹映射的 11 个 `brabo*` 仓库列表中，owner 必须是 `viralabs-dev`，PR 不能引用自己，被引用的 PR 必须存在（404 即失败）。以声明开头（`Depende-de` 或 `depende de`）但不符合规则的行会连同原因一起失败，这样一个拼写错误就不会让依赖消失。正文是第三方文本：通过环境变量传给脚本，绝不插值进 `run:`。

- **代码：** `scripts/ci/dependencias-de-merge.ts`（规则与校验），将
  发布在 `brabo-ci`；在 `brabo` 的 `dev` 中尚不存在
- **测试：** `scripts/ci/dependencias-de-merge.spec.ts`，涵盖正则、allowlist、
  owner、自我引用和格式错误的行
- **ADR：** [0276](../adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **来源：** AT-787（EP-033）

### RN-1048 — `Dependências de merge` 检查有四种状态，绝不使用 `neutral`，等待显示为黄色 {#rn-1048}

该检查由 App 发布在 PR 的 `head_sha` 上，名称为 `Dependências de merge`。没有 `Depende-de` 行时，结果为 `success`「Sem dependências declaradas」，并且它总是发布，以免残留旧的检查。只要有依赖处于 `OPEN`，结果为 `in_progress`（黄色），标题 `esperando viralabs-dev/<repo>#<n>` 列出尚缺的依赖。全部 `MERGED` 时，结果为 `success`「Dependências mergeadas」。遇到未合并就 `CLOSED` 的依赖、无效的行、循环或 404 时，结果为 `failure` 并附原因；未合并就关闭的依赖要求删掉该行或指向替代它的 PR，而不是永远等待。任何情况下都不使用 `neutral`，因为对 ruleset 来说它算绿色。作业本身使用 `continue-on-error`：失败的是检查，作业失败只会警告。

- **代码：** `scripts/ci/dependencias-de-merge.ts`（纯评估函数）和
  `.github/workflows/dependencias-de-merge.yml`（可复用工作流），位于 `brabo-ci`
- **测试：** `scripts/ci/dependencias-de-merge.spec.ts`，每种状态一个用例
- **ADR：** [0276](../adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **来源：** AT-787（EP-033）

### RN-1049 — 依赖的合并会更新引用它的 PR 的检查，每小时的 cron 只是兜底 {#rn-1049}

当某个仓库的 PR 被合并时，在被合并 PR 所属仓库中的 `avisar-dependentes` 作业会查找组织中正文引用了该已合并 PR 的未关闭 PR，并重新评估每一个。搜索是模糊的，因此每个候选 PR 的正文都要在任何写入之前按 [RN-1047](#rn-1047) 的规则重新解析。检查用 App 令牌更新，不会重新执行依赖方 PR 的工作流。`brabo-ci` 中每小时一次的 cron 对带 `Depende-de` 的未关闭 PR 重做同样的扫描，并在所属仓库的运行出错时补上丢失的合并。该 cron 只有在 `brabo-ci` 到达 `main` 后才会启用，因为 `schedule` 只在默认分支上运行。

- **代码：** `scripts/ci/dependencias-de-merge.ts`（`avisar-dependentes` 模式）和
  `.github/workflows/dependencias-de-merge.yml`（作业和 cron），位于 `brabo-ci`
- **测试：** `scripts/ci/dependencias-de-merge.spec.ts`，包含模拟的搜索和
  不再匹配的正文
- **ADR：** [0276](../adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **来源：** AT-787（EP-033）

### RN-1050 — 依赖循环会连同完整路径一起失败，深度最多为 5 {#rn-1050}

评估会逐步沿着未关闭依赖的 `Depende-de` 行走，直到深度 5。如果链回到被评估的 PR，检查会连同完整路径（`A → B → A`）以及路径上每个 PR 的链接一起失败。深度大于 5 同样失败。走出循环的办法是编辑其中一个 PR 的正文，删掉闭合循环的那一行：PR 不需要 bypass。

- **代码：** `scripts/ci/dependencias-de-merge.ts`（直到深度 5 的遍历），位于 `brabo-ci`
- **测试：** `scripts/ci/dependencias-de-merge.spec.ts`，包含 A↔B 循环和超出的深度
- **ADR：** [0276](../adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **来源：** AT-787（EP-033）

### RN-1071 — 晋升 PR 依赖前面各层未关闭的晋升，顺序是一个经过测试的列表 {#rn-1071}

在同一仓库中基线为 `main`、head 为 `dev` 的 PR 上，`Dependências de merge` 检查会在正文的 `Depende-de` 行之外，为前面各层仓库中每个未关闭的晋升 PR 加上一个依赖，即使没人写过。顺序是 `CAMADAS_DE_PROMOCAO`：0 brabo-ci；1 brabo-contracts 和 brabo-workspace；2 brabo-api、brabo-engine、brabo-web、brabo-runner 和 brabo-broker；3 brabo-infra；4 brabo-qa；5 brabo。只有消费方的 `main` 使用生产方最终制品的那条边才算数。标题显示 `esperando viralabs-dev/<repo>#<n>`。如果前面某层的仓库 `dev` 领先 `main` 而没有未关闭的晋升，检查保持 pending 并指出还需晋升哪个仓库（`esperando promoção de viralabs-dev/<repo> (a dev está à frente da main)`）。打开晋升（`abrir-pr-de-promocao.sh`）时也会尽力写入已打开晋升的 `Depende-de` 行。各层的并集就是 `REPOS` 列表，无重复，spec 对此做了保护。

- **代码：** `scripts/ci/dependencias-de-merge.ts`（`CAMADAS_DE_PROMOCAO`、`predecessores`、`avaliar`、`linhas` 模式）和 `scripts/ci/abrir-pr-de-promocao.sh`，位于 `brabo-ci`
- **测试：** `scripts/ci/dependencias-de-merge.spec.ts`（「promoção em camadas」块）
- **ADR：** [0284](../adr/0284-a-promocao-infere-as-dependencias-pela-ordem-dos-repos.md)，它修订了 [0276](../adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md) 的决定 7
- **来源：** AT-788（EP-033）

### RN-1072 — 晋升的合并和 cron 会重新评估后面各层的晋升 {#rn-1072}

由于推断出的依赖没有写在正文里，`in:body` 搜索找不到它。因此被合并 PR 的 `avisar-dependentes` 也会重新评估后面各层仓库中未关闭的晋升（`base:main head:dev`），`varrer`（每小时的 cron）也包含同样的搜索。在下层之后才打开的晋升，会被它自己的事件或 cron 唤醒。

- **代码：** `scripts/ci/dependencias-de-merge.ts`（`avisar-dependentes` 和 `varrer` 模式）
- **测试：** `scripts/ci/dependencias-de-merge.spec.ts`（`sucessores`）；搜索本身是 GitHub，在下一次晋升中验证
- **ADR：** [0284](../adr/0284-a-promocao-infere-as-dependencias-pela-ordem-dos-repos.md)
- **来源：** AT-788（EP-033）

## 回归测试的决策报告（RN-1051..1053）

### RN-1051 — 回归报告来自唯一的 JSON，建议遵循固定的六行规则 {#rn-1051}

`brabo-qa` 的回归运行写出 `relatorio-regressivo.json`（版本 1），并由它派生 `relatorio-regressivo.md`。Summary、检查的文本和 PR 评论都是该 JSON 的呈现，绝不是独立的来源。建议不是手写的：它取自第一条匹配的行，顺序如下：绿色且无 flaky 为**批准**；绿色但有 flaky 为**批准**，并附警告和列表；`digest` 或 `assinatura` 为**阻止**，因为它永远不被接受（AT-765），E2E 会重新运行；`spec` 出现在 PR 按映射**触及**的功能上为**阻止**；`spec` 仅出现在 PR **未**触及的功能上，或出现在「无功能」上，为**附理由接受**（`/qa-aceitar`）；`ambiente` 或 `sem-resposta` 为**重新运行**，若重复出现，则**附理由接受**。在 `dev` 模式下，同一标签带有前缀「atestado (não bloqueia)」。

- **代码：** `scripts/ci/qa-e2e-resumo.ts:292`（`montarCheck`，目前根据结果
  组装检查）；`brabo-qa` 的 `relatorio.ts` 和 JSON v1 在 `dev`
  中尚不存在（AT-791，lanes L1 和 L2）
- **测试：** `scripts/ci/qa-e2e-resumo.spec.ts`（按模式的检查）；建议规则
  和 JSON v1 的测试在 L1 和 L2 中补上
- **ADR：** [0277](../adr/0277-o-regressivo-roda-num-compose-so-e-o-relatorio-decide.md)
- **来源：** AT-791（EP-033）

### RN-1052 — `/qa-aceitar` 保留红色的报告，并记录与建议相悖的接受 {#rn-1052}

目前的接受会用 `linhas: []` 重新组装检查，因此抹掉了红色的 digest 表和功能表：事后查看的人看不到接受了什么。新规则：`/qa-aceitar` **保留**红色检查的 `summary` 和 `text`，在上方放上接受块（谁、何时、理由、红色运行的链接以及报告给出的建议），只把标题换成 `Aceito com justificativa`。当建议是因被触及功能的 spec 而**阻止**时，接受仍然有效，因为决定权在负责人，但检查和评论会记录「与建议相悖而接受」。在 `dev` 上接受不适用：报告只是证明。

- **代码：** `scripts/ci/qa-e2e-aceitar.ts:53`（`montarCheck`，以
  `linhas: []` 调用，这正是要修复的缺陷）；`scripts/ci/qa-e2e-aceite.ts:21`
  （`avaliarAceite`，继续读取 `external_id` 的 `causa:*`）
- **测试：** `scripts/ci/qa-e2e-aceite.spec.ts`（接受的裁决）；摘要的
  保留和「与建议相悖」的记录在 L1 中补上测试
- **ADR：** [0277](../adr/0277-o-regressivo-roda-num-compose-so-e-o-relatorio-decide.md)
- **来源：** AT-791（EP-033）

### RN-1053 — 没有 `@f-*` 标签的 spec 显示为「无功能」，且绝不会从报告中消失 {#rn-1053}

回归的选择已经把映射中无归属的内容分开（`semDono`，`scripts/ci/qa-regressivo-selecao.ts:86`），但这些数据没有进入报告。新规则：没有任何 `@f-<id>` 标签的 spec 落入**「无功能」**桶，出现在表格和失败列表中，绝不消失。该桶中红色的 spec 按 [RN-1051](#rn-1051) 的规则变为**附理由接受**，绝不阻止。登录的 `setup`（`entrar.setup.ts`）也落入该桶并被标记为准备工作，以免看起来像功能测试。没有这个桶，表格在出现 spec 红色时会把一切显示为「无覆盖」，这正是 qa#28 的发现。

- **代码：** `scripts/ci/qa-regressivo-selecao.ts:76`（`semDono.push`）；报告中的
  「无功能」桶尚不存在（AT-791，lanes L1 和 L2）
- **测试：** `scripts/ci/qa-regressivo-selecao.spec.ts`（按映射的选择和
  `semDono`）；报告中的桶在 L2 中补上测试
- **ADR：** [0277](../adr/0277-o-regressivo-roda-num-compose-so-e-o-relatorio-decide.md)
- **来源：** AT-791（EP-033）

## 触发器在变红之前等待印章和签名（RN-1066）

### RN-1066 — 触发器在因环境或签名而失败之前，先等待印章和签名 {#rn-1066}

当面向 `main` 的 PR（关卡 `E2E do brabo-qa`）或面向 `dev` 的 PR（检查 `Regressivo do brabo-qa`）触发该触发器时，事件所在仓库 head 的镜像可能仍在盖章或签名：合并进 `dev` 会移动晋升的 head，而印章（tag `-dev`、镜像）和镜像签名需要 3 到 8 分钟。因此触发器把三项查询重复到一个可配置的上限（`QA_ESPERA_MINUTOS`，默认 10 分钟，间隔 15 秒）：

- head 的 tag `-dev`（在 `main` 上）；
- 镜像是否存在（`main` 上 head 的 `-dev`，`dev` 上的 `sha-<12>`）；
- 签名校验 `cosign verify`，使用 brabo-qa 的 `e2e-pr` 的身份。

只有过了上限，检查才以红色关闭，消息会说明缺了什么：head 的 tag `-dev` 或镜像（原因 `ambiente`），或签名（原因 `assinatura`）。无效的签名绝不会被 `/qa-aceitar` 接受（RN-1052）。等待只针对事件所在仓库的镜像；其他服务的镜像已经盖章并签名。

- **代码：** `scripts/ci/qa-e2e-espera.ts:51`（`esperarImagemAssinada`，对
  镜像和签名的等待）；`scripts/ci/qa-e2e-espera.ts:33`（`repetirAte`，重复
  直到上限）；`scripts/ci/qa-e2e-disparar.ts:151`（重复到
  上限的 tag 解析器）和 `scripts/ci/qa-e2e-disparar.ts:157`（只等待事件仓库的镜像）
- **测试：** `scripts/ci/qa-e2e-espera.spec.ts`（重复到上限、原因
  `ambiente` 和原因 `assinatura`）
- **来源：** AT-790（EP-033），brabo-ci#31

## 变更面板（RN-1054..1056，ADR 0278）

### RN-1054 — 每个变更都有一个汇总各次运行的面板 {#rn-1054}

每个变更（一个 `Depende-de` 组件、一个独立的 PR 或一个 tag）在 `brabo-ci` 中都有一个 `Painel da mudança` 运行。它按 head SHA、merge SHA、tag 和 E2E 的 `c=` 汇总该变更的运行。每 60 秒跟踪一次，使用 ETag；若剩余请求少于 500，间隔变为 5 分钟。当一切结束且安静 3 分钟时停止，或在 45 分钟的上限处停止。到达上限时仍在进行的运行显示为「em andamento há N min」。面板**绝不失败**。

- **代码：** `scripts/ci/painel.ts:235`（`terminou`，停止的标尺）
- **测试：** `scripts/ci/painel.spec.ts`
- **ADR：** [0278](../adr/0278-a-mudanca-e-vista-num-painel-do-brabo-ci.md)
- **来源：** AT-792（EP-033）

### RN-1055 — 面板不在 PR 上发布检查；链接留在来源运行中 {#rn-1055}

Vínculos 辅助程序在带 PR 的 auto 模式下写入 `Disparado | Painel da mudança` 这一行。它指向 `…/brabo-ci/actions/workflows/painel.yml?query=<repo>%23<n>`。面板的 App 令牌只读（`actions`、`pull-requests` 和 `contents`）。唯一有写权限的令牌是 dispatch 的（`contents: write`，限定于 `brabo-ci`）。因此不需要 `checks: write`。

- **代码：** `scripts/ci/vinculos.ts:164`（`linhaDoPainel`，Vínculo 行）
- **测试：** `scripts/ci/vinculos.spec.ts`
- **ADR：** [0278](../adr/0278-a-mudanca-e-vista-num-painel-do-brabo-ci.md)
- **来源：** AT-792（EP-033）

### RN-1056 — 每个组件一个面板 {#rn-1056}

如果已存在标题含 `<repo>#<n>`（整个 token 匹配）且状态为 `queued` 或 `in_progress` 的面板，发送方（作业 `avisar-painel`）就不再触发。当组件增长（键 `m=<hash>`）时，进行中的面板写下「superado」并退出，发送方触发新的面板。

- **代码：** `scripts/ci/painel.ts:247`（`jaTemPainel`）；`scripts/ci/painel.ts:90`
  （`superado`，进行中的面板会查询它）
- **测试：** `scripts/ci/painel.spec.ts`
- **ADR：** [0278](../adr/0278-a-mudanca-e-vista-num-painel-do-brabo-ci.md)
- **来源：** AT-792（EP-033）
