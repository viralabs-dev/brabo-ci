# Changelog

## Unreleased

- Docs: `README.md`, `CONTRIBUTING.md`, `GOVERNANCE.md`, `SECURITY.md`, `SUPPORT.md`, `CODE_OF_CONDUCT.md` and `.github/pull_request_template.md` are now English only (AT-745). No workflow or script reads these files.

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
