---
id: workflow-promote
title: Reutilizável promote
sidebar_label: promote
description: "Calcula a versão do ciclo e abre a PR de promoção de um degrau ao próximo (padrão dev->main); o merge continua humano."
keywords: [brabo-ci, workflow_call, promote]
---

<!-- GERADO por scripts/ci/referencia-dos-workflows.ts a partir do YAML. Não edite à mão: rode o gerador. -->

# `promote` {#promote}

**Para quem é:** quem vai chamar este reutilizável num repositório seu. **Depois de ler**, você escreve o `uses:` com os inputs, os secrets, as permissões e os gatilhos certos, sem abrir o YAML. Fonte: `.github/workflows/promote.yml`.

## O que faz

Calcula a versão do ciclo e abre a PR de promoção de um degrau ao próximo (padrão dev->main); o merge continua humano.

## Gatilhos recomendados

O reutilizável não declara gatilhos: quem chama declara. Os recomendados são:

```yaml
workflow_dispatch:
```

## Inputs

| nome | tipo | obrigatório | padrão | descrição |
|---|---|---|---|---|
| `ci_ref` | string | sim | - | O MESMO SHA de 40 hex do `uses:` do chamador (sem padrão: tag ou ausência rodaria scripts de outra versão) |
| `ci_repo` | string | não | viralabs-dev/brabo-ci | O repo do brabo-ci de onde vêm os scripts (owner/repo). Só muda num fork; o `uses:` do chamador deve apontar para o mesmo. |
| `par` | string | não | dev->main | Par da esteira a promover |

## Secrets

| nome | obrigatório | descrição |
|---|---|---|
| `APP_ID` | não | ID do GitHub App do bot da organização |
| `APP_PRIVATE_KEY` | não | Chave privada do GitHub App do bot da organização |
| `BOT_TOKEN` | não | PAT ou token do GitHub App do bot (opcional: sem ele os checks do PR de promoção nascem em action_required) |

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
| `promover` | Abrir PR de promoção |

## Exemplo de chamada

`<org>` é a organização onde o brabo-ci mora, e `<sha>`, o commit que você fixa (o `ci_ref` repete o SHA do `uses:`).

```yaml
# .github/workflows/exemplo.yml no repositório que chama
name: exemplo
on:
  workflow_dispatch:
jobs:
  promote:
    permissions:
      contents: read
      pull-requests: write
    uses: <org>/brabo-ci/.github/workflows/promote.yml@<sha>  # vX.Y.Z
    with:
      ci_ref: <sha>
```
