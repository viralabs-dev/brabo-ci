---
id: rn-ci-parte-02
title: 'Regras de negócio — CI — parte 2 (desde RN-1031)'
sidebar_label: 'CI — parte 2 (desde RN-1031)'
description: 'As RNs hospedadas na raiz ci.'
keywords: [regras de negócio, ci]
---

# CI — parte 2 (desde RN-1031)

## O regressivo por funcionalidade e os vínculos dos runs (RN-1031..1035, RN-1043..1045)

<a id="rn-1031"></a>

### RN-1031 — O catálogo de funcionalidades e o mapa caminho → funcionalidade moram num arquivo só, e a spec se liga por tag {#rn-1031}

`brabo-qa/funcionalidades.yml` é a única fonte: cada funcionalidade tem `id`
(kebab-case, estável, nunca renomeado; aposentar é `status: aposentada`),
`nome`, `descricao`, `tema` (do `temas.yml` dos ADRs), `status` e
`caminhos: {<repo>: [globs]}`. Mora no `brabo-qa`, e não no `brabo-contracts`,
porque o contracts é consumido por TAG e cada ajuste do mapa viraria tag e bump
em seis consumidores. A spec do Playwright se liga à funcionalidade pela tag do
próprio teste (`{ tag: '@f-<id>' }`) e o filtro é `--grep`: o catálogo não
guarda lista de arquivos. Um teste do `brabo-qa` reprova id repetido ou fora de
kebab-case, tema fora do `temas.yml`, glob que não casa nenhum arquivo do irmão
(mapa podre) e tag `@f-<id>` sem entrada; funcionalidade sem spec é só listada.

- **Código:** `funcionalidades.yml:1` (o catálogo e o contrato do arquivo),
  `scripts/ci/funcionalidades.ts:29` (`validarCatalogo`)
- **Teste:** `scripts/ci/funcionalidades.spec.ts` (o validador) e
  `scripts/ci/qa-regressivo-catalogo-real.spec.ts:12` (o catálogo real tem as 14
  funcionalidades ativas e globs que casam)
- **ADR:** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **Origem:** AT-769 (EP-033)

<a id="rn-1032"></a>

### RN-1032 — A PR para a `dev` roda o regressivo só das funcionalidades que tocou, sob o check `Regressivo do brabo-qa`, que NUNCA é exigido {#rn-1032}

Na PR com destino `dev`, o job `regressivo-dev` do `qa-e2e-gatilho.yml` cruza os
arquivos da PR com o mapa de [RN-1031](#rn-1031) e dispara o `brabo-qa` com as
funcionalidades tocadas. O resultado volta como o check `Regressivo do
brabo-qa`, criado pelo App no `head_sha`: `success`, `failure` (visível, mas o
merge segue livre) ou `neutral` (nada tocado, só docs, PR de fork, repositório
sem spec). O nome é distinto do `E2E do brabo-qa` de propósito: o ruleset "main
exige E2E" amarra esse contexto, e o regressivo nunca entra em ruleset algum
(o `rulesets.md` registra a linha "não exigido"). O job tem `continue-on-error`,
o `/qa-aceitar` não se aplica na `dev`, e o App comenta uma vez, como lembrete,
quando o mapa diz que a funcionalidade foi tocada e nenhuma spec `@f-<id>`
mudou.

- **Código:** `.github/workflows/qa-e2e-gatilho.yml:74` (o job
  `regressivo-dev`, com `continue-on-error`), `scripts/ci/qa-e2e-resumo.ts:22`
  (o nome do check por modo), `scripts/ci/qa-regressivo-lembrete.ts` (o
  comentário único do lembrete)
- **Teste:** `scripts/ci/qa-e2e-resumo.spec.ts` (o nome por modo) e
  `scripts/ci/qa-regressivo-selecao.spec.ts:33` (a seleção por mapa) e
  `scripts/ci/qa-regressivo-lembrete.spec.ts` (o lembrete)
- **ADR:** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **Origem:** AT-769 (EP-033)

<a id="rn-1033"></a>

### RN-1033 — Três regras de arquivo transversal valem antes do mapa: nada, catálogo inteiro e sem dono {#rn-1033}

Na ordem: (1) docs, `*.md`, `CHANGELOG.md`, `.github/**` (exceto o próprio
`qa-e2e.yml`), testes do repositório e `.claude/**` não tocam funcionalidade, e
o check sai `neutral`; (2) lockfiles e manifestos, `Dockerfile`, a entrada da
app, schema e migrações, o cliente do web, `config/**` do engine e a suíte do
`brabo-qa` (`e2e/suporte/**`, `playwright.config.ts`) rodam o catálogo inteiro,
e a subida de TAG do contracts cai aqui; (3) caminho que nenhum glob casa roda o
smoke `instalacao` + `autenticacao` e o resumo o lista como "sem dono no mapa",
para o mapa ser corrigido. O `brabo-contracts` não tem regressivo na própria PR.

- **Código:** `scripts/ci/qa-regressivo-selecao.ts:67` (`selecionar`),
  `scripts/ci/qa-regressivo-selecao.ts:43` (`SMOKE`)
- **Teste:** `scripts/ci/qa-regressivo-selecao.spec.ts:41` (regra 1),
  `:55` (regra 2 por repositório), `:58` (regra 3)
- **ADR:** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **Origem:** AT-769 (EP-033)

<a id="rn-1075"></a>

### RN-1075 — O `brabo-runner` se atesta pelo próprio CI: o binário linux-x64 entra na PR, e o contrato com o engine só é provado no TP-01 {#rn-1075}

O `brabo-runner` não tem `qa-e2e.yml`, imagem nem spec `@f-runner`/`@f-projetos` no `brabo-qa`; o regressivo do catálogo não roda na PR dele (decisão do dono de 08/11/2026, opção b). A PR se atesta pelo job `runner` do `ci.yml` dele: lint, tipos, testes, `dist` com `smoke` e o binário linux-x64 com `build:bin` + `smoke:bin` (`--self-test-pty`, PTY real). O **contrato runner ↔ engine** (join com ticket, capacidades, exec, pasta) **não** é provado na PR: só no TP-01 ao vivo. As chaves `runner` do `funcionalidades.yml` ficam no catálogo e servem só ao mapa.

- **Código:** job `runner` do `.github/workflows/ci.yml` do `brabo-runner`
- **Teste:** o próprio job (log com `ok:` do `--self-test-pty`)
- **ADR:** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **Origem:** AT-853 (EP-033)

<a id="rn-1034"></a>

### RN-1034 — A PR para a `main` roda o catálogo inteiro no `E2E do brabo-qa`, e funcionalidade sem spec aparece como "sem cobertura" sem reprovar {#rn-1034}

O check `E2E do brabo-qa` ([ADR 0267](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0267-o-e2e-do-brabo-qa-e-portao-da-main.md))
roda todas as specs e monta a tabela `funcionalidade | specs | resultado`.
Funcionalidade do catálogo sem spec entra como `sem cobertura` e **não
reprova** (decisão do dono de 06/11/2026): com a regra oposta a `main` ficaria
vermelha por semanas e o `/qa-aceitar` viraria rotina. Os testes que existem
passam sem alteração; vermelho de `spec` ou `ambiente` segue aceitável por
`/qa-aceitar`, e de `digest` ou `assinatura` nunca.

- **Código:** `scripts/ci/qa-e2e-resumo.ts:28` (o resultado `sem cobertura` na
  linha da tabela), `scripts/ci/qa-e2e-resumo.ts:22` (o nome do check da `main`)
- **Teste:** `scripts/ci/qa-e2e-resumo.spec.ts` (a tabela e a linha sem
  cobertura)
- **ADR:** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **Origem:** AT-769 (EP-033)

<a id="rn-1035"></a>

### RN-1035 — A PR para a `dev` publica a imagem `sha-<12>` assinada, só do próprio repositório, e a limpeza apaga as órfãs {#rn-1035}

Para o regressivo ter o que rodar, o `ci.yml` de api, engine, web e broker
publica `ghcr.io/viralabs-dev/brabo-<app>:sha-<12 primeiros do head>` também
quando a base é `dev`, com Trivy e `cosign sign` keyless, como na `main`. PR de
fork não recebe segredo: a imagem é pulada e o regressivo diz "não roda em PR de
fork". O gatilho usa a `sha-<12>` no repositório da PR e a `-dev.N` mais nova
nos outros. Cada `synchronize` deixa uma `sha-*` órfã, então o
`limpeza-ghcr.yml` apaga toda `sha-*` de PR fechada e as com mais de 7 dias.

- **Código:** `scripts/ci/qa-e2e-imagens.ts:83` (a escolha de `sha-<12>` para
  `dev` e `hotfix`)
- **Teste:** `scripts/ci/qa-e2e-imagens.spec.ts` (a escolha por base)
- **ADR:** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **Origem:** AT-769 (EP-033)

<a id="rn-1043"></a>

### RN-1043 — Todo run que lê outro repositório publica `## Vínculos` no topo do Summary, e o helper nunca reprova o job {#rn-1043}

Pela action `vinculos` do `brabo-ci`, o Summary de cada job que liga repositórios
traz a tabela `## Vínculos` (origem, irmãos `repo@SHA` com link, destino e runs
disparados) e um diagrama Mermaid, logo depois dos checkouts. Todo valor passa
por regex antes de entrar no Markdown: repositório `viralabs-dev/brabo(-x)?`,
SHA de 40 hex, PR numérica, URL do GitHub da organização, ator. O que não casa
vira `?` e um `::warning::`. A `origem` inválida é só descartada, com aviso. O
step leva `continue-on-error`: o helper nunca reprova um job. No `brabo`, o
`docs-check`, o `docs-deploy`, o `docs-audit` e o `regenera-gerados` passam os
SHAs do `.git/irmaos-sha.lst` que o `montar-layout.sh` grava
([ADR 0274](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0274-os-gerados-leem-os-irmaos-por-uma-trava-de-shas.md)), e o
`release.yml` passa o `infra` por caminho.

- **Código:** `scripts/ci/vinculos.ts:57` (`montar`), `.github/actions/vinculos/action.yml:31`
  (o `continue-on-error`), `scripts/ci/validar-payload.ts:112` (`validarOrigem`),
  `.github/workflows/docs-check.yml:89` (o `brabo` repassa os irmãos)
- **Teste:** `scripts/ci/vinculos.spec.ts` (fixtures, valor malicioso, origem
  vazia) e `scripts/ci/validar-payload.spec.ts`
- **ADR:** [0271](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0271-os-runs-do-actions-mostram-os-vinculos-entre-os-repos.md)
- **Origem:** AT-773 (EP-033)

<a id="rn-1044"></a>

### RN-1044 — O run de destino de um dispatch ou de uma tag tem `run-name` com a origem, e a correlação do dispatch vai no nome como `c=<run_id>-<attempt>` {#rn-1044}

O `run-name` de um reutilizável é ignorado: vale o do chamador. O `e2e-pr.yml`
do `brabo-qa` se chama `E2E ← <repo>#<pr> · <sha7> · <ator> · c=<correlação>`
(`Regressivo ← …` no modo dev); os runs disparados por tag, como `release` e
`install-e2e` do `brabo`, `release <tag> ← tag do carimbo`. O `repository_dispatch`
responde 204 sem id, e o `client_payload` não aparece na API de runs; só o
`display_title` fica consultável. Por isso o gatilho manda `origem.correlacao =
<run_id>-<attempt>`, que entra no `run-name`, e o `qa-e2e-disparar.ts` consulta
os runs do `brabo-qa` a cada 5 s por até 60 s, casando o `c=`. O `attempt` torna a
correlação única por re-run. Payload antigo, sem `origem`, gera campos vazios e
não quebra. A origem de um run disparado por tag sai da linha `Carimbo: <url>` que
o `tag-release` grava na mensagem da tag anotada.

- **Código:** `scripts/ci/qa-e2e-imagens.ts:113` (`origem.correlacao` no
  payload), `scripts/ci/qa-e2e-vinculos.ts:18` (`acharRun`),
  `scripts/ci/qa-e2e-disparar.ts:133` (a correlação), `scripts/ci/tag-release.ts:35`
  (`comCarimbo`), `.github/workflows/release.yml:3` (o `run-name` da tag)
- **Teste:** `scripts/ci/qa-e2e-vinculos.spec.ts` (o casamento do `c=`) e
  `scripts/ci/qa-e2e-imagens.spec.ts`
- **ADR:** [0271](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0271-os-runs-do-actions-mostram-os-vinculos-entre-os-repos.md)
- **Origem:** AT-773 (EP-033)

<a id="rn-1045"></a>

### RN-1045 — O check do App aponta para o run do `brabo-qa` desde o início, e o run de origem registra o link do run disparado {#rn-1045}

O job `anunciar` do `e2e-pr.yml`, sem `needs` e em paralelo ao `e2e`, atualiza o
check pelo `check_run_id` do payload com `details_url` do run do `brabo-qa` e os
Vínculos, com o token do App só com `checks: write` e checkout limpo da `dev`. O
`fechar` mantém o `details_url` no fim e anexa os Vínculos. Falha do `anunciar` só
avisa. No run de origem, o gatilho escreve em `disparados` o run do `brabo-qa`
que achou pela correlação de [RN-1044](#rn-1044); se não achou em 60 s, registra o
link do check (que já aponta para o qa) e um aviso. O `alarmar-prova.sh` anexa o
`vinculos.md` ao corpo da issue quando o arquivo existe.

- **Código:** `scripts/ci/fechar-check.ts:39` (os Vínculos no fechamento),
  `scripts/ci/qa-e2e-vinculos.ts:42` (`vinculosDoGatilho`),
  `scripts/ci/qa-e2e-disparar.ts:154` (o aviso quando o run não é achado)
- **Teste:** `scripts/ci/fechar-check.spec.ts` e `scripts/ci/qa-e2e-vinculos.spec.ts`
- **ADR:** [0271](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0271-os-runs-do-actions-mostram-os-vinculos-entre-os-repos.md)
- **Origem:** AT-773 (EP-033)

## Publicação de pacotes npm (RN-1042)

<a id="rn-1042"></a>

### RN-1042 — O pacote só sai pela tag, com o dist-tag da versão e a mesma versão em todos os pacotes {#rn-1042}

O `publish-npm.yml` é reutilizável e roda quando o chamador dispara pela tag
(`on: push: tags: ['v*']`). `scripts/ci/publish-npm.ts` tira a versão da tag
(sem o `v`) e aceita só `vX.Y.Z` ou `vX.Y.Z-dev.N`; qualquer outra forma reprova
antes de publicar. A `-dev.N` vai ao dist-tag `dev`; a final vai ao `latest`, e
um pré-release avulso nunca toma o `latest`. Cada pacote da lista recebe a mesma
versão (`npm version --no-git-tag-version`) antes do `pnpm pack`, e o
`actions/attest` e o `npm publish` usam o mesmo `.tgz`, sem `--provenance`.
Republicar a versão só passa se o registry já guarda o mesmo arquivo (mesma
`dist.integrity`); outra integridade reprova.

- **Código:** `scripts/ci/publish-npm.ts:17` (`versaoDaTag`), `scripts/ci/publish-npm.ts:25`
  (`distTag`), `.github/workflows/publish-npm.yml:90` (a mesma versão nos pacotes),
  `.github/workflows/publish-npm.yml:100` (o `npm publish` do mesmo `.tgz`)
- **Teste:** `scripts/ci/publish-npm.spec.ts` (dist-tag `dev` e `latest`, tira o `v`)
- **Origem:** AT-770 (EP-033)

## Dependência de merge entre repositórios (RN-1047..1050)

<a id="rn-1047"></a>

### RN-1047 — A PR declara a dependência com `Depende-de: viralabs-dev/<repo>#<n>`, e a linha malformada reprova em vez de passar calada {#rn-1047}

Cada dependência de merge da PR é uma linha do corpo, `Depende-de:` seguido de
`viralabs-dev/<repo>#<n>`, em qualquer lugar do texto, com ou sem `- ` na frente.
A regra casa linha por linha e não ignora caixa. O repo tem de estar na lista dos
11 repositórios `brabo*` do mapa da pasta-mãe, o owner tem de ser `viralabs-dev`,
a PR não pode citar a si mesma e a PR citada tem de existir (404 reprova). Uma
linha que começa como declaração (`Depende-de` ou `depende de`) mas não casa a
regra reprova com o motivo, para que um erro de digitação não faça a dependência
sumir. O corpo é texto de terceiro: vai ao script por variável de ambiente, nunca
interpolado num `run:`.

- **Código:** `scripts/ci/dependencias-de-merge.ts` (a regra e a validação), a ser
  publicado no `brabo-ci`; ainda não existe na `dev` do `brabo`
- **Teste:** `scripts/ci/dependencias-de-merge.spec.ts`, com a regex, a allowlist,
  o owner, a autorreferência e a linha malformada
- **ADR:** [0276](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **Origem:** AT-787 (EP-033)

<a id="rn-1048"></a>

### RN-1048 — O check `Dependências de merge` tem quatro estados, nunca `neutral`, e a espera é amarela {#rn-1048}

O check é publicado pelo App no `head_sha` da PR, com o nome `Dependências de
merge`. Sem linha `Depende-de`, sai `success` "Sem dependências declaradas", e
ele sempre publica, para não deixar um check velho colado. Com alguma dependência
`OPEN`, sai `in_progress` (amarelo), com o título `esperando viralabs-dev/<repo>#<n>`
listando as que faltam. Com todas `MERGED`, sai `success` "Dependências mergeadas".
Com uma dependência `CLOSED` sem merge, com linha inválida, com ciclo ou com 404,
sai `failure` com o motivo; a dependência fechada sem merge pede que se tire a
linha ou se aponte a PR que a substituiu, e não espera para sempre. `neutral` não
é usado em nenhum caso, porque para um ruleset ele conta como verde. O job em si
usa `continue-on-error`: o que reprova é o check, e a falha do job só avisa.

- **Código:** `scripts/ci/dependencias-de-merge.ts` (a função pura de avaliação) e
  `.github/workflows/dependencias-de-merge.yml` (o reutilizável), no `brabo-ci`
- **Teste:** `scripts/ci/dependencias-de-merge.spec.ts`, um caso para cada estado
- **ADR:** [0276](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **Origem:** AT-787 (EP-033)

<a id="rn-1049"></a>

### RN-1049 — O merge da dependência atualiza o check das PRs que a citam, e o cron horário é só rede {#rn-1049}

Quando uma PR de um repo é mergeada, o job `avisar-dependentes`, no próprio
repo dono da PR mergeada, procura as PRs abertas da organização que citam a
mergeada no corpo e refaz a avaliação de cada uma. A busca é difusa, então cada
candidata tem o corpo reparseado pela regra de [RN-1047](#rn-1047) antes de
qualquer escrita. O check é atualizado com o token do App, sem reexecutar o
workflow da PR dependente. Um cron de hora em hora no `brabo-ci` refaz a mesma
varredura para as PRs abertas com `Depende-de`, e cobre o merge perdido quando o
run do repo dono quebra. O cron só liga quando o `brabo-ci` chegar à `main`,
porque o `schedule` só roda da branch padrão.

- **Código:** `scripts/ci/dependencias-de-merge.ts` (modo `avisar-dependentes`) e
  `.github/workflows/dependencias-de-merge.yml` (o job e o cron), no `brabo-ci`
- **Teste:** `scripts/ci/dependencias-de-merge.spec.ts`, com a busca simulada e o
  corpo que não casa mais
- **ADR:** [0276](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **Origem:** AT-787 (EP-033)

<a id="rn-1050"></a>

### RN-1050 — O ciclo de dependências reprova com o caminho inteiro, até a profundidade 5 {#rn-1050}

A avaliação segue as linhas `Depende-de` das dependências abertas, passo a passo,
até a profundidade 5. Se a cadeia volta à PR avaliada, o check reprova com o
caminho completo (`A → B → A`) e o link de cada PR do caminho. Profundidade maior
que 5 também reprova. A saída para o ciclo é editar o corpo de uma das PRs para
tirar a linha que fecha o ciclo: a PR não precisa de bypass.

- **Código:** `scripts/ci/dependencias-de-merge.ts` (o percurso até a profundidade 5), no `brabo-ci`
- **Teste:** `scripts/ci/dependencias-de-merge.spec.ts`, com o ciclo A↔B e a profundidade estourada
- **ADR:** [0276](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **Origem:** AT-787 (EP-033)

<a id="rn-1071"></a>

### RN-1071 — A PR de promoção depende das promoções abertas das camadas anteriores, e a ordem é uma lista testada {#rn-1071}

Numa PR com base `main` e head `dev` do próprio repo, o check `Dependências de
merge` soma às linhas `Depende-de` do corpo uma dependência para cada PR de
promoção aberta nos repos das camadas anteriores, mesmo que ninguém a tenha
escrito. A ordem é `CAMADAS_DE_PROMOCAO`: 0 brabo-ci; 1 brabo-contracts e
brabo-workspace; 2 brabo-api, brabo-engine, brabo-web, brabo-runner e brabo-broker;
3 brabo-infra; 4 brabo-qa; 5 brabo. Só conta a aresta em que a `main` do consumidor
usa um artefato final do produtor. O título mostra `esperando viralabs-dev/<repo>#<n>`.
Se um repo de camada anterior tem a `dev` à frente da `main` e nenhuma promoção
aberta, o check fica pendente e diz qual repo falta promover
(`esperando promoção de viralabs-dev/<repo> (a dev está à frente da main)`). A
abertura da promoção (`abrir-pr-de-promocao.sh`) também escreve as linhas
`Depende-de` das promoções já abertas, em melhor esforço. A união das camadas é a
lista `REPOS`, sem repetição, e o spec guarda isso.

- **Código:** `scripts/ci/dependencias-de-merge.ts` (`CAMADAS_DE_PROMOCAO`, `predecessores`, `avaliar`, modo `linhas`) e `scripts/ci/abrir-pr-de-promocao.sh`, no `brabo-ci`
- **Teste:** `scripts/ci/dependencias-de-merge.spec.ts` (bloco "promoção em camadas")
- **ADR:** [0284](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0284-a-promocao-infere-as-dependencias-pela-ordem-dos-repos.md), que revê a decisão 7 do [0276](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **Origem:** AT-788 (EP-033)

<a id="rn-1072"></a>

### RN-1072 — O merge de uma promoção e o cron reavaliam as promoções das camadas seguintes {#rn-1072}

Como a dependência inferida não está escrita no corpo, a busca por `in:body` não a
acha. Por isso o `avisar-dependentes` de uma PR mergeada também reavalia as
promoções abertas (`base:main head:dev`) dos repos das camadas seguintes, e o
`varrer` (cron horário) inclui a mesma busca. Uma promoção que abre depois da de
baixo é acordada pelo próprio evento dela ou pelo cron.

- **Código:** `scripts/ci/dependencias-de-merge.ts` (modos `avisar-dependentes` e `varrer`)
- **Teste:** `scripts/ci/dependencias-de-merge.spec.ts` (`sucessores`); a busca em si é o GitHub, provada na próxima promoção
- **ADR:** [0284](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0284-a-promocao-infere-as-dependencias-pela-ordem-dos-repos.md)
- **Origem:** AT-788 (EP-033)

## O relatório de decisão do regressivo (RN-1051..1053)

<a id="rn-1051"></a>

### RN-1051 — O relatório do regressivo sai de um JSON único, e a recomendação segue uma regra fixa de seis linhas {#rn-1051}

O run do regressivo do `brabo-qa` grava um `relatorio-regressivo.json` (versão 1)
e deriva dele o `relatorio-regressivo.md`. O Summary, o texto do check e o
comentário da PR são apresentações desse JSON, nunca fontes à parte. A
recomendação não é escrita à mão: sai da primeira linha que casar, nesta ordem:
verde sem flaky vira **aprovar**; verde com flaky vira **aprovar**, com aviso e a
lista; `digest` ou `assinatura` vira **bloquear**, porque nunca se aceita (AT-765)
e o E2E roda de novo; `spec` em funcionalidade que a PR **toca** pelo mapa vira
**bloquear**; `spec` só em funcionalidade que a PR **não** toca, ou em "sem
funcionalidade", vira **aceitar com justificativa** (`/qa-aceitar`); `ambiente` ou
`sem-resposta` vira **rodar de novo**, e se repetir, **aceitar com justificativa**.
No modo `dev` o mesmo rótulo sai com o prefixo "atestado (não bloqueia)".

- **Código:** `scripts/ci/qa-e2e-resumo.ts:292` (`montarCheck`, que hoje monta o
  check a partir do resultado); o `relatorio.ts` do `brabo-qa` e o JSON v1 ainda não
  existem na `dev` (AT-791, lanes L1 e L2)
- **Teste:** `scripts/ci/qa-e2e-resumo.spec.ts` (o check por modo); a regra de
  recomendação e o JSON v1 ganham o teste na L1 e na L2
- **ADR:** [0277](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0277-o-regressivo-roda-num-compose-so-e-o-relatorio-decide.md)
- **Origem:** AT-791 (EP-033)

<a id="rn-1052"></a>

### RN-1052 — O `/qa-aceitar` preserva o relatório do vermelho e registra o aceite contra a recomendação {#rn-1052}

Hoje o aceite monta o check de novo com `linhas: []`, e por isso apaga a tabela de
digests e a de funcionalidades do vermelho: quem olha depois não vê o que foi
aceito. A regra nova: o `/qa-aceitar` **preserva** o `summary` e o `text` do check
vermelho, põe por cima o bloco do aceite (quem, quando, justificativa, o link do
run vermelho e a recomendação que o relatório dava) e troca só o título para
`Aceito com justificativa`. Quando a recomendação era **bloquear** por spec de
funcionalidade tocada, o aceite vale mesmo assim, porque a decisão é do dono, mas o
check e o comentário registram "aceito contra a recomendação". Na `dev` o aceite não
se aplica: o relatório é só o atestado.

- **Código:** `scripts/ci/qa-e2e-aceitar.ts:53` (`montarCheck`, chamado com
  `linhas: []`, que é o defeito a corrigir); `scripts/ci/qa-e2e-aceite.ts:21`
  (`avaliarAceite`, que segue lendo o `external_id` `causa:*`)
- **Teste:** `scripts/ci/qa-e2e-aceite.spec.ts` (o veredito do aceite); o
  preservar do resumo e o registro "contra a recomendação" ganham o teste na L1
- **ADR:** [0277](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0277-o-regressivo-roda-num-compose-so-e-o-relatorio-decide.md)
- **Origem:** AT-791 (EP-033)

<a id="rn-1053"></a>

### RN-1053 — A spec sem tag `@f-*` aparece como "sem funcionalidade" e nunca some do relatório {#rn-1053}

A seleção do regressivo já separa o que não tem dono no mapa (`semDono`,
`scripts/ci/qa-regressivo-selecao.ts:86`), mas esse dado não chega ao relatório. A
regra nova: uma spec que não tem nenhuma tag `@f-<id>` cai no balde **"sem
funcionalidade"**, na tabela e na lista de falhas, e nunca desaparece. Uma spec
vermelha nesse balde vira **aceitar com justificativa**, nunca bloquear, pela regra
de [RN-1051](#rn-1051). O `setup` de login
(`entrar.setup.ts`) também cai nesse balde e é marcado como preparação, para não
parecer um teste de funcionalidade. Sem o balde, a tabela mostraria tudo "sem
cobertura" com um vermelho de spec, que é o achado da qa#28.

- **Código:** `scripts/ci/qa-regressivo-selecao.ts:76` (`semDono.push`); o balde
  "sem funcionalidade" no relatório ainda não existe (AT-791, lanes L1 e L2)
- **Teste:** `scripts/ci/qa-regressivo-selecao.spec.ts` (a seleção por mapa e o
  `semDono`); o balde no relatório ganha o teste na L2
- **ADR:** [0277](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0277-o-regressivo-roda-num-compose-so-e-o-relatorio-decide.md)
- **Origem:** AT-791 (EP-033)

## O gatilho espera o carimbo e a assinatura antes do vermelho (RN-1066)

<a id="rn-1066"></a>

### RN-1066 — O gatilho espera o carimbo e a assinatura antes de reprovar por ambiente ou assinatura {#rn-1066}

Quando uma PR para a `main` (portão `E2E do brabo-qa`) ou para a `dev` (check
`Regressivo do brabo-qa`) dispara o gatilho, a imagem do head do repo do evento pode
ainda estar sendo carimbada ou assinada: o merge na `dev` move o head da promoção, e
o carimbo (tag `-dev`, imagem) e a assinatura da imagem levam de 3 a 8 min. Por isso o
gatilho repete três buscas até um teto configurável (`QA_ESPERA_MINUTOS`, padrão 10
min, intervalo de 15 s):

- a tag `-dev` do head (na `main`);
- a existência da imagem (a `-dev` do head na `main`, a `sha-<12>` na `dev`);
- a verificação de assinatura `cosign verify`, com a identidade do `e2e-pr` do brabo-qa.

Só depois do teto o check fecha vermelho, e a mensagem diz o que faltou: a tag `-dev`
do head ou a imagem (causa `ambiente`), ou a assinatura (causa `assinatura`). Assinatura
inválida nunca é aceita por `/qa-aceitar` (RN-1052). A espera vale só para a imagem do
repo do evento; as dos outros serviços já estão carimbadas e assinadas.

- **Código:** `scripts/ci/qa-e2e-espera.ts:51` (`esperarImagemAssinada`, a espera da
  imagem e da assinatura); `scripts/ci/qa-e2e-espera.ts:33` (`repetirAte`, a repetição
  até o teto); `scripts/ci/qa-e2e-disparar.ts:151` (o resolver das tags repetido até o
  teto) e `scripts/ci/qa-e2e-disparar.ts:157` (a espera só da imagem do repo do evento)
- **Teste:** `scripts/ci/qa-e2e-espera.spec.ts` (a repetição até o teto, a causa
  `ambiente` e a causa `assinatura`)
- **Origem:** AT-790 (EP-033), brabo-ci#31

## O painel da mudança (RN-1054..1056, ADR 0278)

<a id="rn-1054"></a>

### RN-1054 — Toda mudança tem um painel que compõe as runs {#rn-1054}

Cada mudança (um componente do `Depende-de`, uma PR solta ou uma tag) tem um run
`Painel da mudança` no `brabo-ci`. Ele junta as runs da mudança por head SHA, merge SHA,
tag e `c=` do E2E. Acompanha a cada 60 s, com ETag; se restarem menos de 500
requisições, o intervalo passa a 5 min. Para quando tudo terminou e há 3 min de
quietude, ou no teto de 45 min. Run ainda em andamento no teto sai como "em andamento
há N min". O painel **nunca reprova**.

- **Código:** `scripts/ci/painel.ts:235` (`terminou`, a régua de parada)
- **Teste:** `scripts/ci/painel.spec.ts`
- **ADR:** [0278](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0278-a-mudanca-e-vista-num-painel-do-brabo-ci.md)
- **Origem:** AT-792 (EP-033)

<a id="rn-1055"></a>

### RN-1055 — O painel não publica check nas PRs; o link fica nas runs de origem {#rn-1055}

O helper de Vínculos, no modo auto com PR, escreve a linha `Disparado | Painel da
mudança`. Ela aponta para `…/brabo-ci/actions/workflows/painel.yml?query=<repo>%23<n>`.
O token do App do painel só lê (`actions`, `pull-requests` e `contents`). O único token
com escrita é o do dispatch (`contents: write`, restrito ao `brabo-ci`). Por isso não
é preciso `checks: write`.

- **Código:** `scripts/ci/vinculos.ts:164` (`linhaDoPainel`, a linha do Vínculo)
- **Teste:** `scripts/ci/vinculos.spec.ts`
- **ADR:** [0278](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0278-a-mudanca-e-vista-num-painel-do-brabo-ci.md)
- **Origem:** AT-792 (EP-033)

<a id="rn-1056"></a>

### RN-1056 — Um painel por componente {#rn-1056}

O remetente (job `avisar-painel`) não dispara se já existe um painel `queued` ou
`in_progress` com `<repo>#<n>` no título, casando o token inteiro. Quando o componente
cresce (chave `m=<hash>`), o painel em curso escreve "superado" e sai, e o remetente
dispara o novo.

- **Código:** `scripts/ci/painel.ts:247` (`jaTemPainel`); `scripts/ci/painel.ts:90`
  (`superado`, que o painel em curso consulta)
- **Teste:** `scripts/ci/painel.spec.ts`
- **ADR:** [0278](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0278-a-mudanca-e-vista-num-painel-do-brabo-ci.md)
- **Origem:** AT-792 (EP-033)
