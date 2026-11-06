# Changelog

## Unreleased

- `qa-e2e-gatilho.yml` novo (reutilizável) e scripts `qa-e2e-imagens`, `qa-e2e-aceite`, `qa-e2e-resumo`, `qa-e2e-disparar` e `qa-e2e-aceitar`: o check `E2E do brabo-qa` vira portão da `main`. Escolhe as tags das imagens, dispara o `e2e-pr` no brabo-qa e aceita falha de `spec` ou `ambiente` com `/qa-aceitar <justificativa>` (AT-765).
- Docs: `README.md`, `CONTRIBUTING.md`, `GOVERNANCE.md`, `SECURITY.md`, `SUPPORT.md`, `CODE_OF_CONDUCT.md` e `.github/pull_request_template.md` voltam ao pt-BR, que passa a ser o padrão da documentação de repo público (decisão do dono de 06/11/2026, revertendo o ADR 0260; AT-766). Nenhum workflow ou script lê esses arquivos.
- Docs: os links para `docs/...` do monorepo antigo apontam para onde a doc mora hoje: `viralabs-dev/brabo` (ADRs, `getting-started`, `.docmap.yml`, `business-rules`, `branching-policy` em `scripts/ci/docs/explanation/`), `viralabs-dev/brabo-infra` (runbook, `deploy/docs/runbook.md`) e `viralabs-dev/brabo-api` (`security-surface.md`). O Setup do CONTRIBUTING clona pelo `brabo-workspace` (AT-766).
- README: seção "Repositórios do Brabo", com o papel, o "depende de" e o "é usado por" de cada repo (AT-766).
- Templates de issue: os links do runbook (`question.yml`, `bug_report.yml`) apontam para `viralabs-dev/brabo-infra` (`deploy/docs/runbook.md`), sem âncora: o GitHub ignora o `{#id}` e o slug muda com a tradução do título; o `bug_report.yml` cita a seção "Ambiente de inferência" pelo nome. O `feature_request.yml` usa a âncora `#o-que-provavelmente-não-aceito` do CONTRIBUTING em pt-BR.

- `politica.yml` novo: `pr-police` e `escada` do `brabo-ci` pinados por SHA (AT-733); inclui a dispensa da PR do bot (ADR 0255).
- `approval-ladder`: a PR do GitHub App `viralabs-dev-brabo` na branch fixa `chore/regenera-gerados`, mirando `dev`, dispensa a escada (ADR 0255) — autor E branch, como o Dependabot; na `main`, em outra branch ou com humano, a escada segue inteira.
- `version.ts`: repositório sem tag final carimba `v1.0.0` na primeira vez, qualquer que seja a função da branch (antes partia de 0.0.0); com tag, nada muda.
- `tag-release.yml` (reutilizável) aceita os secrets `APP_ID` e `APP_PRIVATE_KEY` e gera o token do GitHub App dentro do próprio job (output de job com token é descartado pelo Actions, medido); `BOT_TOKEN` segue valendo.
- O próprio `brabo-ci` carimba as suas tags chamando `./.github/workflows/tag-release.yml` (`tag.yml`).

## v1.0.0 - 2026-11-04

Primeira versão, extraída do monorepo `daneiel/brabo` (EP-033, AT-695, ADR 0252) com o histórico dos caminhos.

- Workflows reutilizáveis (`workflow_call`): `pr-police`, `approval-ladder`, `archive-merged-branch`, `backmerge-gate`, `promote`, `promotion-check`, `dependabot-para-dev`, `tag-release`, `claude` e `claude-code-review`.
- Scripts da política em `scripts/ci/` (`pr-police`, `approval-ladder`, `version`, `gate`, `promote`, `promotion-check`, `archive-branch`, `tag-release`, `dependabot-*`, `actions-pinadas`), com vitest.
- Modelos de comunidade: `ISSUE_TEMPLATE`, `pull_request_template.md`, `CODE_OF_CONDUCT`, `CONTRIBUTING`, `GOVERNANCE`, `SECURITY`, `SUPPORT`, `CODEOWNERS`, `FUNDING`.
- CI próprio (`ci.yml`) e `dependabot.yml`.
- Lacuna declarada: o nome do GitHub App da organização e do secret do token ainda não existem; os workflows recebem o token como `secrets.BOT_TOKEN` (opcional) de quem chama.
