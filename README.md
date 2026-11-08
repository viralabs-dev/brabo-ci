# brabo-ci

Política de PR, branch, escada de aprovação, promoção, carimbo de tag, arquivamento e Dependabot do Brabo, como **workflows reutilizáveis** (`on: workflow_call`), mais os modelos de comunidade. A lógica mora em `scripts/ci/` (TypeScript executado pelo Node por type stripping, testado com vitest).

## Como funciona

Cada workflow reutilizável faz um segundo checkout deste repositório em `.brabo-ci/` e roda `node .brabo-ci/scripts/ci/<script>.ts` a partir da raiz do repositório que chama. Por isso todos têm o input `ci_ref`: o **mesmo SHA de 40 hex** que você pôs no `uses:`. Ele é obrigatório e não tem padrão: um `uses:` não lê `${{ }}` e o reutilizável não sabe o próprio SHA, então quem chama repete o SHA. Tag ou input ausente rodaria o YAML de uma versão com os scripts de outra.

Todo job que roda `.brabo-ci/...` começa com esse checkout mínimo e, logo depois, `uses: ./.brabo-ci/.github/actions/preparar` (`ci_ref`, e `dependencias: true` se o script importa pacote npm). A `preparar` confere o formato do `ci_ref` (40 hex), instala o Node de `.node-version` (o lugar único) e, se pedido, as dependências de produção com o pnpm pinado. Ela é LOCAL de propósito: um `uses:` remoto não aceita `${{ inputs.ci_ref }}`, e uma action remota pinada ficaria de SHA diferente dos scripts. O spec `workflows-reutilizaveis.spec.ts` reprova quem pular a `preparar` ou fixar `node-version:`. A action `vinculos` fica fora: roda no job de quem chama, e um `setup-node` dentro dela trocaria o Node dos passos seguintes; ela degrada com `::warning::` e nunca reprova.

Os gatilhos (`on:`) ficam no repositório que chama. `vars` (`APPROVAL_MODE`, `OWNER_HANDLE`, `APROVADORES_*`) são lidas do repositório ou da organização que chama.

Pine sempre por SHA: `uses: viralabs-dev/brabo-ci/.github/workflows/pr-police.yml@<sha>  # v1.0.0`.

## Workflows

| Workflow | Inputs | Secrets | Faz |
|---|---|---|---|
| `pr-police.yml` | `ci_ref` | - | forma do PR (nome, origem, destino) e a label de família |
| `approval-ladder.yml` | `ci_ref` | - | aprovações certas por degrau (usa as vars acima); dispensa PR do Dependabot e a de regeneração do bot (`chore/regenera-gerados`, ADR 0255) na `dev` |
| `qa-e2e-gatilho.yml` | `ci_ref`, `espera_minutos` | `APP_ID`, `APP_PRIVATE_KEY` | `disparar`: PR com base `main` escolhe as tags, cria o check `E2E do brabo-qa` e dispara `e2e-pr` no brabo-qa com `{repo, pr, head_sha, check_run_id, compose_ref, imagens, origem, motivos, semDono, tocadas}` (`motivos`/`semDono`/`tocadas` = a seleção pelo mapa, só informação na `main`, AT-791; `origem` = repo, PR, SHA, ator, `run_url` e `correlacao` do run de origem; o gatilho escreve o Vínculos no Summary dele, AT-773) (`imagens` por tag, `ghcr.io/viralabs-dev/<imagem>:<tag>`; o brabo-qa espera a publicação e resolve o digest); `regressivo-dev`: PR com base `dev` seleciona as funcionalidades tocadas pelo catálogo `brabo-qa/funcionalidades.yml` (`qa-regressivo-selecao.ts`: arquivo transversal vira nada, catálogo inteiro ou smoke + aviso de "sem dono"), usa a imagem `sha-<12>` do head e publica o check `Regressivo do brabo-qa`, que só atesta, nunca é exigido e nunca derruba a PR (o chamador declara `branches: [dev, main]`; funcionalidade sem spec aparece como "sem cobertura"); Antes do vermelho por ambiente ou assinatura, `disparar` e `regressivo-dev` esperam (input `espera_minutos`, padrão 10) a tag `-dev` do head, a imagem e a assinatura cosign dela (AT-790, RN-1066); `aceitar`: `/qa-aceitar <justificativa>` do `OWNER_HANDLE` aceita falha de `spec`/`ambiente` (nunca `digest` nem `assinatura`; preserva o relatório do vermelho e cita a recomendação, AT-791) |
| `dependencias-de-merge.yml` | `ci_ref` | `APP_ID`, `APP_PRIVATE_KEY` | a PR declara `Depende-de: viralabs-dev/<repo>#<n>` (uma por linha, só os 11 repos do Brabo) e o check `Dependências de merge`, publicado pelo App, fica amarelo (`in_progress`, "esperando viralabs-dev/<repo>#<n>") até cada PR citada estar MERGED; `success` sem dependência ou com todas mergeadas; `failure` para owner/repo inválido, linha malformada, autorreferência, PR inexistente, fechada sem merge ou ciclo (até a profundidade 5). Nunca `neutral`. `avaliar` roda em `opened`/`edited`/`synchronize`/`reopened`; `avisar-dependentes` roda quando uma PR é mergeada (`closed` com `merged`), procura as PRs abertas que a citam nos outros repos e atualiza o check delas. Sem `checks: write` no App (403) só loga um aviso. O chamador declara os gatilhos e passa os secrets. A rede de hora em hora é o `dependencias-de-merge-rede.yml` do próprio brabo-ci, que só roda depois que ele chegar à `main` (`schedule` só lê a branch padrão) (AT-787) |
| `painel.yml` (próprio, não reutilizável) | `prs`, `tag` (manual) ou `repository_dispatch` `painel` | `APP_ID`, `APP_PRIVATE_KEY` (do repo) | o painel da mudança (AT-792): uma run que junta as runs de todos os repos de uma mudança (PR, E2E do brabo-qa, merge, carimbo, tag, release) numa tabela + Mermaid no Summary. Acordado pelo passo "Avisar o painel" do `dependencias-de-merge.yml`; nunca reprova e não publica check nas PRs. Ver `docs/painel-da-mudanca.md` |
| `publish-npm.yml` | `tag`, `pacotes` (diretórios, um por linha), `ci_ref` | - | publica pacotes npm no GitHub Packages a partir da tag (`vX.Y.Z-dev.N` com dist-tag `dev`, `vX.Y.Z` com `latest`): `pnpm pack`, `actions/attest` sobre o `.tgz` e `npm publish` desse mesmo arquivo; republicar a mesma versão só passa se a integridade bater. Permissões: `packages: write`, `id-token: write`, `attestations: write` (AT-770) |
| `contracts-alinhado.yml` | `ci_ref` | - | a versão do brabo-contracts é a mesma no alias do `package.json`, no lock e nas constantes dos scripts de download; avisa, sem falhar, se difere do `componentes.json` do brabo. Não é check obrigatório (AT-770) |
| `refs-com-simbolo.yml` | `ci_ref` | - | num irmão, cada ref `caminho:N` (`símbolo`) das RNs (`docs/business-rules*`) tem de apontar para onde o símbolo mora: a ref interna quebrada reprova; a ref para outro irmão só é listada no Summary (sem anotação; quem confere é a subida da trava do brabo). `--escrever` reancora no checkout e o job sobe o artefato `refs-patch` com o diff e a receita de `git apply` no Summary. Não é check obrigatório (AT-782) |
| `cadeia.yml` | `ci_ref` | - | cadeia de suprimentos do CI do chamador: `actionlint` (com o `actionlint.yaml` do brabo-ci) e `pins` (todo `uses:` por SHA com `# vX`, em `.github/workflows` e `.github/actions`, por `actions-pinadas.ts --raiz .`). Chame pelo `ci.yml`, não pelo `politica.yml`. Não é check obrigatório (AT-819). Tem também o job `pins-do-brabo-ci` (AT-817, ADR 0280, informativo): cada `uses: viralabs-dev/brabo-ci/...@<sha>  # vX.Y.Z[-dev.N]` precisa de comentário em forma de versão, SHA igual ao da tag (API `git/ref/tags`) e, pela `branch_alvo` (padrão: base da PR), release final na `main` e final ou `-dev.N` na `dev` |
| `backmerge-gate.yml` | `ci_ref` | - | trava de retropropagação depois de hotfix |
| `promotion-check.yml` | `ci_ref` | - | estado do PR de promoção (range, tag do degrau) |
| `promote.yml` | `ci_ref`, `par` (padrão `dev->main`) | `BOT_TOKEN` (opcional) | abre o PR de promoção; o merge é humano |
| `tag-release.yml` | `ci_ref` | `BOT_TOKEN` (opcional; obrigatório para hotfix) | carimba a tag do estágio, trava e destrava o gate; a mensagem da tag termina em `Carimbo: <url do run>` (AT-773) |
| `archive-merged-branch.yml` | `ci_ref` | - | arquiva branch mergeada em `refs/archive/` |
| `dependabot-para-dev.yml` | `ci_ref` | - | fecha ou redireciona PR de segurança do Dependabot para a `dev` |

## Actions compostas

| Action | Inputs | Faz |
|---|---|---|
| `.github/actions/vinculos` | `origem` (JSON `{repo, pr?, sha, ator, run_url?, evento?}`; vazio = este run), `irmaos` (uma linha por irmão: caminho de checkout ou `owner/repo@sha`), `destino` e `disparados` (uma linha `rótulo\|url`) | escreve `## Vínculos` (tabela e diagrama Mermaid) no Summary do run e grava `vinculos.md` (output `arquivo`). Valida cada valor por regex (o que não casa vira `?` e `::warning::`) e **nunca reprova o job**. Usa o `node` do runner, que precisa ser ≥ 22.18 (sem `setup-node`). AT-773 |

```yaml
- uses: viralabs-dev/brabo-ci/.github/actions/vinculos@<sha>  # v1.0.0
  with:
    irmaos: |
      ../brabo-infra
      viralabs-dev/brabo-api@<sha de 40 hex>
    destino: |
      Check E2E na PR|https://github.com/viralabs-dev/brabo-api/runs/5
```

Os reutilizáveis que escrevem com o bot (`tag-release`, `promote`) aceitam `APP_ID` e `APP_PRIVATE_KEY` e geram o token do GitHub App DENTRO do próprio job (o token é mascarado e não atravessa jobs, então o chamador não consegue passá-lo como `BOT_TOKEN`). O chamador passa:

```yaml
secrets:
  APP_ID: ${{ secrets.BRABO_APP_ID }}
  APP_PRIVATE_KEY: ${{ secrets.BRABO_APP_PRIVATE_KEY }}
```

`BOT_TOKEN` segue aceito como alternativa. Ele é um PAT ou o token do GitHub App da organização. O nome do App e do secret ainda não foram registrados (lacuna declarada): passe o token que a organização definir.

Para subir a versão do contracts num consumidor, rode na raiz dele `scripts/ci/subir-contracts.sh <versão>` (troca o alias e as constantes, regenera o lock e recusa, restaurando tudo, se o lock mudar fora das entradas `@viralabs-dev/brabo-*`).

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

Cadeia de suprimentos (no `ci.yml` do repositório que chama; o `<sha>` do `uses:` e o `ci_ref` são o mesmo):

```yaml
jobs:
  cadeia:
    uses: viralabs-dev/brabo-ci/.github/workflows/cadeia.yml@<sha>  # v1.0.0
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
