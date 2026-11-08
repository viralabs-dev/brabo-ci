---
id: workflow-tag-release
title: Reutilizável tag-release
sidebar_label: tag-release
description: "Carimba a tag do estágio a cada merge numa permanente e, se o merge foi um hotfix, trava o gate e abre as PRs de retropropagação."
keywords: [brabo-ci, workflow_call, tag-release]
---

<!-- GERADO por scripts/ci/referencia-dos-workflows.ts a partir do YAML. Não edite à mão: rode o gerador. -->

# `tag-release` {#tag-release}

**Para quem é:** quem vai chamar este reutilizável num repositório seu. **Depois de ler**, você escreve o `uses:` com os inputs, os secrets, as permissões e os gatilhos certos, sem abrir o YAML. Fonte: `.github/workflows/tag-release.yml`.

## O que faz

Carimba a tag do estágio a cada merge numa permanente e, se o merge foi um hotfix, trava o gate e abre as PRs de retropropagação.

## Gatilhos recomendados

O reutilizável não declara gatilhos: quem chama declara. Os recomendados são:

```yaml
push:
  branches: [dev, main]
```

## Inputs

| nome | tipo | obrigatório | padrão | descrição |
|---|---|---|---|---|
| `ci_ref` | string | sim | - | O MESMO SHA de 40 hex do `uses:` do chamador (sem padrão: tag ou ausência rodaria scripts de outra versão) |
| `ci_repo` | string | não | viralabs-dev/brabo-ci | O repo do brabo-ci de onde vêm os scripts (owner/repo). Só muda num fork; o `uses:` do chamador deve apontar para o mesmo. |

## Secrets

| nome | obrigatório | descrição |
|---|---|---|
| `APP_ID` | não | ID do GitHub App do bot. Com APP_ID e APP_PRIVATE_KEY o token é gerado AQUI: output de job que carrega token é descartado pelo Actions, então o chamador não consegue passá-lo como BOT_TOKEN |
| `APP_PRIVATE_KEY` | não | Chave privada do GitHub App do bot |
| `BOT_TOKEN` | não | PAT ou token do GitHub App do bot (sem ele a tag nasce mas não dispara a Release; obrigatório para hotfix) |

## Permissões que o chamador precisa conceder

A união do que o workflow e os jobs dele declaram. O job que chama precisa conceder pelo menos isto.

| permissão | nível |
|---|---|
| `contents` | write |
| `issues` | write |
| `pull-requests` | write |

## Jobs

Os nomes dos jobs são os nomes dos checks que a PR mostra (o prefixo do job que chama vem antes).

| job | nome do check |
|---|---|
| `carimbar` | Tag do estágio |
| `travar` | Travar o gate e abrir as retropropagações |
| `destravar` | Destravar o gate |
| `avisar` | Avisar que o carimbo falhou |

## Exemplo de chamada

`<org>` é a organização onde o brabo-ci mora, e `<sha>`, o commit que você fixa (o `ci_ref` repete o SHA do `uses:`).

```yaml
# .github/workflows/exemplo.yml no repositório que chama
name: exemplo
on:
  push:
    branches: [dev, main]
jobs:
  tag-release:
    permissions:
      contents: write
      issues: write
      pull-requests: write
    uses: <org>/brabo-ci/.github/workflows/tag-release.yml@<sha>  # vX.Y.Z
    with:
      ci_ref: <sha>
```
