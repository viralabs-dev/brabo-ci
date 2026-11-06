# brabo-ci

Política de PR, branch, escada de aprovação, promoção, carimbo de tag, arquivamento e Dependabot do Brabo, como **workflows reutilizáveis** (`on: workflow_call`), mais os modelos de comunidade. A lógica mora em `scripts/ci/` (TypeScript executado pelo Node por type stripping, testado com vitest).

## Como funciona

Cada workflow reutilizável faz um segundo checkout deste repositório em `.brabo-ci/` e roda `node .brabo-ci/scripts/ci/<script>.ts` a partir da raiz do repositório que chama. Por isso todos têm o input `ci_ref`: o **mesmo SHA (ou tag)** que você pôs no `uses:`. O padrão é `v1.0.0`.

Os gatilhos (`on:`) ficam no repositório que chama. `vars` (`APPROVAL_MODE`, `OWNER_HANDLE`, `APROVADORES_*`) são lidas do repositório ou da organização que chama.

Pine sempre por SHA: `uses: viralabs-dev/brabo-ci/.github/workflows/pr-police.yml@<sha>  # v1.0.0`.

## Workflows

| Workflow | Inputs | Secrets | Faz |
|---|---|---|---|
| `pr-police.yml` | `ci_ref` | - | forma do PR (nome, origem, destino) e a label de família |
| `approval-ladder.yml` | `ci_ref` | - | aprovações certas por degrau (usa as vars acima); dispensa PR do Dependabot e a de regeneração do bot (`chore/regenera-gerados`, ADR 0255) na `dev` |
| `backmerge-gate.yml` | `ci_ref` | - | trava de retropropagação depois de hotfix |
| `promotion-check.yml` | `ci_ref` | - | estado do PR de promoção (range, tag do degrau) |
| `promote.yml` | `ci_ref`, `par` (padrão `dev->main`) | `BOT_TOKEN` (opcional) | abre o PR de promoção; o merge é humano |
| `tag-release.yml` | `ci_ref` | `BOT_TOKEN` (opcional; obrigatório para hotfix) | carimba a tag do estágio, trava e destrava o gate |
| `archive-merged-branch.yml` | `ci_ref` | - | arquiva branch mergeada em `refs/archive/` |
| `dependabot-para-dev.yml` | `ci_ref` | - | fecha ou redireciona PR de segurança do Dependabot para a `dev` |
| `claude.yml` | - | `CLAUDE_CODE_OAUTH_TOKEN` | responde a `@claude` |
| `claude-code-review.yml` | - | `CLAUDE_CODE_OAUTH_TOKEN` | revisão automática de PR |

Os reutilizáveis que escrevem com o bot (`tag-release`, `promote`) aceitam `APP_ID` e `APP_PRIVATE_KEY` e geram o token do GitHub App DENTRO do próprio job (o token é mascarado e não atravessa jobs, então o chamador não consegue passá-lo como `BOT_TOKEN`). O chamador passa:

```yaml
secrets:
  APP_ID: ${{ secrets.BRABO_APP_ID }}
  APP_PRIVATE_KEY: ${{ secrets.BRABO_APP_PRIVATE_KEY }}
```

`BOT_TOKEN` segue aceito como alternativa. Ele é um PAT ou o token do GitHub App da organização. O nome do App e do secret ainda não foram registrados (lacuna declarada): passe o token que a organização definir.

## Exemplo de chamada

```yaml
# .github/workflows/politica.yml no repositório que chama
name: politica
on:
  pull_request:
    types: [opened, edited, reopened, synchronize, ready_for_review]
  pull_request_review:
    types: [submitted, edited, dismissed]
permissions:
  contents: read
  pull-requests: write
jobs:
  pr-police:
    uses: viralabs-dev/brabo-ci/.github/workflows/pr-police.yml@<sha>  # v1.0.0
    with:
      ci_ref: <sha>
  escada:
    uses: viralabs-dev/brabo-ci/.github/workflows/approval-ladder.yml@<sha>  # v1.0.0
    with:
      ci_ref: <sha>
```

Promoção e carimbo:

```yaml
on:
  workflow_dispatch:
  push:
    branches: [dev, main]
jobs:
  promover:
    if: github.event_name == 'workflow_dispatch'
    uses: viralabs-dev/brabo-ci/.github/workflows/promote.yml@<sha>  # v1.0.0
    with: { ci_ref: <sha>, par: 'dev->main' }
    secrets: { BOT_TOKEN: '${{ secrets.BOT_TOKEN }}' }
  carimbar:
    if: github.event_name == 'push'
    uses: viralabs-dev/brabo-ci/.github/workflows/tag-release.yml@<sha>  # v1.0.0
    with: { ci_ref: <sha> }
    secrets: { BOT_TOKEN: '${{ secrets.BOT_TOKEN }}' }
```

Gatilhos dos outros: `backmerge-gate` e `promotion-check` em `pull_request` (`opened, reopened, synchronize, edited`); `archive-merged-branch` em `schedule` (`0 12 * * 1`) e `workflow_dispatch`; `dependabot-para-dev` em `push` na `dev`, `workflow_dispatch` e `pull_request_target` (`opened, reopened`, base `main`). Em PR, nunca ponha `if:` no job que chama `pr-police`, `approval-ladder`, `backmerge-gate` ou `promotion-check` (check obrigatório que se pula deixa veredito velho colado).

Atenção a `permissions`: o job que chama precisa conceder pelo menos o que o reutilizável declara (por exemplo `contents: write` em `tag-release` e `archive-merged-branch`).

## Desenvolvimento

```
pnpm install
pnpm test          # vitest dos scripts
pnpm typecheck
pnpm actions:pinadas
```

Branches permanentes: `dev` e `main`. Toda tag nasce de workflow. Licença MIT.

## Repositórios do Brabo

Este repo não depende de nenhum outro e é usado por todos: cada repo chama os reutilizáveis daqui pelo próprio `politica.yml` e carimba as tags pelo `tag-release.yml`.

O Brabo é dividido em repositórios por camada (ADR 0252), e o [brabo](https://github.com/viralabs-dev/brabo) é o centro da documentação (<https://viralabs-dev.github.io/brabo/prd/>).

| repo | papel | depende de | é usado por |
|---|---|---|---|
| [brabo](https://github.com/viralabs-dev/brabo) | produto: documentação, instalador, release | todos | infra, workspace |
| [brabo-api](https://github.com/viralabs-dev/brabo-api) | API | contracts, ci, infra | brabo, infra, qa, web, contracts |
| [brabo-engine](https://github.com/viralabs-dev/brabo-engine) | engine Elixir | contracts, ci | brabo, infra, qa |
| [brabo-web](https://github.com/viralabs-dev/brabo-web) | interface web | contracts, ci, api | brabo, infra |
| [brabo-runner](https://github.com/viralabs-dev/brabo-runner) | CLI na máquina do usuário | contracts, ci | brabo, infra |
| [brabo-broker](https://github.com/viralabs-dev/brabo-broker) | broker de containers | contracts, ci | brabo, infra, qa |
| [brabo-contracts](https://github.com/viralabs-dev/brabo-contracts) | contratos compartilhados | ci | api, broker, runner, web, engine, infra, brabo |
| [brabo-infra](https://github.com/viralabs-dev/brabo-infra) | composes, k8s, backup | ci, api, engine, web, runner, broker, contracts, brabo | brabo, qa, api |
| [brabo-ci](https://github.com/viralabs-dev/brabo-ci) | workflows reutilizáveis | — | todos |
| [brabo-qa](https://github.com/viralabs-dev/brabo-qa) | E2E, golden-sets | ci, api, engine, broker, infra | brabo |
| [brabo-workspace](https://github.com/viralabs-dev/brabo-workspace) | pasta-mãe | ci | — |

## Origem

Extraído com histórico do monorepo `daneiel/brabo` (hoje [`viralabs-dev/brabo-legacy`](https://github.com/viralabs-dev/brabo-legacy), arquivado) em 04/11/2026; `#NNN` nas mensagens virou `daneiel/brabo#NNN`, que o GitHub redireciona para o `brabo-legacy`.
