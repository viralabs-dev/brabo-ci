---
id: workflow-approval-ladder
title: Reutilizável approval-ladder
sidebar_label: approval-ladder
description: "Exige as aprovações certas de cada degrau (dev ou main) conforme o modo solo ou community; dispensa a PR do Dependabot e a de regeneração do bot na dev."
keywords: [brabo-ci, workflow_call, approval-ladder]
---

<!-- GERADO por scripts/ci/referencia-dos-workflows.ts a partir do YAML. Não edite à mão: rode o gerador. -->

# `approval-ladder` {#approval-ladder}

**Para quem é:** quem vai chamar este reutilizável num repositório seu. **Depois de ler**, você escreve o `uses:` com os inputs, os secrets, as permissões e os gatilhos certos, sem abrir o YAML. Fonte: `.github/workflows/approval-ladder.yml`.

## O que faz

Exige as aprovações certas de cada degrau (dev ou main) conforme o modo solo ou community; dispensa a PR do Dependabot e a de regeneração do bot na dev.

## Gatilhos recomendados

O reutilizável não declara gatilhos: quem chama declara. Os recomendados são:

```yaml
pull_request:
  types: [opened, edited, reopened, synchronize, ready_for_review]
pull_request_review:
  types: [submitted, edited, dismissed]
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
| `pull-requests` | read |

## Jobs

Os nomes dos jobs são os nomes dos checks que a PR mostra (o prefixo do job que chama vem antes).

| job | nome do check |
|---|---|
| `escada` | Escada de aprovação |

## Exemplo de chamada

`<org>` é a organização onde o brabo-ci mora, e `<sha>`, o commit que você fixa (o `ci_ref` repete o SHA do `uses:`).

```yaml
# .github/workflows/exemplo.yml no repositório que chama
name: exemplo
on:
  pull_request:
    types: [opened, edited, reopened, synchronize, ready_for_review]
  pull_request_review:
    types: [submitted, edited, dismissed]
jobs:
  approval-ladder:
    permissions:
      contents: read
      pull-requests: read
    uses: <org>/brabo-ci/.github/workflows/approval-ladder.yml@<sha>  # vX.Y.Z
    with:
      ci_ref: <sha>
```
