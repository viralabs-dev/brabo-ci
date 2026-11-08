---
id: workflow-cadeia
title: Reutilizável cadeia
sidebar_label: cadeia
description: "Cadeia de suprimentos do CI de quem chama: actionlint nos workflows e todo uses: preso a SHA com a versão em comentário."
keywords: [brabo-ci, workflow_call, cadeia]
---

<!-- GERADO por scripts/ci/referencia-dos-workflows.ts a partir do YAML. Não edite à mão: rode o gerador. -->

# `cadeia` {#cadeia}

**Para quem é:** quem vai chamar este reutilizável num repositório seu. **Depois de ler**, você escreve o `uses:` com os inputs, os secrets, as permissões e os gatilhos certos, sem abrir o YAML. Fonte: `.github/workflows/cadeia.yml`.

## O que faz

Cadeia de suprimentos do CI de quem chama: actionlint nos workflows e todo uses: preso a SHA com a versão em comentário.

## Gatilhos recomendados

O reutilizável não declara gatilhos: quem chama declara. Os recomendados são:

```yaml
pull_request:
push:
  branches: [dev, main]
```

## Inputs

| nome | tipo | obrigatório | padrão | descrição |
|---|---|---|---|---|
| `ci_ref` | string | sim | - | O MESMO SHA de 40 hex do `uses:` do chamador (sem padrão: tag ou ausência rodaria scripts de outra versão) |
| `ci_repo` | string | não | viralabs-dev/brabo-ci | O repo do brabo-ci de onde vêm os scripts (owner/repo). Só muda num fork; o `uses:` do chamador deve apontar para o mesmo. |
| `branch_alvo` | string | não | - | Branch alvo da PR (padrão: base_ref, ou a branch do push). Na main o pin do brabo-ci só aceita release final; na dev, final ou -dev.N (ADR 0280) |

## Secrets

Nenhum.

## Permissões que o chamador precisa conceder

A união do que o workflow e os jobs dele declaram. O job que chama precisa conceder pelo menos isto.

| permissão | nível |
|---|---|
| `contents` | read |

## Jobs

Os nomes dos jobs são os nomes dos checks que a PR mostra (o prefixo do job que chama vem antes).

| job | nome do check |
|---|---|
| `actionlint` | actionlint |
| `pins` | pins |
| `pins-do-brabo-ci` | pins-do-brabo-ci |

## Exemplo de chamada

`<org>` é a organização onde o brabo-ci mora, e `<sha>`, o commit que você fixa (o `ci_ref` repete o SHA do `uses:`).

```yaml
# .github/workflows/exemplo.yml no repositório que chama
name: exemplo
on:
  pull_request:
  push:
    branches: [dev, main]
jobs:
  cadeia:
    permissions:
      contents: read
    uses: <org>/brabo-ci/.github/workflows/cadeia.yml@<sha>  # vX.Y.Z
    with:
      ci_ref: <sha>
```
