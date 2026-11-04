# Changelog

## v1.0.0 - 2026-11-04

Primeira versão, extraída do monorepo `daneiel/brabo` (EP-033, AT-695, ADR 0252) com o histórico dos caminhos.

- Workflows reutilizáveis (`workflow_call`): `pr-police`, `approval-ladder`, `archive-merged-branch`, `backmerge-gate`, `promote`, `promotion-check`, `dependabot-para-dev`, `tag-release`, `claude` e `claude-code-review`.
- Scripts da política em `scripts/ci/` (`pr-police`, `approval-ladder`, `version`, `gate`, `promote`, `promotion-check`, `archive-branch`, `tag-release`, `dependabot-*`, `actions-pinadas`), com vitest.
- Modelos de comunidade: `ISSUE_TEMPLATE`, `pull_request_template.md`, `CODE_OF_CONDUCT`, `CONTRIBUTING`, `GOVERNANCE`, `SECURITY`, `SUPPORT`, `CODEOWNERS`, `FUNDING`.
- CI próprio (`ci.yml`) e `dependabot.yml`.
- Lacuna declarada: o nome do GitHub App da organização e do secret do token ainda não existem; os workflows recebem o token como `secrets.BOT_TOKEN` (opcional) de quem chama.
