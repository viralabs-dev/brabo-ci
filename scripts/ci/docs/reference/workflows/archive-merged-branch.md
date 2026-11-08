---
id: workflow-archive-merged-branch
title: Reutilizável archive-merged-branch
sidebar_label: archive-merged-branch
description: "Arquiva toda semana as branches já mergeadas e sem commit novo, movendo para refs/archive/<nome>; nunca apaga."
keywords: [brabo-ci, workflow_call, archive-merged-branch]
---

<!-- GERADO por scripts/ci/referencia-dos-workflows.ts a partir do YAML. Não edite à mão: rode o gerador. -->

# `archive-merged-branch` {#archive-merged-branch}

**Para quem é:** quem vai chamar este reutilizável num repositório seu. **Depois de ler**, você escreve o `uses:` com os inputs, os secrets, as permissões e os gatilhos certos, sem abrir o YAML. Fonte: `.github/workflows/archive-merged-branch.yml`.

## O que faz

Arquiva toda semana as branches já mergeadas e sem commit novo, movendo para refs/archive/<nome>; nunca apaga.

## Gatilhos recomendados

O reutilizável não declara gatilhos: quem chama declara. Os recomendados são:

```yaml
schedule:
  - cron: '0 12 * * 1'
workflow_dispatch:
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
| `contents` | write |
| `pull-requests` | read |

## Jobs

Os nomes dos jobs são os nomes dos checks que a PR mostra (o prefixo do job que chama vem antes).

| job | nome do check |
|---|---|
| `arquivar` | Arquivar branches mergeadas |

## Exemplo de chamada

`<org>` é a organização onde o brabo-ci mora, e `<sha>`, o commit que você fixa (o `ci_ref` repete o SHA do `uses:`).

```yaml
# .github/workflows/exemplo.yml no repositório que chama
name: exemplo
on:
  schedule:
    - cron: '0 12 * * 1'
  workflow_dispatch:
jobs:
  archive-merged-branch:
    permissions:
      contents: write
      pull-requests: read
    uses: <org>/brabo-ci/.github/workflows/archive-merged-branch.yml@<sha>  # vX.Y.Z
    with:
      ci_ref: <sha>
```
