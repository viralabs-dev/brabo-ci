---
traducao_de: 1c63ebcf9d7719601a0fe7777f0d97952aa6e76e
id: rn-ci-parte-02
title: 'Business rules — CI — part 2 (from RN-1031)'
sidebar_label: 'CI — part 2 (from RN-1031)'
description: 'The RNs hosted in the ci root.'
keywords: [business rules, ci]
---

# CI — part 2 (from RN-1031)

## Feature regression and run links (RN-1031..1035, RN-1043..1045)

<a id="rn-1031"></a>

### RN-1031 — The feature catalog and the path → feature map live in a single file, and the spec binds to it by tag {#rn-1031}

`brabo-qa/funcionalidades.yml` is the only source: each feature has an `id`
(kebab-case, stable, never renamed; retiring is `status: aposentada`),
`nome`, `descricao`, `tema` (from the ADRs' `temas.yml`), `status` and
`caminhos: {<repo>: [globs]}`. It lives in `brabo-qa`, and not in `brabo-contracts`,
because contracts is consumed by TAG and every map adjustment would become a tag and a bump
in six consumers. The Playwright spec binds to the feature through the tag of the
test itself (`{ tag: '@f-<id>' }`) and the filter is `--grep`: the catalog does not
keep a list of files. A `brabo-qa` test rejects a repeated or non-kebab-case id, a
theme outside `temas.yml`, a glob that matches no file of the sibling
(rotten map) and an `@f-<id>` tag without an entry; a feature without a spec is only listed.

- **Code:** `funcionalidades.yml:1` (the catalog and the file contract),
  `scripts/ci/funcionalidades.ts:29` (`validarCatalogo`)
- **Test:** `scripts/ci/funcionalidades.spec.ts` (the validator) and
  `scripts/ci/qa-regressivo-catalogo-real.spec.ts:12` (the real catalog has the 14
  active features and globs that match)
- **ADR:** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **Origin:** AT-769 (EP-033)

<a id="rn-1032"></a>

### RN-1032 — The PR to `dev` runs the regression only for the features it touched, under the `Regressivo do brabo-qa` check, which is NEVER required {#rn-1032}

On a PR targeting `dev`, the `regressivo-dev` job of `qa-e2e-gatilho.yml` crosses the
PR's files with the map from [RN-1031](#rn-1031) and dispatches `brabo-qa` with the
touched features. The result comes back as the `Regressivo do
brabo-qa` check, created by the App on the `head_sha`: `success`, `failure` (visible, but the
merge stays free) or `neutral` (nothing touched, docs only, fork PR, repository
without a spec). The name is deliberately distinct from `E2E do brabo-qa`: the "main
requires E2E" ruleset binds that context, and the regression never enters any ruleset
(`rulesets.md` records the "not required" line). The job has `continue-on-error`,
`/qa-aceitar` does not apply on `dev`, and the App comments once, as a reminder,
when the map says the feature was touched and no `@f-<id>` spec
changed.

- **Code:** `.github/workflows/qa-e2e-gatilho.yml:74` (the job
  `regressivo-dev`, with `continue-on-error`), `scripts/ci/qa-e2e-resumo.ts:22`
  (the check name per mode), `scripts/ci/qa-regressivo-lembrete.ts` (the
  single reminder comment)
- **Test:** `scripts/ci/qa-e2e-resumo.spec.ts` (the name per mode) and
  `scripts/ci/qa-regressivo-selecao.spec.ts:33` (selection by map) and
  `scripts/ci/qa-regressivo-lembrete.spec.ts` (the reminder)
- **ADR:** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **Origin:** AT-769 (EP-033)

<a id="rn-1033"></a>

### RN-1033 — Three cross-cutting file rules apply before the map: nothing, whole catalog and no owner {#rn-1033}

In order: (1) docs, `*.md`, `CHANGELOG.md`, `.github/**` (except `qa-e2e.yml`
itself), repository tests and `.claude/**` do not touch any feature, and
the check comes out `neutral`; (2) lockfiles and manifests, `Dockerfile`, the app
entry, schema and migrations, the web client, the engine's `config/**` and the
`brabo-qa` suite (`e2e/suporte/**`, `playwright.config.ts`) run the whole catalog,
and a contracts TAG bump falls here; (3) a path that no glob matches runs the
`instalacao` + `autenticacao` smoke and the summary lists it as "no owner in the map",
so that the map gets fixed. `brabo-contracts` has no regression on its own PR.

- **Code:** `scripts/ci/qa-regressivo-selecao.ts:67` (`selecionar`),
  `scripts/ci/qa-regressivo-selecao.ts:43` (`SMOKE`)
- **Test:** `scripts/ci/qa-regressivo-selecao.spec.ts:41` (rule 1),
  `:55` (rule 2 per repository), `:58` (rule 3)
- **ADR:** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **Origin:** AT-769 (EP-033)

<a id="rn-1075"></a>

### RN-1075 — `brabo-runner` is attested by its own CI: the linux-x64 binary enters the PR, and the engine contract is proven only in TP-01 {#rn-1075}

`brabo-runner` has no `qa-e2e.yml`, image or `@f-runner`/`@f-projetos` spec in `brabo-qa`; the catalog regression does not run on its PR (owner's decision of 2026-11-08, option b). The PR is attested by the `runner` job of its `ci.yml`: lint, types, tests, `dist` with `smoke`, and the linux-x64 binary with `build:bin` + `smoke:bin` (`--self-test-pty`, real PTY). The **runner ↔ engine contract** (ticket join, capabilities, exec, folder) is **not** proven on the PR: only in live TP-01. The `runner` keys of `funcionalidades.yml` stay in the catalog and serve only the map.

- **Code:** the `runner` job of `brabo-runner`'s `.github/workflows/ci.yml`
- **Test:** the job itself (log with `ok:` from `--self-test-pty`)
- **ADR:** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **Origin:** AT-853 (EP-033)

<a id="rn-1034"></a>

### RN-1034 — The PR to `main` runs the whole catalog in `E2E do brabo-qa`, and a feature without a spec shows up as "no coverage" without failing {#rn-1034}

The `E2E do brabo-qa` check ([ADR 0267](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0267-o-e2e-do-brabo-qa-e-portao-da-main.md))
runs all the specs and builds the `funcionalidade | specs | resultado` table.
A catalog feature without a spec enters as `sem cobertura` and **does not
fail** (owner's decision of 06/11/2026): with the opposite rule `main` would stay
red for weeks and `/qa-aceitar` would become routine. The tests that exist
pass unchanged; a `spec` or `ambiente` red remains acceptable through
`/qa-aceitar`, and a `digest` or `assinatura` red never is.

- **Code:** `scripts/ci/qa-e2e-resumo.ts:28` (the `sem cobertura` result in the
  table row), `scripts/ci/qa-e2e-resumo.ts:22` (the `main` check name)
- **Test:** `scripts/ci/qa-e2e-resumo.spec.ts` (the table and the no-coverage
  row)
- **ADR:** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **Origin:** AT-769 (EP-033)

<a id="rn-1035"></a>

### RN-1035 — The PR to `dev` publishes the signed `sha-<12>` image, only for its own repository, and the cleanup deletes the orphans {#rn-1035}

So that the regression has something to run, the `ci.yml` of api, engine, web and broker
publishes `ghcr.io/viralabs-dev/brabo-<app>:sha-<12 primeiros do head>` also
when the base is `dev`, with Trivy and keyless `cosign sign`, as on `main`. A fork PR
gets no secret: the image is skipped and the regression says "does not run on a fork
PR". The trigger uses the `sha-<12>` in the PR's repository and the newest `-dev.N`
in the others. Each `synchronize` leaves an orphan `sha-*`, so
`limpeza-ghcr.yml` deletes every `sha-*` of a closed PR and those older than 7 days.

- **Code:** `scripts/ci/qa-e2e-imagens.ts:83` (the choice of `sha-<12>` for
  `dev` and `hotfix`)
- **Test:** `scripts/ci/qa-e2e-imagens.spec.ts` (the choice per base)
- **ADR:** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **Origin:** AT-769 (EP-033)

<a id="rn-1043"></a>

### RN-1043 — Every run that reads another repository publishes `## Vínculos` at the top of the Summary, and the helper never fails the job {#rn-1043}

Through the `vinculos` action of `brabo-ci`, the Summary of each job that links repositories
carries the `## Vínculos` table (origin, `repo@SHA` siblings with a link, destination and dispatched
runs) and a Mermaid diagram, right after the checkouts. Every value goes through a
regex before entering the Markdown: repository `viralabs-dev/brabo(-x)?`,
40-hex SHA, numeric PR, organization GitHub URL, actor. What does not match
becomes `?` and a `::warning::`. An invalid `origem` is simply discarded, with a warning. The
step carries `continue-on-error`: the helper never fails a job. In `brabo`, the
`docs-check`, `docs-deploy`, `docs-audit` and `regenera-gerados` pass the
SHAs from the `.git/irmaos-sha.lst` that `montar-layout.sh` writes
([ADR 0274](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0274-os-gerados-leem-os-irmaos-por-uma-trava-de-shas.md)), and
`release.yml` passes `infra` by path.

- **Code:** `scripts/ci/vinculos.ts:57` (`montar`), `.github/actions/vinculos/action.yml:31`
  (the `continue-on-error`), `scripts/ci/validar-payload.ts:112` (`validarOrigem`),
  `.github/workflows/docs-check.yml:89` (`brabo` passes the siblings along)
- **Test:** `scripts/ci/vinculos.spec.ts` (fixtures, malicious value, empty
  origin) and `scripts/ci/validar-payload.spec.ts`
- **ADR:** [0271](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0271-os-runs-do-actions-mostram-os-vinculos-entre-os-repos.md)
- **Origin:** AT-773 (EP-033)

<a id="rn-1044"></a>

### RN-1044 — The destination run of a dispatch or a tag has a `run-name` with the origin, and the dispatch correlation goes in the name as `c=<run_id>-<attempt>` {#rn-1044}

The `run-name` of a reusable workflow is ignored: the caller's is what counts. The `e2e-pr.yml`
of `brabo-qa` is named `E2E ← <repo>#<pr> · <sha7> · <ator> · c=<correlação>`
(`Regressivo ← …` in dev mode); runs dispatched by tag, such as `release` and
`install-e2e` of `brabo`, are `release <tag> ← tag do carimbo`. `repository_dispatch`
answers 204 with no id, and the `client_payload` does not appear in the runs API; only the
`display_title` remains queryable. That is why the trigger sends `origem.correlacao =
<run_id>-<attempt>`, which goes into the `run-name`, and `qa-e2e-disparar.ts` queries
the `brabo-qa` runs every 5 s for up to 60 s, matching the `c=`. The `attempt` makes the
correlation unique per re-run. An old payload, without `origem`, yields empty fields and
does not break. The origin of a tag-dispatched run comes from the `Carimbo: <url>` line that
`tag-release` writes into the annotated tag's message.

- **Code:** `scripts/ci/qa-e2e-imagens.ts:113` (`origem.correlacao` in the
  payload), `scripts/ci/qa-e2e-vinculos.ts:18` (`acharRun`),
  `scripts/ci/qa-e2e-disparar.ts:133` (the correlation), `scripts/ci/tag-release.ts:35`
  (`comCarimbo`), `.github/workflows/release.yml:3` (the tag's `run-name`)
- **Test:** `scripts/ci/qa-e2e-vinculos.spec.ts` (the `c=` match) and
  `scripts/ci/qa-e2e-imagens.spec.ts`
- **ADR:** [0271](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0271-os-runs-do-actions-mostram-os-vinculos-entre-os-repos.md)
- **Origin:** AT-773 (EP-033)

<a id="rn-1045"></a>

### RN-1045 — The App's check points to the `brabo-qa` run from the start, and the origin run records the link of the dispatched run {#rn-1045}

The `anunciar` job of `e2e-pr.yml`, with no `needs` and in parallel with `e2e`, updates the
check by the payload's `check_run_id` with the `details_url` of the `brabo-qa` run and the
Vínculos, with the App token holding only `checks: write` and a clean checkout of `dev`. The
`fechar` job keeps the `details_url` at the end and attaches the Vínculos. A failure of `anunciar` only
warns. In the origin run, the trigger writes into `disparados` the `brabo-qa` run
it found through the correlation of [RN-1044](#rn-1044); if it did not find it in 60 s, it records the
check's link (which already points to qa) and a warning. `alarmar-prova.sh` attaches
`vinculos.md` to the issue body when the file exists.

- **Code:** `scripts/ci/fechar-check.ts:39` (the Vínculos on close),
  `scripts/ci/qa-e2e-vinculos.ts:42` (`vinculosDoGatilho`),
  `scripts/ci/qa-e2e-disparar.ts:154` (the warning when the run is not found)
- **Test:** `scripts/ci/fechar-check.spec.ts` and `scripts/ci/qa-e2e-vinculos.spec.ts`
- **ADR:** [0271](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0271-os-runs-do-actions-mostram-os-vinculos-entre-os-repos.md)
- **Origin:** AT-773 (EP-033)

## Publishing npm packages (RN-1042)

<a id="rn-1042"></a>

### RN-1042 — The package only goes out through the tag, with the version's dist-tag and the same version in every package {#rn-1042}

`publish-npm.yml` is reusable and runs when the caller dispatches it by tag
(`on: push: tags: ['v*']`). `scripts/ci/publish-npm.ts` takes the version from the tag
(without the `v`) and accepts only `vX.Y.Z` or `vX.Y.Z-dev.N`; any other form fails
before publishing. `-dev.N` goes to the `dev` dist-tag; the final one goes to `latest`, and
a stray pre-release never takes `latest`. Each package in the list gets the same
version (`npm version --no-git-tag-version`) before `pnpm pack`, and
`actions/attest` and `npm publish` use the same `.tgz`, without `--provenance`.
Republishing the version only passes if the registry already holds the same file (same
`dist.integrity`); a different integrity fails.

- **Code:** `scripts/ci/publish-npm.ts:17` (`versaoDaTag`), `scripts/ci/publish-npm.ts:25`
  (`distTag`), `.github/workflows/publish-npm.yml:90` (the same version in the packages),
  `.github/workflows/publish-npm.yml:100` (the `npm publish` of the same `.tgz`)
- **Test:** `scripts/ci/publish-npm.spec.ts` (`dev` and `latest` dist-tag, strips the `v`)
- **Origin:** AT-770 (EP-033)

## Merge dependency across repositories (RN-1047..1050)

<a id="rn-1047"></a>

### RN-1047 — The PR declares the dependency with `Depende-de: viralabs-dev/<repo>#<n>`, and a malformed line fails instead of passing silently {#rn-1047}

Each merge dependency of the PR is a line of the body, `Depende-de:` followed by
`viralabs-dev/<repo>#<n>`, anywhere in the text, with or without a leading `- `.
The rule matches line by line and is case-sensitive. The repo must be in the list of the
11 `brabo*` repositories of the parent-folder map, the owner must be `viralabs-dev`,
the PR cannot cite itself and the cited PR must exist (404 fails). A
line that starts like a declaration (`Depende-de` or `depende de`) but does not match the
rule fails with the reason, so that a typo does not make the dependency
vanish. The body is third-party text: it goes to the script through an environment variable, never
interpolated into a `run:`.

- **Code:** `scripts/ci/dependencias-de-merge.ts` (the rule and the validation), to be
  published in `brabo-ci`; it does not yet exist on the `dev` of `brabo`
- **Test:** `scripts/ci/dependencias-de-merge.spec.ts`, with the regex, the allowlist,
  the owner, the self-reference and the malformed line
- **ADR:** [0276](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **Origin:** AT-787 (EP-033)

<a id="rn-1048"></a>

### RN-1048 — The `Dependências de merge` check has four states, never `neutral`, and waiting is yellow {#rn-1048}

The check is published by the App on the PR's `head_sha`, named `Dependências de
merge`. With no `Depende-de` line, it comes out `success` "Sem dependências declaradas", and
it always publishes, so as not to leave a stale check stuck. With any dependency
`OPEN`, it comes out `in_progress` (yellow), with the title `esperando viralabs-dev/<repo>#<n>`
listing the missing ones. With all `MERGED`, it comes out `success` "Dependências mergeadas".
With a dependency `CLOSED` without merge, with an invalid line, with a cycle or with a 404,
it comes out `failure` with the reason; the dependency closed without merge asks that the
line be removed or the replacing PR be pointed to, and does not wait forever. `neutral` is
not used in any case, because for a ruleset it counts as green. The job itself
uses `continue-on-error`: what fails is the check, and a job failure only warns.

- **Code:** `scripts/ci/dependencias-de-merge.ts` (the pure evaluation function) and
  `.github/workflows/dependencias-de-merge.yml` (the reusable), in `brabo-ci`
- **Test:** `scripts/ci/dependencias-de-merge.spec.ts`, one case for each state
- **ADR:** [0276](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **Origin:** AT-787 (EP-033)

<a id="rn-1049"></a>

### RN-1049 — The dependency's merge updates the check of the PRs that cite it, and the hourly cron is only a safety net {#rn-1049}

When a PR in a repo is merged, the `avisar-dependentes` job, in the merged PR's own
owner repo, looks for the organization's open PRs that cite the
merged one in the body and redoes the evaluation of each. The search is fuzzy, so each
candidate has its body re-parsed by the rule of [RN-1047](#rn-1047) before
any write. The check is updated with the App token, without re-running the
dependent PR's workflow. An hourly cron in `brabo-ci` redoes the same
sweep for open PRs with `Depende-de`, and covers a lost merge when the
owner repo's run breaks. The cron only turns on when `brabo-ci` reaches `main`,
because `schedule` only runs from the default branch.

- **Code:** `scripts/ci/dependencias-de-merge.ts` (`avisar-dependentes` mode) and
  `.github/workflows/dependencias-de-merge.yml` (the job and the cron), in `brabo-ci`
- **Test:** `scripts/ci/dependencias-de-merge.spec.ts`, with the simulated search and the
  body that no longer matches
- **ADR:** [0276](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **Origin:** AT-787 (EP-033)

<a id="rn-1050"></a>

### RN-1050 — A dependency cycle fails with the whole path, up to depth 5 {#rn-1050}

The evaluation follows the `Depende-de` lines of the open dependencies, step by step,
up to depth 5. If the chain returns to the evaluated PR, the check fails with the
full path (`A → B → A`) and the link of each PR on the path. A depth greater
than 5 also fails. The way out of a cycle is to edit the body of one of the PRs to
remove the line that closes the cycle: the PR needs no bypass.

- **Code:** `scripts/ci/dependencias-de-merge.ts` (the walk up to depth 5), in `brabo-ci`
- **Test:** `scripts/ci/dependencias-de-merge.spec.ts`, with the A↔B cycle and the exceeded depth
- **ADR:** [0276](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **Origin:** AT-787 (EP-033)

<a id="rn-1071"></a>

### RN-1071 — The promotion PR depends on the open promotions of the earlier layers, and the order is a tested list {#rn-1071}

On a PR with base `main` and head `dev` of the same repo, the `Dependências de
merge` check adds to the body's `Depende-de` lines one dependency for each open
promotion PR in the repos of the earlier layers, even if nobody wrote it.
The order is `CAMADAS_DE_PROMOCAO`: 0 brabo-ci; 1 brabo-contracts and
brabo-workspace; 2 brabo-api, brabo-engine, brabo-web, brabo-runner and brabo-broker;
3 brabo-infra; 4 brabo-qa; 5 brabo. Only the edge where the consumer's `main`
uses a final artifact of the producer counts. The title shows `esperando viralabs-dev/<repo>#<n>`.
If a repo of an earlier layer has `dev` ahead of `main` and no open promotion,
the check stays pending and says which repo is missing a promotion
(`esperando promoção de viralabs-dev/<repo> (a dev está à frente da main)`). Opening
the promotion (`abrir-pr-de-promocao.sh`) also writes the `Depende-de` lines of the
promotions already open, on a best-effort basis. The union of the layers is the
`REPOS` list, without repetition, and the spec guards that.

- **Code:** `scripts/ci/dependencias-de-merge.ts` (`CAMADAS_DE_PROMOCAO`, `predecessores`, `avaliar`, `linhas` mode) and `scripts/ci/abrir-pr-de-promocao.sh`, in `brabo-ci`
- **Test:** `scripts/ci/dependencias-de-merge.spec.ts` ("promoção em camadas" block)
- **ADR:** [0284](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0284-a-promocao-infere-as-dependencias-pela-ordem-dos-repos.md), which revises decision 7 of [0276](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **Origin:** AT-788 (EP-033)

<a id="rn-1072"></a>

### RN-1072 — The merge of a promotion and the cron reevaluate the promotions of the following layers {#rn-1072}

Since the inferred dependency is not written in the body, the `in:body` search does not
find it. That is why the `avisar-dependentes` of a merged PR also reevaluates the open
promotions (`base:main head:dev`) of the repos of the following layers, and
`varrer` (hourly cron) includes the same search. A promotion that opens after the one
below it is woken by its own event or by the cron.

- **Code:** `scripts/ci/dependencias-de-merge.ts` (`avisar-dependentes` and `varrer` modes)
- **Test:** `scripts/ci/dependencias-de-merge.spec.ts` (`sucessores`); the search itself is GitHub, proven on the next promotion
- **ADR:** [0284](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0284-a-promocao-infere-as-dependencias-pela-ordem-dos-repos.md)
- **Origin:** AT-788 (EP-033)

## The regression decision report (RN-1051..1053)

<a id="rn-1051"></a>

### RN-1051 — The regression report comes from a single JSON, and the recommendation follows a fixed six-line rule {#rn-1051}

The `brabo-qa` regression run writes a `relatorio-regressivo.json` (version 1)
and derives `relatorio-regressivo.md` from it. The Summary, the check text and the
PR comment are presentations of that JSON, never separate sources. The
recommendation is not hand-written: it comes from the first line that matches, in this order:
green without flaky becomes **approve**; green with flaky becomes **approve**, with a warning and the
list; `digest` or `assinatura` becomes **block**, because it is never accepted (AT-765)
and the E2E runs again; `spec` in a feature that the PR **touches** per the map becomes
**block**; `spec` only in a feature that the PR does **not** touch, or in "no
feature", becomes **accept with justification** (`/qa-aceitar`); `ambiente` or
`sem-resposta` becomes **run again**, and if it repeats, **accept with justification**.
In `dev` mode the same label comes out with the prefix "atestado (não bloqueia)".

- **Code:** `scripts/ci/qa-e2e-resumo.ts:292` (`montarCheck`, which today builds the
  check from the result); the `brabo-qa` `relatorio.ts` and the v1 JSON do not yet
  exist on `dev` (AT-791, lanes L1 and L2)
- **Test:** `scripts/ci/qa-e2e-resumo.spec.ts` (the check per mode); the recommendation
  rule and the v1 JSON get their test in L1 and L2
- **ADR:** [0277](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0277-o-regressivo-roda-num-compose-so-e-o-relatorio-decide.md)
- **Origin:** AT-791 (EP-033)

<a id="rn-1052"></a>

### RN-1052 — `/qa-aceitar` preserves the red report and records the acceptance against the recommendation {#rn-1052}

Today the acceptance rebuilds the check with `linhas: []`, and so it erases the digest table and the
feature table of the red: whoever looks later does not see what was
accepted. The new rule: `/qa-aceitar` **preserves** the `summary` and the `text` of the red
check, puts the acceptance block on top (who, when, justification, the link of the red
run and the recommendation the report gave) and swaps only the title to
`Aceito com justificativa`. When the recommendation was **block** because of a spec of a touched
feature, the acceptance holds anyway, because the decision is the owner's, but the
check and the comment record "accepted against the recommendation". On `dev` the acceptance does not
apply: the report is only the attestation.

- **Code:** `scripts/ci/qa-e2e-aceitar.ts:53` (`montarCheck`, called with
  `linhas: []`, which is the defect to fix); `scripts/ci/qa-e2e-aceite.ts:21`
  (`avaliarAceite`, which keeps reading the `external_id` `causa:*`)
- **Test:** `scripts/ci/qa-e2e-aceite.spec.ts` (the acceptance verdict); the
  summary preservation and the "against the recommendation" record get their test in L1
- **ADR:** [0277](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0277-o-regressivo-roda-num-compose-so-e-o-relatorio-decide.md)
- **Origin:** AT-791 (EP-033)

<a id="rn-1053"></a>

### RN-1053 — A spec without an `@f-*` tag shows up as "no feature" and never disappears from the report {#rn-1053}

The regression selection already separates what has no owner in the map (`semDono`,
`scripts/ci/qa-regressivo-selecao.ts:86`), but that data does not reach the report. The
new rule: a spec that has no `@f-<id>` tag falls into the **"no feature"**
bucket, in the table and in the failure list, and never disappears. A red spec in that bucket
becomes **accept with justification**, never block, by the rule of
[RN-1051](#rn-1051). The login `setup`
(`entrar.setup.ts`) also falls into that bucket and is marked as preparation, so as not to
look like a feature test. Without the bucket, the table would show everything as "no
coverage" with a spec red, which is the finding of qa#28.

- **Code:** `scripts/ci/qa-regressivo-selecao.ts:76` (`semDono.push`); the "no feature"
  bucket in the report does not yet exist (AT-791, lanes L1 and L2)
- **Test:** `scripts/ci/qa-regressivo-selecao.spec.ts` (selection by map and
  `semDono`); the bucket in the report gets its test in L2
- **ADR:** [0277](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0277-o-regressivo-roda-num-compose-so-e-o-relatorio-decide.md)
- **Origin:** AT-791 (EP-033)

## The trigger waits for the stamp and the signature before going red (RN-1066)

<a id="rn-1066"></a>

### RN-1066 — The trigger waits for the stamp and the signature before failing on environment or signature {#rn-1066}

When a PR to `main` (`E2E do brabo-qa` gate) or to `dev` (`Regressivo do brabo-qa`
check) fires the trigger, the head image of the event's repo may
still be being stamped or signed: the merge into `dev` moves the promotion's head, and
the stamp (`-dev` tag, image) and the image signature take 3 to 8 min. So the
trigger repeats three lookups up to a configurable ceiling (`QA_ESPERA_MINUTOS`, default 10
min, interval 15 s):

- the head's `-dev` tag (on `main`);
- the existence of the image (the head's `-dev` on `main`, the `sha-<12>` on `dev`);
- the `cosign verify` signature check, with the identity of brabo-qa's `e2e-pr`.

Only after the ceiling does the check close red, and the message says what was missing: the head's
`-dev` tag or the image (cause `ambiente`), or the signature (cause `assinatura`). An invalid
signature is never accepted by `/qa-aceitar` (RN-1052). The wait applies only to the image of
the event's repo; those of the other services are already stamped and signed.

- **Code:** `scripts/ci/qa-e2e-espera.ts:51` (`esperarImagemAssinada`, the wait for the
  image and the signature); `scripts/ci/qa-e2e-espera.ts:33` (`repetirAte`, the repetition
  up to the ceiling); `scripts/ci/qa-e2e-disparar.ts:151` (the tag resolver repeated up to the
  ceiling) and `scripts/ci/qa-e2e-disparar.ts:157` (the wait only for the event repo's image)
- **Test:** `scripts/ci/qa-e2e-espera.spec.ts` (the repetition up to the ceiling, the
  `ambiente` cause and the `assinatura` cause)
- **Origin:** AT-790 (EP-033), brabo-ci#31

## The change panel (RN-1054..1056, ADR 0278)

<a id="rn-1054"></a>

### RN-1054 — Every change has a panel that composes the runs {#rn-1054}

Each change (a `Depende-de` component, a standalone PR or a tag) has a
`Painel da mudança` run in `brabo-ci`. It gathers the change's runs by head SHA, merge SHA,
tag and the E2E's `c=`. It polls every 60 s, with ETag; if fewer than 500
requests remain, the interval becomes 5 min. It stops when everything has finished and there are 3 min of
quiet, or at the 45 min ceiling. A run still in progress at the ceiling comes out as "em andamento
há N min". The panel **never fails**.

- **Code:** `scripts/ci/painel.ts:235` (`terminou`, the stop rule)
- **Test:** `scripts/ci/painel.spec.ts`
- **ADR:** [0278](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0278-a-mudanca-e-vista-num-painel-do-brabo-ci.md)
- **Origin:** AT-792 (EP-033)

<a id="rn-1055"></a>

### RN-1055 — The panel publishes no check on PRs; the link stays in the origin runs {#rn-1055}

The Vínculos helper, in auto mode with a PR, writes the line `Disparado | Painel da
mudança`. It points to `…/brabo-ci/actions/workflows/painel.yml?query=<repo>%23<n>`.
The panel's App token only reads (`actions`, `pull-requests` and `contents`). The only token
with write access is the dispatch one (`contents: write`, restricted to `brabo-ci`). That is why
`checks: write` is not needed.

- **Code:** `scripts/ci/vinculos.ts:164` (`linhaDoPainel`, the Vínculo line)
- **Test:** `scripts/ci/vinculos.spec.ts`
- **ADR:** [0278](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0278-a-mudanca-e-vista-num-painel-do-brabo-ci.md)
- **Origin:** AT-792 (EP-033)

<a id="rn-1056"></a>

### RN-1056 — One panel per component {#rn-1056}

The sender (`avisar-painel` job) does not dispatch if a `queued` or
`in_progress` panel with `<repo>#<n>` in the title already exists, matching the whole token. When the component
grows (key `m=<hash>`), the running panel writes "superado" and exits, and the sender
dispatches the new one.

- **Code:** `scripts/ci/painel.ts:247` (`jaTemPainel`); `scripts/ci/painel.ts:90`
  (`superado`, which the running panel queries)
- **Test:** `scripts/ci/painel.spec.ts`
- **ADR:** [0278](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0278-a-mudanca-e-vista-num-painel-do-brabo-ci.md)
- **Origin:** AT-792 (EP-033)
