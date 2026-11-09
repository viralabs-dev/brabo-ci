---
id: workflow-dependencias-de-merge
title: Reutilizável dependencias-de-merge
sidebar_label: dependencias-de-merge
description: "Faz o check Dependências de merge esperar as PRs citadas em `Depende-de: <org>/<repo>#<n>` até todas estarem mergeadas."
keywords: [brabo-ci, workflow_call, dependencias-de-merge]
---

<!-- GERADO por scripts/ci/referencia-dos-workflows.ts a partir do YAML. Não edite à mão: rode o gerador. -->

# `dependencias-de-merge` {#dependencias-de-merge}

**Para quem é:** quem vai chamar este reutilizável num repositório seu. **Depois de ler**, você escreve o `uses:` com os inputs, os secrets, as permissões e os gatilhos certos, sem abrir o YAML. Fonte: `.github/workflows/dependencias-de-merge.yml`.

## O que faz

Faz o check Dependências de merge esperar as PRs citadas em `Depende-de: <org>/<repo>#<n>` até todas estarem mergeadas.

## Gatilhos recomendados

O reutilizável não declara gatilhos: quem chama declara. Os recomendados são:

```yaml
pull_request:
  types: [opened, edited, synchronize, reopened, closed]
```

## Inputs

| nome | tipo | obrigatório | padrão | descrição |
|---|---|---|---|---|
| `ci_ref` | string | sim | - | O MESMO SHA de 40 hex do `uses:` do chamador (sem padrão: tag ou ausência rodaria scripts de outra versão) |
| `ci_repo` | string | não | viralabs-dev/brabo-ci | O repo do brabo-ci de onde vêm os scripts (owner/repo). Só muda num fork; o `uses:` do chamador deve apontar para o mesmo. |

## Secrets

| nome | obrigatório | descrição |
|---|---|---|
| `APP_ID` | sim | ID do GitHub App do bot da organização |
| `APP_PRIVATE_KEY` | sim | Chave privada do GitHub App do bot da organização |

## Permissões que o chamador precisa conceder

A união do que o workflow e os jobs dele declaram. O job que chama precisa conceder pelo menos isto.

| permissão | nível |
|---|---|
| `contents` | read |

## Jobs

Os nomes dos jobs são os nomes dos checks que a PR mostra (o prefixo do job que chama vem antes).

| job | nome do check |
|---|---|
| `avaliar` | Avaliar as dependências |
| `avisar-dependentes` | Avisar as PRs dependentes |
| `avisar-painel` | Avisar o painel |

## Exemplo de chamada

`<org>` é a organização onde o brabo-ci mora, e `<sha>`, o commit que você fixa (o `ci_ref` repete o SHA do `uses:`).

```yaml
# .github/workflows/exemplo.yml no repositório que chama
name: exemplo
on:
  pull_request:
    types: [opened, edited, synchronize, reopened, closed]
jobs:
  dependencias-de-merge:
    permissions:
      contents: read
    uses: <org>/brabo-ci/.github/workflows/dependencias-de-merge.yml@<sha>  # vX.Y.Z
    with:
      ci_ref: <sha>
    secrets:
      APP_ID: ${{ secrets.APP_ID }}
      APP_PRIVATE_KEY: ${{ secrets.APP_PRIVATE_KEY }}
```
