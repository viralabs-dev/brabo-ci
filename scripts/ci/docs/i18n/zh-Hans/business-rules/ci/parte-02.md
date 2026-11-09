---
traducao_de: 1c63ebcf9d7719601a0fe7777f0d97952aa6e76e
id: rn-ci-parte-02
title: 'Regras de negócio — CI — 第 2 部分 (自 RN-1031)'
sidebar_label: 'CI — 第 2 部分 (自 RN-1031)'
description: 'As RNs hospedadas na raiz ci.'
keywords: [regras de negócio, ci]
---

# CI — 第 2 部分 (自 RN-1031)

## 按功能的回归测试与运行之间的关联（RN-1031..1035，RN-1043..1045）

<a id="rn-1031"></a>

### RN-1031 — 功能目录与「路径 → 功能」映射放在同一个文件里，spec 通过标签与之绑定 {#rn-1031}

`brabo-qa/funcionalidades.yml` 是唯一来源：每个功能有 `id`（kebab-case，稳定，绝不改名；停用用 `status: aposentada`）、`nome`、`descricao`、`tema`（来自 ADR 的 `temas.yml`）、`status` 和 `caminhos: {<repo>: [globs]}`。它放在 `brabo-qa` 而不是 `brabo-contracts`，因为 contracts 按 TAG 消费，映射的每次调整都会变成一个 tag，并在六个消费方各做一次升级。Playwright 的 spec 通过测试自身的标签（`{ tag: '@f-<id>' }`）与功能绑定，过滤用 `--grep`：目录不保存文件列表。`brabo-qa` 的一个测试会拒绝重复的或不是 kebab-case 的 id、不在 `temas.yml` 中的主题、匹配不到兄弟仓库任何文件的 glob（映射腐烂），以及没有对应条目的 `@f-<id>` 标签；没有 spec 的功能只是被列出。

- **代码：** `funcionalidades.yml:1`（目录与文件契约）、
  `scripts/ci/funcionalidades.ts:29`（`validarCatalogo`）
- **测试：** `scripts/ci/funcionalidades.spec.ts`（校验器）和
  `scripts/ci/qa-regressivo-catalogo-real.spec.ts:12`（真实目录有 14 个
  活跃功能，且 glob 能匹配）
- **ADR：** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **来源：** AT-769（EP-033）

<a id="rn-1032"></a>

### RN-1032 — 面向 `dev` 的 PR 只运行它触及的功能的回归测试，使用「绝不」被要求的 `Regressivo do brabo-qa` 检查 {#rn-1032}

在目标为 `dev` 的 PR 上，`qa-e2e-gatilho.yml` 的 `regressivo-dev` 作业把 PR 的文件与 [RN-1031](#rn-1031) 的映射交叉比对，并带着被触及的功能触发 `brabo-qa`。结果以 `Regressivo do brabo-qa` 检查的形式返回，由 App 在 `head_sha` 上创建：`success`、`failure`（可见，但合并仍然自由）或 `neutral`（未触及任何内容、仅文档、fork 的 PR、没有 spec 的仓库）。名称有意与 `E2E do brabo-qa` 区分：「main 要求 E2E」的 ruleset 绑定的是那个上下文，而回归测试从不进入任何 ruleset（`rulesets.md` 记录了「不要求」这一行）。该作业带有 `continue-on-error`，`/qa-aceitar` 在 `dev` 上不适用；当映射显示功能被触及而没有任何 `@f-<id>` spec 变化时，App 会发一次提醒评论。

- **代码：** `.github/workflows/qa-e2e-gatilho.yml:74`（作业
  `regressivo-dev`，带 `continue-on-error`）、`scripts/ci/qa-e2e-resumo.ts:22`
  （按模式的检查名称）、`scripts/ci/qa-regressivo-lembrete.ts`（唯一的提醒评论）
- **测试：** `scripts/ci/qa-e2e-resumo.spec.ts`（按模式的名称）和
  `scripts/ci/qa-regressivo-selecao.spec.ts:33`（按映射选择）和
  `scripts/ci/qa-regressivo-lembrete.spec.ts`（提醒）
- **ADR：** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **来源：** AT-769（EP-033）

<a id="rn-1033"></a>

### RN-1033 — 三条跨领域的文件规则先于映射生效：无、整个目录、无归属 {#rn-1033}

依次为：(1) 文档、`*.md`、`CHANGELOG.md`、`.github/**`（`qa-e2e.yml` 本身除外）、仓库的测试和 `.claude/**` 不触及任何功能，检查结果为 `neutral`；(2) 锁文件和清单、`Dockerfile`、应用入口、schema 与迁移、web 客户端、engine 的 `config/**` 以及 `brabo-qa` 的套件（`e2e/suporte/**`、`playwright.config.ts`）运行整个目录，contracts 的 TAG 升级也归入这里；(3) 没有任何 glob 匹配的路径运行冒烟测试 `instalacao` + `autenticacao`，摘要把它列为「映射中无归属」，以便修正映射。`brabo-contracts` 在自己的 PR 上没有回归测试。

- **代码：** `scripts/ci/qa-regressivo-selecao.ts:67`（`selecionar`）、
  `scripts/ci/qa-regressivo-selecao.ts:43`（`SMOKE`）
- **测试：** `scripts/ci/qa-regressivo-selecao.spec.ts:41`（规则 1）、
  `:55`（按仓库的规则 2）、`:58`（规则 3）
- **ADR：** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **来源：** AT-769（EP-033）

<a id="rn-1075"></a>

### RN-1075 — `brabo-runner` 由自身的 CI 证明：linux-x64 二进制进入 PR，与 engine 的契约只在 TP-01 中验证 {#rn-1075}

`brabo-runner` 在 `brabo-qa` 中没有 `qa-e2e.yml`、镜像或 `@f-runner`/`@f-projetos` spec；目录回归不会在其 PR 上运行（负责人于 2026/11/08 的决定，选项 b）。PR 由其 `ci.yml` 的 `runner` 作业证明：lint、类型、测试、带 `smoke` 的 `dist`，以及带 `build:bin` + `smoke:bin`（`--self-test-pty`，真实 PTY）的 linux-x64 二进制。**runner ↔ engine 契约**（ticket join、能力、exec、目录）在 PR 上**不会**被验证：只在实时 TP-01 中验证。`funcionalidades.yml` 中的 `runner` 键保留在目录里，仅用于映射。

- **代码：** `brabo-runner` 的 `.github/workflows/ci.yml` 中的 `runner` 作业
- **测试：** 作业本身（日志含 `--self-test-pty` 的 `ok:`）
- **ADR：** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **来源：** AT-853（EP-033）

<a id="rn-1034"></a>

### RN-1034 — 面向 `main` 的 PR 在 `E2E do brabo-qa` 中运行整个目录，没有 spec 的功能显示为「无覆盖」但不会失败 {#rn-1034}

`E2E do brabo-qa` 检查（[ADR 0267](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0267-o-e2e-do-brabo-qa-e-portao-da-main.md)）运行所有 spec，并生成 `funcionalidade | specs | resultado` 表。目录中没有 spec 的功能以 `sem cobertura` 进入，并且**不会失败**（负责人于 2026/11/06 的决定）：若规则相反，`main` 会连续数周保持红色，`/qa-aceitar` 也会变成例行公事。现有的测试无需改动即可通过；`spec` 或 `ambiente` 的红色仍可通过 `/qa-aceitar` 接受，`digest` 或 `assinatura` 的红色则永远不行。

- **代码：** `scripts/ci/qa-e2e-resumo.ts:28`（表格行中的 `sem cobertura`
  结果）、`scripts/ci/qa-e2e-resumo.ts:22`（`main` 的检查名称）
- **测试：** `scripts/ci/qa-e2e-resumo.spec.ts`（表格和无覆盖
  的行）
- **ADR：** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **来源：** AT-769（EP-033）

<a id="rn-1035"></a>

### RN-1035 — 面向 `dev` 的 PR 只为自己的仓库发布已签名的 `sha-<12>` 镜像，清理任务删除孤儿镜像 {#rn-1035}

为了让回归测试有东西可运行，api、engine、web 和 broker 的 `ci.yml` 在基线为 `dev` 时也发布 `ghcr.io/viralabs-dev/brabo-<app>:sha-<12 primeiros do head>`，带 Trivy 和 keyless 的 `cosign sign`，与 `main` 相同。fork 的 PR 拿不到密钥：镜像被跳过，回归测试说明「不在 fork 的 PR 中运行」。触发器在 PR 所在仓库使用 `sha-<12>`，在其他仓库使用最新的 `-dev.N`。每次 `synchronize` 都会留下一个孤儿 `sha-*`，因此 `limpeza-ghcr.yml` 会删除所有已关闭 PR 的 `sha-*` 以及超过 7 天的。

- **代码：** `scripts/ci/qa-e2e-imagens.ts:83`（为
  `dev` 和 `hotfix` 选择 `sha-<12>`）
- **测试：** `scripts/ci/qa-e2e-imagens.spec.ts`（按基线的选择）
- **ADR：** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **来源：** AT-769（EP-033）

<a id="rn-1043"></a>

### RN-1043 — 每个读取其他仓库的运行都在 Summary 顶部发布 `## Vínculos`，且该辅助程序绝不让作业失败 {#rn-1043}

通过 `brabo-ci` 的 action `vinculos`，每个关联仓库的作业的 Summary 都带有 `## Vínculos` 表（来源、带链接的兄弟仓库 `repo@SHA`、目标以及被触发的运行）和一张 Mermaid 图，紧跟在 checkout 之后。所有值在进入 Markdown 之前都要过正则：仓库 `viralabs-dev/brabo(-x)?`、40 位十六进制的 SHA、数字 PR、组织的 GitHub URL、操作者。不匹配的变成 `?` 并产生 `::warning::`。无效的 `origem` 只是被丢弃并给出警告。该步骤带有 `continue-on-error`：辅助程序绝不让作业失败。在 `brabo` 中，`docs-check`、`docs-deploy`、`docs-audit` 和 `regenera-gerados` 传入 `montar-layout.sh` 写下的 `.git/irmaos-sha.lst` 中的 SHA（[ADR 0274](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0274-os-gerados-leem-os-irmaos-por-uma-trava-de-shas.md)），而 `release.yml` 则按路径传入 `infra`。

- **代码：** `scripts/ci/vinculos.ts:57`（`montar`）、`.github/actions/vinculos/action.yml:31`
  （`continue-on-error`）、`scripts/ci/validar-payload.ts:112`（`validarOrigem`）、
  `.github/workflows/docs-check.yml:89`（`brabo` 转交兄弟仓库）
- **测试：** `scripts/ci/vinculos.spec.ts`（fixtures、恶意值、空
  来源）和 `scripts/ci/validar-payload.spec.ts`
- **ADR：** [0271](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0271-os-runs-do-actions-mostram-os-vinculos-entre-os-repos.md)
- **来源：** AT-773（EP-033）

<a id="rn-1044"></a>

### RN-1044 — dispatch 或 tag 的目标运行带有含来源的 `run-name`，dispatch 的关联以 `c=<run_id>-<attempt>` 的形式写在名称里 {#rn-1044}

可复用工作流的 `run-name` 会被忽略：以调用方的为准。`brabo-qa` 的 `e2e-pr.yml` 命名为 `E2E ← <repo>#<pr> · <sha7> · <ator> · c=<correlação>`（dev 模式下为 `Regressivo ← …`）；由 tag 触发的运行，如 `brabo` 的 `release` 和 `install-e2e`，命名为 `release <tag> ← tag do carimbo`。`repository_dispatch` 返回 204 且没有 id，`client_payload` 也不会出现在 runs 的 API 中；只有 `display_title` 可以查询。因此触发器发送 `origem.correlacao = <run_id>-<attempt>`，它进入 `run-name`，而 `qa-e2e-disparar.ts` 每 5 秒查询一次 `brabo-qa` 的 runs，最多 60 秒，匹配 `c=`。`attempt` 使关联在每次 re-run 中都是唯一的。没有 `origem` 的旧 payload 会产生空字段而不会出错。由 tag 触发的运行的来源取自 `tag-release` 写入带注释 tag 消息中的 `Carimbo: <url>` 行。

- **代码：** `scripts/ci/qa-e2e-imagens.ts:113`（payload 中的
  `origem.correlacao`）、`scripts/ci/qa-e2e-vinculos.ts:18`（`acharRun`）、
  `scripts/ci/qa-e2e-disparar.ts:133`（关联）、`scripts/ci/tag-release.ts:35`
  （`comCarimbo`）、`.github/workflows/release.yml:3`（tag 的 `run-name`）
- **测试：** `scripts/ci/qa-e2e-vinculos.spec.ts`（`c=` 的匹配）和
  `scripts/ci/qa-e2e-imagens.spec.ts`
- **ADR：** [0271](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0271-os-runs-do-actions-mostram-os-vinculos-entre-os-repos.md)
- **来源：** AT-773（EP-033）

<a id="rn-1045"></a>

### RN-1045 — App 的检查从一开始就指向 `brabo-qa` 的运行，来源运行记录被触发运行的链接 {#rn-1045}

`e2e-pr.yml` 的 `anunciar` 作业没有 `needs`，与 `e2e` 并行，用 payload 的 `check_run_id` 更新检查，设置 `brabo-qa` 运行的 `details_url` 和 Vínculos，使用只有 `checks: write` 的 App 令牌以及干净的 `dev` checkout。`fechar` 在结尾保留 `details_url` 并附上 Vínculos。`anunciar` 失败只会警告。在来源运行中，触发器把它通过 [RN-1044](#rn-1044) 的关联找到的 `brabo-qa` 运行写入 `disparados`；若 60 秒内没找到，则记录检查的链接（它已经指向 qa）和一条警告。`alarmar-prova.sh` 在文件存在时把 `vinculos.md` 附到 issue 正文。

- **代码：** `scripts/ci/fechar-check.ts:39`（收尾时的 Vínculos）、
  `scripts/ci/qa-e2e-vinculos.ts:42`（`vinculosDoGatilho`）、
  `scripts/ci/qa-e2e-disparar.ts:154`（找不到运行时的警告）
- **测试：** `scripts/ci/fechar-check.spec.ts` 和 `scripts/ci/qa-e2e-vinculos.spec.ts`
- **ADR：** [0271](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0271-os-runs-do-actions-mostram-os-vinculos-entre-os-repos.md)
- **来源：** AT-773（EP-033）

## npm 包的发布（RN-1042）

<a id="rn-1042"></a>

### RN-1042 — 包只通过 tag 发出，使用该版本的 dist-tag，且所有包使用同一个版本 {#rn-1042}

`publish-npm.yml` 是可复用的，在调用方通过 tag 触发时运行（`on: push: tags: ['v*']`）。`scripts/ci/publish-npm.ts` 从 tag 中取出版本（去掉 `v`），只接受 `vX.Y.Z` 或 `vX.Y.Z-dev.N`；其他任何形式都会在发布前失败。`-dev.N` 进入 dist-tag `dev`；正式版进入 `latest`，孤立的预发布版本绝不会占用 `latest`。列表中的每个包在 `pnpm pack` 之前都得到同一个版本（`npm version --no-git-tag-version`），`actions/attest` 和 `npm publish` 使用同一个 `.tgz`，不带 `--provenance`。重新发布同一版本，只有在 registry 已保存同一个文件（相同的 `dist.integrity`）时才通过；完整性不同则失败。

- **代码：** `scripts/ci/publish-npm.ts:17`（`versaoDaTag`）、`scripts/ci/publish-npm.ts:25`
  （`distTag`）、`.github/workflows/publish-npm.yml:90`（各包使用同一版本）、
  `.github/workflows/publish-npm.yml:100`（对同一个 `.tgz` 的 `npm publish`）
- **测试：** `scripts/ci/publish-npm.spec.ts`（dist-tag `dev` 和 `latest`，去掉 `v`）
- **来源：** AT-770（EP-033）

## 仓库之间的合并依赖（RN-1047..1050）

<a id="rn-1047"></a>

### RN-1047 — PR 用 `Depende-de: viralabs-dev/<repo>#<n>` 声明依赖，格式错误的行会失败而不是悄悄通过 {#rn-1047}

PR 的每个合并依赖都是正文中的一行：`Depende-de:` 后跟 `viralabs-dev/<repo>#<n>`，可在文本任意位置，前面有无 `- ` 均可。规则逐行匹配，区分大小写。仓库必须在母文件夹映射的 11 个 `brabo*` 仓库列表中，owner 必须是 `viralabs-dev`，PR 不能引用自己，被引用的 PR 必须存在（404 即失败）。以声明开头（`Depende-de` 或 `depende de`）但不符合规则的行会连同原因一起失败，这样一个拼写错误就不会让依赖消失。正文是第三方文本：通过环境变量传给脚本，绝不插值进 `run:`。

- **代码：** `scripts/ci/dependencias-de-merge.ts`（规则与校验），将
  发布在 `brabo-ci`；在 `brabo` 的 `dev` 中尚不存在
- **测试：** `scripts/ci/dependencias-de-merge.spec.ts`，涵盖正则、allowlist、
  owner、自我引用和格式错误的行
- **ADR：** [0276](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **来源：** AT-787（EP-033）

<a id="rn-1048"></a>

### RN-1048 — `Dependências de merge` 检查有四种状态，绝不使用 `neutral`，等待显示为黄色 {#rn-1048}

该检查由 App 发布在 PR 的 `head_sha` 上，名称为 `Dependências de merge`。没有 `Depende-de` 行时，结果为 `success`「Sem dependências declaradas」，并且它总是发布，以免残留旧的检查。只要有依赖处于 `OPEN`，结果为 `in_progress`（黄色），标题 `esperando viralabs-dev/<repo>#<n>` 列出尚缺的依赖。全部 `MERGED` 时，结果为 `success`「Dependências mergeadas」。遇到未合并就 `CLOSED` 的依赖、无效的行、循环或 404 时，结果为 `failure` 并附原因；未合并就关闭的依赖要求删掉该行或指向替代它的 PR，而不是永远等待。任何情况下都不使用 `neutral`，因为对 ruleset 来说它算绿色。作业本身使用 `continue-on-error`：失败的是检查，作业失败只会警告。

- **代码：** `scripts/ci/dependencias-de-merge.ts`（纯评估函数）和
  `.github/workflows/dependencias-de-merge.yml`（可复用工作流），位于 `brabo-ci`
- **测试：** `scripts/ci/dependencias-de-merge.spec.ts`，每种状态一个用例
- **ADR：** [0276](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **来源：** AT-787（EP-033）

<a id="rn-1049"></a>

### RN-1049 — 依赖的合并会更新引用它的 PR 的检查，每小时的 cron 只是兜底 {#rn-1049}

当某个仓库的 PR 被合并时，在被合并 PR 所属仓库中的 `avisar-dependentes` 作业会查找组织中正文引用了该已合并 PR 的未关闭 PR，并重新评估每一个。搜索是模糊的，因此每个候选 PR 的正文都要在任何写入之前按 [RN-1047](#rn-1047) 的规则重新解析。检查用 App 令牌更新，不会重新执行依赖方 PR 的工作流。`brabo-ci` 中每小时一次的 cron 对带 `Depende-de` 的未关闭 PR 重做同样的扫描，并在所属仓库的运行出错时补上丢失的合并。该 cron 只有在 `brabo-ci` 到达 `main` 后才会启用，因为 `schedule` 只在默认分支上运行。

- **代码：** `scripts/ci/dependencias-de-merge.ts`（`avisar-dependentes` 模式）和
  `.github/workflows/dependencias-de-merge.yml`（作业和 cron），位于 `brabo-ci`
- **测试：** `scripts/ci/dependencias-de-merge.spec.ts`，包含模拟的搜索和
  不再匹配的正文
- **ADR：** [0276](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **来源：** AT-787（EP-033）

<a id="rn-1050"></a>

### RN-1050 — 依赖循环会连同完整路径一起失败，深度最多为 5 {#rn-1050}

评估会逐步沿着未关闭依赖的 `Depende-de` 行走，直到深度 5。如果链回到被评估的 PR，检查会连同完整路径（`A → B → A`）以及路径上每个 PR 的链接一起失败。深度大于 5 同样失败。走出循环的办法是编辑其中一个 PR 的正文，删掉闭合循环的那一行：PR 不需要 bypass。

- **代码：** `scripts/ci/dependencias-de-merge.ts`（直到深度 5 的遍历），位于 `brabo-ci`
- **测试：** `scripts/ci/dependencias-de-merge.spec.ts`，包含 A↔B 循环和超出的深度
- **ADR：** [0276](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **来源：** AT-787（EP-033）

<a id="rn-1071"></a>

### RN-1071 — 晋升 PR 依赖前面各层未关闭的晋升，顺序是一个经过测试的列表 {#rn-1071}

在同一仓库中基线为 `main`、head 为 `dev` 的 PR 上，`Dependências de merge` 检查会在正文的 `Depende-de` 行之外，为前面各层仓库中每个未关闭的晋升 PR 加上一个依赖，即使没人写过。顺序是 `CAMADAS_DE_PROMOCAO`：0 brabo-ci；1 brabo-contracts 和 brabo-workspace；2 brabo-api、brabo-engine、brabo-web、brabo-runner 和 brabo-broker；3 brabo-infra；4 brabo-qa；5 brabo。只有消费方的 `main` 使用生产方最终制品的那条边才算数。标题显示 `esperando viralabs-dev/<repo>#<n>`。如果前面某层的仓库 `dev` 领先 `main` 而没有未关闭的晋升，检查保持 pending 并指出还需晋升哪个仓库（`esperando promoção de viralabs-dev/<repo> (a dev está à frente da main)`）。打开晋升（`abrir-pr-de-promocao.sh`）时也会尽力写入已打开晋升的 `Depende-de` 行。各层的并集就是 `REPOS` 列表，无重复，spec 对此做了保护。

- **代码：** `scripts/ci/dependencias-de-merge.ts`（`CAMADAS_DE_PROMOCAO`、`predecessores`、`avaliar`、`linhas` 模式）和 `scripts/ci/abrir-pr-de-promocao.sh`，位于 `brabo-ci`
- **测试：** `scripts/ci/dependencias-de-merge.spec.ts`（「promoção em camadas」块）
- **ADR：** [0284](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0284-a-promocao-infere-as-dependencias-pela-ordem-dos-repos.md)，它修订了 [0276](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md) 的决定 7
- **来源：** AT-788（EP-033）

<a id="rn-1072"></a>

### RN-1072 — 晋升的合并和 cron 会重新评估后面各层的晋升 {#rn-1072}

由于推断出的依赖没有写在正文里，`in:body` 搜索找不到它。因此被合并 PR 的 `avisar-dependentes` 也会重新评估后面各层仓库中未关闭的晋升（`base:main head:dev`），`varrer`（每小时的 cron）也包含同样的搜索。在下层之后才打开的晋升，会被它自己的事件或 cron 唤醒。

- **代码：** `scripts/ci/dependencias-de-merge.ts`（`avisar-dependentes` 和 `varrer` 模式）
- **测试：** `scripts/ci/dependencias-de-merge.spec.ts`（`sucessores`）；搜索本身是 GitHub，在下一次晋升中验证
- **ADR：** [0284](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0284-a-promocao-infere-as-dependencias-pela-ordem-dos-repos.md)
- **来源：** AT-788（EP-033）

## 回归测试的决策报告（RN-1051..1053）

<a id="rn-1051"></a>

### RN-1051 — 回归报告来自唯一的 JSON，建议遵循固定的六行规则 {#rn-1051}

`brabo-qa` 的回归运行写出 `relatorio-regressivo.json`（版本 1），并由它派生 `relatorio-regressivo.md`。Summary、检查的文本和 PR 评论都是该 JSON 的呈现，绝不是独立的来源。建议不是手写的：它取自第一条匹配的行，顺序如下：绿色且无 flaky 为**批准**；绿色但有 flaky 为**批准**，并附警告和列表；`digest` 或 `assinatura` 为**阻止**，因为它永远不被接受（AT-765），E2E 会重新运行；`spec` 出现在 PR 按映射**触及**的功能上为**阻止**；`spec` 仅出现在 PR **未**触及的功能上，或出现在「无功能」上，为**附理由接受**（`/qa-aceitar`）；`ambiente` 或 `sem-resposta` 为**重新运行**，若重复出现，则**附理由接受**。在 `dev` 模式下，同一标签带有前缀「atestado (não bloqueia)」。

- **代码：** `scripts/ci/qa-e2e-resumo.ts:292`（`montarCheck`，目前根据结果
  组装检查）；`brabo-qa` 的 `relatorio.ts` 和 JSON v1 在 `dev`
  中尚不存在（AT-791，lanes L1 和 L2）
- **测试：** `scripts/ci/qa-e2e-resumo.spec.ts`（按模式的检查）；建议规则
  和 JSON v1 的测试在 L1 和 L2 中补上
- **ADR：** [0277](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0277-o-regressivo-roda-num-compose-so-e-o-relatorio-decide.md)
- **来源：** AT-791（EP-033）

<a id="rn-1052"></a>

### RN-1052 — `/qa-aceitar` 保留红色的报告，并记录与建议相悖的接受 {#rn-1052}

目前的接受会用 `linhas: []` 重新组装检查，因此抹掉了红色的 digest 表和功能表：事后查看的人看不到接受了什么。新规则：`/qa-aceitar` **保留**红色检查的 `summary` 和 `text`，在上方放上接受块（谁、何时、理由、红色运行的链接以及报告给出的建议），只把标题换成 `Aceito com justificativa`。当建议是因被触及功能的 spec 而**阻止**时，接受仍然有效，因为决定权在负责人，但检查和评论会记录「与建议相悖而接受」。在 `dev` 上接受不适用：报告只是证明。

- **代码：** `scripts/ci/qa-e2e-aceitar.ts:53`（`montarCheck`，以
  `linhas: []` 调用，这正是要修复的缺陷）；`scripts/ci/qa-e2e-aceite.ts:21`
  （`avaliarAceite`，继续读取 `external_id` 的 `causa:*`）
- **测试：** `scripts/ci/qa-e2e-aceite.spec.ts`（接受的裁决）；摘要的
  保留和「与建议相悖」的记录在 L1 中补上测试
- **ADR：** [0277](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0277-o-regressivo-roda-num-compose-so-e-o-relatorio-decide.md)
- **来源：** AT-791（EP-033）

<a id="rn-1053"></a>

### RN-1053 — 没有 `@f-*` 标签的 spec 显示为「无功能」，且绝不会从报告中消失 {#rn-1053}

回归的选择已经把映射中无归属的内容分开（`semDono`，`scripts/ci/qa-regressivo-selecao.ts:86`），但这些数据没有进入报告。新规则：没有任何 `@f-<id>` 标签的 spec 落入**「无功能」**桶，出现在表格和失败列表中，绝不消失。该桶中红色的 spec 按 [RN-1051](#rn-1051) 的规则变为**附理由接受**，绝不阻止。登录的 `setup`（`entrar.setup.ts`）也落入该桶并被标记为准备工作，以免看起来像功能测试。没有这个桶，表格在出现 spec 红色时会把一切显示为「无覆盖」，这正是 qa#28 的发现。

- **代码：** `scripts/ci/qa-regressivo-selecao.ts:76`（`semDono.push`）；报告中的
  「无功能」桶尚不存在（AT-791，lanes L1 和 L2）
- **测试：** `scripts/ci/qa-regressivo-selecao.spec.ts`（按映射的选择和
  `semDono`）；报告中的桶在 L2 中补上测试
- **ADR：** [0277](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0277-o-regressivo-roda-num-compose-so-e-o-relatorio-decide.md)
- **来源：** AT-791（EP-033）

## 触发器在变红之前等待印章和签名（RN-1066）

<a id="rn-1066"></a>

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

<a id="rn-1054"></a>

### RN-1054 — 每个变更都有一个汇总各次运行的面板 {#rn-1054}

每个变更（一个 `Depende-de` 组件、一个独立的 PR 或一个 tag）在 `brabo-ci` 中都有一个 `Painel da mudança` 运行。它按 head SHA、merge SHA、tag 和 E2E 的 `c=` 汇总该变更的运行。每 60 秒跟踪一次，使用 ETag；若剩余请求少于 500，间隔变为 5 分钟。当一切结束且安静 3 分钟时停止，或在 45 分钟的上限处停止。到达上限时仍在进行的运行显示为「em andamento há N min」。面板**绝不失败**。

- **代码：** `scripts/ci/painel.ts:235`（`terminou`，停止的标尺）
- **测试：** `scripts/ci/painel.spec.ts`
- **ADR：** [0278](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0278-a-mudanca-e-vista-num-painel-do-brabo-ci.md)
- **来源：** AT-792（EP-033）

<a id="rn-1055"></a>

### RN-1055 — 面板不在 PR 上发布检查；链接留在来源运行中 {#rn-1055}

Vínculos 辅助程序在带 PR 的 auto 模式下写入 `Disparado | Painel da mudança` 这一行。它指向 `…/brabo-ci/actions/workflows/painel.yml?query=<repo>%23<n>`。面板的 App 令牌只读（`actions`、`pull-requests` 和 `contents`）。唯一有写权限的令牌是 dispatch 的（`contents: write`，限定于 `brabo-ci`）。因此不需要 `checks: write`。

- **代码：** `scripts/ci/vinculos.ts:164`（`linhaDoPainel`，Vínculo 行）
- **测试：** `scripts/ci/vinculos.spec.ts`
- **ADR：** [0278](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0278-a-mudanca-e-vista-num-painel-do-brabo-ci.md)
- **来源：** AT-792（EP-033）

<a id="rn-1056"></a>

### RN-1056 — 每个组件一个面板 {#rn-1056}

如果已存在标题含 `<repo>#<n>`（整个 token 匹配）且状态为 `queued` 或 `in_progress` 的面板，发送方（作业 `avisar-painel`）就不再触发。当组件增长（键 `m=<hash>`）时，进行中的面板写下「superado」并退出，发送方触发新的面板。

- **代码：** `scripts/ci/painel.ts:247`（`jaTemPainel`）；`scripts/ci/painel.ts:90`
  （`superado`，进行中的面板会查询它）
- **测试：** `scripts/ci/painel.spec.ts`
- **ADR：** [0278](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0278-a-mudanca-e-vista-num-painel-do-brabo-ci.md)
- **来源：** AT-792（EP-033）
