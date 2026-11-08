---
id: workflow-pr-police
title: Reutilizável pr-police
sidebar_label: pr-police
description: "Confere a forma de toda PR (nome da branch, origem e destino), reprova com o código da violação e o conserto, e escreve a label de família."
keywords: [brabo-ci, workflow_call, pr-police]
---

<!-- GERADO por scripts/ci/referencia-dos-workflows.ts a partir do YAML. Não edite à mão: rode o gerador. -->

# `pr-police` {#pr-police}

**Para quem é:** quem vai chamar este reutilizável num repositório seu. **Depois de ler**, você escreve o `uses:` com os inputs, os secrets, as permissões e os gatilhos certos, sem abrir o YAML. Fonte: `.github/workflows/pr-police.yml`.

## O que faz

Confere a forma de toda PR (nome da branch, origem e destino), reprova com o código da violação e o conserto, e escreve a label de família.

## Gatilhos recomendados

O reutilizável não declara gatilhos: quem chama declara. Os recomendados são:

```yaml
pull_request:
  types: [opened, edited, reopened, synchronize, ready_for_review]
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

## Jobs

Os nomes dos jobs são os nomes dos checks que a PR mostra (o prefixo do job que chama vem antes).

| job | nome do check |
|---|---|
| `policiar` | Política de branches |

## Exemplo de chamada

`<org>` é a organização onde o brabo-ci mora, e `<sha>`, o commit que você fixa (o `ci_ref` repete o SHA do `uses:`).

```yaml
# .github/workflows/exemplo.yml no repositório que chama
name: exemplo
on:
  pull_request:
    types: [opened, edited, reopened, synchronize, ready_for_review]
jobs:
  pr-police:
    permissions:
      contents: read
      pull-requests: write
    uses: <org>/brabo-ci/.github/workflows/pr-police.yml@<sha>  # vX.Y.Z
    with:
      ci_ref: <sha>
```
