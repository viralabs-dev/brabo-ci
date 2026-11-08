# brabo-ci

Workflows reutilizáveis (`workflow_call`) e a lógica de política em `scripts/ci/`: PR, escada, promoção, carimbo de tag, arquivamento, Dependabot, vínculos e painel. Este repo não tem produto.

Só o que mora aqui está descrito aqui. As regras transversais (gitflow, commits, merge na `main` é do dono, contas GitHub, segredos) estão no `CLAUDE.md` da pasta-mãe `~/dev/brabo/CLAUDE.md`. Imagens, compose, `deploy/`, release do produto, `brabo-infra:install.sh` e Trivy moram em `brabo-infra:CLAUDE.md`; E2E, golden-sets e catálogo de funcionalidades em `brabo-qa:CLAUDE.md`; ADRs e site em `brabo:CLAUDE.md`.

## Stack (decidida, não proponha alternativas)
- Reutilizáveis em `.github/workflows/`, lógica em `scripts/ci/` (TypeScript pelo Node por type stripping: só sintaxe apagável, sem `enum`/`namespace`; vitest).
- Cada reutilizável faz um segundo checkout em `.brabo-ci/` pelo input `ci_ref`, obrigatório e sem padrão, igual ao SHA do `uses:`. Os gatilhos ficam no repo que chama.
- A action local `.github/actions/preparar` confere o `ci_ref` e instala o Node de `.node-version`.

## Política de PR (a fonte é a doc, o código a executa)
- Branches permanentes `dev` e `main`; a esteira é `dev → main`. Trabalho nasce de `dev` com `breaking/`, `feature/`, `bugfix/`, `perf/`, `refactor/`, `chore/`, `docs/`, `test/`; `hotfix/` nasce de `main`. Formato funcao/descritivo, regex `^.{0,30}/\S{0,32}$`. Commits em conventional commits, pt-BR.
- A FUNÇÃO da branch decide a VERSÃO (`scripts/ci/version.ts`): `breaking/` MAJOR, `feature/` MINOR, o resto PATCH. Mudança que exige ação do operador antes do deploy nasce em `breaking/` mesmo sendo correção. Versão não se corrige à mão.
- `dependabot/…` é branch permitida sem critério de caracteres, só se o AUTOR for o Dependabot (`ehBranchDoDependabot` em `scripts/ci/pr-police.ts`); humano com esse prefixo reprova em `FUNCAO-DESCONHECIDA`.
- PR do Dependabot entra pela `dev`, sem aprovação humana (ADR 0236); a `main` segue com a escada inteira. SECURITY update o GitHub abre contra a `main`: `dependabot-para-dev.yml` fecha o que a `dev` já corrige e redireciona o resto (na dúvida, redireciona). O gatilho que vale é `push` na `dev`. O `GITHUB_TOKEN` não lê os alertas nem dispara workflow: depois de redirecionar, só `@dependabot rebase` de quem tem escrita roda os checks. A justificativa de pin (`scripts/ci/dependabot-justifica-pin.ts`, autor E diff) é escrita num passo do `brabo:.github/workflows/docs-check.yml`, não aqui.
- Push direto em permanente é bloqueado; exceções: tags (bot de release) e `.release/gate.json` (bot do gate). Merge em `dev`/`main` é manual do dono.
- Branch de PR mergeada é arquivada por checagem semanal (`archive-merged-branch.yml`, `scripts/ci/archive-branch.ts`): move para `refs/archive/<nome>`, nunca apaga. Exceções: permanentes, `gh-pages`, fork.
- `rc` e `qa` saíram da política, mas continuam em `PROTECTED_BRANCHES` de propósito: proteger o que não existe não custa, desproteger o que existe custa. Não "limpe" a lista.
- Detalhe e lições: `scripts/ci/docs/explanation/branching-policy.md`. As mensagens de bloqueio imprimem a URL publicada da doc (`scripts/ci/doc-da-politica.ts`), nunca `docs/…` relativo.

## Cadeia de suprimentos aqui
- Todo `uses:` de terceiro é preso a COMMIT SHA com a versão no comentário (`@<sha>  # v4`): tag é ponteiro que o dono move sem aviso, e quem move executa código no runner com os segredos. `scripts/ci/actions-pinadas.ts` reprova no job `lint` (e varre também `.github/actions/**`). Todo `curl` de binário passa por `sha256sum -c`.
- Os pins do próprio brabo-ci têm `# vX.Y.Z` ou `# vX.Y.Z-dev.N` com SHA igual ao da tag; na `main` só release final (`scripts/ci/pins-do-brabo-ci.ts`).
- A política completa (imagem por digest, cosign, Trivy, o que fica na fé) é de `scripts/ci/docs/explanation/cadeia-de-suprimentos-do-ci.md` e a execução, de `brabo-infra`.
- `${{` não entra em `description` de metadado: o runner avalia e o actionlint não pega. Guarda: `scripts/ci/metadados-sem-expressao.spec.ts`.
- Job EXIGIDO que dependa de outro job leva `if: ${{ !cancelled() }}`, senão o dependente vermelho o deixa `skipped`, que conta como verde.

## Reutilizáveis
- Vínculos (AT-773): `.github/actions/vinculos` + `scripts/ci/vinculos.ts` são o ÚNICO helper que escreve `## Vínculos` no Summary. Todo valor de fora passa por regex e nunca entra cru em Markdown; o helper NUNCA reprova o job. Mudou regex ou formato: ajuste `vinculos.spec.ts` e os `esperado-*.md`.
- Painel da mudança (AT-792, RN-1054 a RN-1056): `painel.yml` + `scripts/ci/painel.ts` compõem as runs de uma mudança numa tabela + Mermaid. NUNCA reprova e NÃO publica check nas PRs (decisão do dono, 07/11/2026). Detalhe: `docs/painel-da-mudanca.md`.
- Refs com símbolo (AT-782): `refs-com-simbolo.yml` + `scripts/ci/refs-com-simbolo.ts` conferem as refs `caminho:N` das RNs do PRÓPRIO repo. O núcleo é CÓPIA de `brabo:scripts/docs/refs-com-simbolo.mjs`, com o SHA de origem no cabeçalho: mudou lá, mude aqui. Não obrigatório.
- Contracts (AT-770): `publish-npm.yml` publica o `.tgz` atestado por actions/attest (nunca `--provenance`); a versão vem da tag, `-dev.N` vai ao dist-tag `dev` (RN-1037). `contracts-alinhado.yml` exige uma versão só (RN-1038). `scripts/ci/subir-contracts.sh <versão>` é o único jeito de subir a versão num consumidor; nunca reescreva o lock inteiro.
- Dependência de merge (AT-787): `dependencias-de-merge.yml` avalia `Depende-de: viralabs-dev/<repo>#<n>` do corpo (`scripts/ci/dependencias-de-merge.ts`) e publica o check `Dependências de merge` pelo App. NUNCA `neutral`: para ruleset conta como verde. O corpo da PR é lido pela API e nunca interpolado em `run:`. Ligar como exigido é gesto do dono.
- Regressivo (AT-769, AT-791): `qa-e2e-gatilho.yml` tem o job `regressivo-dev` (PR para `dev`), que seleciona as funcionalidades tocadas (`scripts/ci/qa-regressivo-selecao.ts`) e publica o check `Regressivo do brabo-qa`, que NUNCA entra em ruleset (`regressivo-nao-exigido.spec.ts` guarda). O portão da `main` é o `E2E do brabo-qa`. O catálogo é `brabo-qa:funcionalidades.yml`. `qa-e2e-resumo.ts` tem `recomendar()` (RN-1051) e `caber()` (60 000 caracteres por campo).
- Espera do carimbo (AT-790, RN-1066): `qa-e2e-espera.ts` espera a tag `-dev` e a imagem assinada até `espera_minutos` (padrão 10). A identidade do cosign é a do `e2e-pr` do brabo-qa: mude as duas juntas.
- Vínculos na origem: `qa-e2e-disparar.ts` manda `origem` e `correlacao` (`<run>-<tentativa>`) no payload e escreve o Vínculos do run de origem; tudo best-effort.

## Documentação é parte do pronto
- A doc da política mora em `scripts/ci/docs/` (fonte pt-BR; `en`, `ru`, `zh-Hans` em i18n). O site é agregado pelo `brabo`, que lê a doc de cada repo; nunca crie `website/docs/`. Atualize a doc na mesma mudança.
- Mudança observável → `CHANGELOG.md` (Unreleased). Toda tag nasce de workflow.
- RN nova → `caminho:N` e o teste que a cobre em `scripts/ci/docs/business-rules/ci.md`; a numeração é global (varra branches locais e remoto) e a âncora `{#rn-NNN}` não muda. ADR novo mora no `brabo`; ADR aceito nunca é editado.
- Sem informação suficiente, escreva `> **TODO(humano):** <pergunta>.`. Diagramas em Mermaid.
- Este arquivo não passa de 12 mil caracteres (`wc -m`, nunca `wc -c`); o que só vale para uma área vai para o doc dela ou para `.claude/rules/` com `paths:`. Guarda: `scripts/ci/claude-md.spec.ts`.

## O que NÃO fazer
- Não instalar libs sem justificar no plano. Não versionar à mão. Não descrever aqui código de outro repo: aponte com `brabo-<x>:caminho`.
