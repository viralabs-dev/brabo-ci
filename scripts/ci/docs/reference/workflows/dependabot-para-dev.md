---
id: workflow-dependabot-para-dev
title: Reutilizável dependabot-para-dev
sidebar_label: dependabot-para-dev
description: "Fecha ou redireciona para a dev a PR de segurança do Dependabot que o GitHub abre contra a main."
keywords: [brabo-ci, workflow_call, dependabot-para-dev]
---

<!-- GERADO por scripts/ci/referencia-dos-workflows.ts a partir do YAML. Não edite à mão: rode o gerador. -->

# `dependabot-para-dev` {#dependabot-para-dev}

**Para quem é:** quem vai chamar este reutilizável num repositório seu. **Depois de ler**, você escreve o `uses:` com os inputs, os secrets, as permissões e os gatilhos certos, sem abrir o YAML. Fonte: `.github/workflows/dependabot-para-dev.yml`.

## O que faz

Fecha ou redireciona para a dev a PR de segurança do Dependabot que o GitHub abre contra a main.

## Gatilhos recomendados

O reutilizável não declara gatilhos: quem chama declara. Os recomendados são:

```yaml
push:
  branches: [dev]
workflow_dispatch:
pull_request_target:
  types: [opened, reopened]
  branches: [main]
```

## Inputs

| nome | tipo | obrigatório | padrão | descrição |
|---|---|---|---|---|
| `ci_ref` | string | sim | - | O MESMO SHA de 40 hex do `uses:` do chamador (sem padrão: tag ou ausência rodaria scripts de outra versão) |
| `ci_repo` | string | não | viralabs-dev/brabo-ci | O repo do brabo-ci de onde vêm os scripts (owner/repo). Só muda num fork; o `uses:` do chamador deve apontar para o mesmo. |

## Secrets

Nenhum.

## Permissões que o chamador precisa conceder

A união do que o workflow e os jobs dele declaram. O job que chama precisa conceder pelo menos isto.

| permissão | nível |
|---|---|
| `contents` | read |
| `pull-requests` | write |
| `security-events` | read |

## Jobs

Os nomes dos jobs são os nomes dos checks que a PR mostra (o prefixo do job que chama vem antes).

| job | nome do check |
|---|---|
| `varrer` | Dependabot entra pela dev |

## Exemplo de chamada

`<org>` é a organização onde o brabo-ci mora, e `<sha>`, o commit que você fixa (o `ci_ref` repete o SHA do `uses:`).

```yaml
# .github/workflows/exemplo.yml no repositório que chama
name: exemplo
on:
  push:
    branches: [dev]
  workflow_dispatch:
  pull_request_target:
    types: [opened, reopened]
    branches: [main]
jobs:
  dependabot-para-dev:
    permissions:
      contents: read
      pull-requests: write
      security-events: read
    uses: <org>/brabo-ci/.github/workflows/dependabot-para-dev.yml@<sha>  # vX.Y.Z
    with:
      ci_ref: <sha>
```
