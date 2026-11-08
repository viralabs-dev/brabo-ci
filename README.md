# brabo-ci

Política de PR, branch, escada de aprovação, promoção, carimbo de tag, arquivamento e Dependabot do Brabo, como **workflows reutilizáveis** (`on: workflow_call`), mais os modelos de comunidade. A lógica mora em `scripts/ci/` (TypeScript executado pelo Node por type stripping, testado com vitest).

## Como funciona

Cada workflow reutilizável faz um segundo checkout deste repositório em `.brabo-ci/` e roda `node .brabo-ci/scripts/ci/<script>.ts` a partir da raiz do repositório que chama. Por isso todos têm o input `ci_ref`: o **mesmo SHA de 40 hex** que você pôs no `uses:`. Ele é obrigatório e não tem padrão: um `uses:` não lê `${{ }}` e o reutilizável não sabe o próprio SHA, então quem chama repete o SHA. Tag ou input ausente rodaria o YAML de uma versão com os scripts de outra. Pine sempre por SHA, com `# vX.Y.Z` ao lado.

Todo job que roda `.brabo-ci/...` começa com esse checkout mínimo e, logo depois, `uses: ./.brabo-ci/.github/actions/preparar` (`ci_ref`, e `dependencias: true` se o script importa pacote npm). A `preparar` confere o formato do `ci_ref` (40 hex), instala o Node de `.node-version` (o lugar único) e, se pedido, as dependências de produção com o pnpm pinado. Ela é LOCAL de propósito: um `uses:` remoto não aceita `${{ inputs.ci_ref }}`, e uma action remota pinada ficaria de SHA diferente dos scripts. O spec `workflows-reutilizaveis.spec.ts` reprova quem pular a `preparar` ou fixar `node-version:`. A action `vinculos` fica fora: roda no job de quem chama, e um `setup-node` dentro dela trocaria o Node dos passos seguintes; ela degrada com `::warning::` e nunca reprova. Os gatilhos (`on:`) ficam no repositório que chama. `vars` (`APPROVAL_MODE`, `OWNER_HANDLE`, `APROVADORES_*`) são lidas do repositório ou da organização que chama.

## Workflows e actions

Cada linha leva à página dele em `scripts/ci/docs/reference/workflows/`, **gerada do próprio YAML** (`node scripts/ci/referencia-dos-workflows.ts`; o `ci.yml` roda com `--check` e reprova a página desatualizada): inputs, secrets, permissões que o job que chama precisa conceder, gatilhos recomendados, nomes dos checks e um exemplo de chamada. O propósito e os gatilhos vêm dos marcadores `# propósito:` e `# chamador:` no topo de cada YAML.

<!-- workflows:inicio -->
| Reutilizável | Propósito | Referência |
|---|---|---|
| `approval-ladder` | Exige as aprovações certas de cada degrau (dev ou main) conforme o modo solo ou community; dispensa a PR do Dependabot e a de regeneração do bot na dev. | [approval-ladder](scripts/ci/docs/reference/workflows/approval-ladder.md) |
| `archive-merged-branch` | Arquiva toda semana as branches já mergeadas e sem commit novo, movendo para refs/archive/<nome>; nunca apaga. | [archive-merged-branch](scripts/ci/docs/reference/workflows/archive-merged-branch.md) |
| `backmerge-gate` | Trava toda PR cujo destino aguarda a retropropagação de um hotfix; só a PR de main para dev passa enquanto a trava existir. | [backmerge-gate](scripts/ci/docs/reference/workflows/backmerge-gate.md) |
| `cadeia` | Cadeia de suprimentos do CI de quem chama: actionlint nos workflows e todo uses: preso a SHA com a versão em comentário. | [cadeia](scripts/ci/docs/reference/workflows/cadeia.md) |
| `contracts-alinhado` | Confere que a versão do brabo-contracts é a mesma no package.json, no lock e nos scripts de download; só avisa se difere do componentes.json do brabo. | [contracts-alinhado](scripts/ci/docs/reference/workflows/contracts-alinhado.md) |
| `dependabot-para-dev` | Fecha ou redireciona para a dev a PR de segurança do Dependabot que o GitHub abre contra a main. | [dependabot-para-dev](scripts/ci/docs/reference/workflows/dependabot-para-dev.md) |
| `dependencias-de-merge` | Faz o check Dependências de merge esperar as PRs citadas em `Depende-de: <org>/<repo>#<n>` até todas estarem mergeadas. | [dependencias-de-merge](scripts/ci/docs/reference/workflows/dependencias-de-merge.md) |
| `pr-police` | Confere a forma de toda PR (nome da branch, origem e destino), reprova com o código da violação e o conserto, e escreve a label de família. | [pr-police](scripts/ci/docs/reference/workflows/pr-police.md) |
| `promote` | Calcula a versão do ciclo e abre a PR de promoção de um degrau ao próximo (padrão dev->main); o merge continua humano. | [promote](scripts/ci/docs/reference/workflows/promote.md) |
| `promotion-check` | Confere o estado da PR de promoção: range limpo, tag do degrau de baixo carimbada e merge possível. | [promotion-check](scripts/ci/docs/reference/workflows/promotion-check.md) |
| `publish-npm` | Publica pacotes npm no GitHub Packages a partir da tag, com o .tgz atestado; -dev.N vai ao dist-tag dev e a versão final a latest. | [publish-npm](scripts/ci/docs/reference/workflows/publish-npm.md) |
| `qa-e2e-gatilho` | Liga a PR ao brabo-qa: na base main cria o check E2E do brabo-qa e dispara o e2e-pr; na base dev roda o regressivo das funcionalidades tocadas; /qa-aceitar aceita falha de spec ou ambiente. | [qa-e2e-gatilho](scripts/ci/docs/reference/workflows/qa-e2e-gatilho.md) |
| `refs-com-simbolo` | Confere que cada ref caminho:N (símbolo) das regras de negócio aponta para onde o símbolo mora; ref interna quebrada reprova. | [refs-com-simbolo](scripts/ci/docs/reference/workflows/refs-com-simbolo.md) |
| `tag-release` | Carimba a tag do estágio a cada merge numa permanente e, se o merge foi um hotfix, trava o gate e abre as PRs de retropropagação. | [tag-release](scripts/ci/docs/reference/workflows/tag-release.md) |
| `preparar` | Depois do checkout mínimo do brabo-ci em .brabo-ci/, confere o ci_ref, instala o Node e, se pedido, as dependências de produção dos scripts. | [preparar](scripts/ci/docs/reference/workflows/preparar.md) |
| `vinculos` | Escreve a tabela Vínculos (origem, irmãos, destino) e o diagrama Mermaid no Summary do run; nunca reprova o job. | [vinculos](scripts/ci/docs/reference/workflows/vinculos.md) |
<!-- workflows:fim -->

Quem escreve com o bot (`tag-release`, `promote`) aceita `APP_ID` e `APP_PRIVATE_KEY` (o token nasce dentro do job) ou `BOT_TOKEN`. Para subir a versão do contracts num consumidor, rode nele `scripts/ci/subir-contracts.sh <versão>` (num lock semeado só as entradas do contracts são trocadas; ele também põe `minimumReleaseAgeExclude` no `pnpm-workspace.yaml`). Em outra org ou num fork, veja [usar em outra org](scripts/ci/docs/explanation/usar-em-outra-org.md).

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

Em PR, nunca ponha `if:` no job que chama `pr-police`, `approval-ladder`, `backmerge-gate` ou `promotion-check`: check obrigatório que se pula deixa veredito velho colado ([lição](scripts/ci/docs/explanation/licoes-do-ci.md)). Para a política em si, comece pela [política em 10 minutos](scripts/ci/docs/explanation/politica-em-10-minutos.md).

## Reutilizáveis sem chamador (AT-819)

Nenhum dos 11 repos chamava estes seis em `origin/dev` (conferido em 08/11/2026). Nada foi apagado: cada um tem destino e motivo. "Biblioteca para adoção" quer dizer que o reutilizável é suportado e testado aqui, para quem adotar a política do brabo-ci fora do Brabo (EP-034) ou quando um repo passar a precisar dele.

| Reutilizável | Destino | Motivo |
|---|---|---|
| `dependencias-de-merge.yml` | a ligar (por PR em cada repo, fora desta) | Decidido na AT-787: o check é exigido em `dev` e `main`. Falta o `checks: write` no App e as provas; só então o chamador entra e o required liga. Os scripts e a rede de hora em hora (`dependencias-de-merge-rede.yml`) já usam o código. |
| `promote.yml` | biblioteca para adoção | Abre a PR de promoção `dev->main`, que hoje o dono abre à mão ou por script local. Quando ligar, a AT-788 acrescenta o `Depende-de` automático. Sem plano de repo e sem efeito seguro de ligar sem a decisão do dono. |
| `archive-merged-branch.yml` | biblioteca para adoção | Rotina semanal da AT-661 (segunda, `0 12 * * 1`), que rodava no monorepo. Nenhum repo separado a agendou ainda; arquivar branch é efeito destrutivo no remoto e pede escolha do repo e do dono. |
| `backmerge-gate.yml` | biblioteca para adoção | Trava de retropropagação depois de hotfix. Só faz sentido onde há `hotfix/`; a nota não nomeia o repo. |
| `promotion-check.yml` | biblioteca para adoção | Estado da PR de promoção. Só vale como check da `main` e depende de `promote`/carimbo; sem chamador ele não bloqueia nada. |
| `dependabot-para-dev.yml` | biblioteca para adoção | Redireciona PR de segurança do Dependabot para a `dev`. Os repos hoje tratam isso pela política de PR e pelo `dependabot.yml`; ligar muda o fluxo de segurança. |

`claude.yml` e `claude-code-review.yml` já foram aposentados (AT-821, ci#35). Aposentar de fato (apagar) um destes seis exige tirar a linha desta tabela no mesmo PR.

## Desenvolvimento

```
pnpm install
pnpm test          # vitest dos scripts, com piso de cobertura (coverage.thresholds no vitest.config.ts)
pnpm typecheck
pnpm actions:pinadas
```

O `ci.yml` do próprio brabo-ci roda quatro jobs (AT-820): `actionlint`; `shell` (shellcheck v0.10.0 por sha256 em `scripts/ci/*.sh`); `segredos` (gitleaks por sha256, `gitleaks dir`, que varre a árvore, com o `.gitleaks.toml` sem allowlist); e `testar` (vitest com piso de cobertura, typecheck e `actions:pinadas`). O piso é à mão: sobe quando a cobertura sobe, nunca desce. Não há job que chame o `pr-police`/`approval-ladder` locais com o código da PR (dogfood): os dois reutilizáveis têm `concurrency` por PR e, no mesmo grupo do `politica.yml`, um cancelaria o outro, derrubando o check exigido. O exigido é sempre o `politica.yml` pinado por SHA, que a PR não consegue alterar.

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

## Apoie

Se o projeto te ajuda, você pode [pagar um café no Ko-fi](https://ko-fi.com/daneiel).
