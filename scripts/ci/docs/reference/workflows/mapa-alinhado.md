---
id: workflow-mapa-alinhado
title: Reutilizável mapa-alinhado
sidebar_label: mapa-alinhado
description: "Reprova se o bloco \"Onde se encaixa\" do README do repo chamador diverge do repos.yml do brabo (mapa dos 11 repos)."
keywords: [brabo-ci, workflow_call, mapa-alinhado]
---

<!-- GERADO por scripts/ci/referencia-dos-workflows.ts a partir do YAML. Não edite à mão: rode o gerador. -->

# `mapa-alinhado` {#mapa-alinhado}

**Para quem é:** quem vai chamar este reutilizável num repositório seu. **Depois de ler**, você escreve o `uses:` com os inputs, os secrets, as permissões e os gatilhos certos, sem abrir o YAML. Fonte: `.github/workflows/mapa-alinhado.yml`.

## O que faz

Reprova se o bloco "Onde se encaixa" do README do repo chamador diverge do repos.yml do brabo (mapa dos 11 repos).

## Gatilhos recomendados

O reutilizável não declara gatilhos: quem chama declara. Os recomendados são:

```yaml
pull_request:
  types: [opened, reopened, synchronize]
```

## Inputs

| nome | tipo | obrigatório | padrão | descrição |
|---|---|---|---|---|
| `ci_ref` | string | sim | - | O MESMO SHA de 40 hex do `uses:` do chamador (sem padrão: tag ou ausência rodaria scripts de outra versão) |
| `ci_repo` | string | não | viralabs-dev/brabo-ci | O repo do brabo-ci de onde vêm os scripts (owner/repo). Só muda num fork; o `uses:` do chamador deve apontar para o mesmo. |
| `readmes` | string | não | README.md | READMEs com o bloco, separados por espaço |

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
| `conferir` | Mapa alinhado |

## Exemplo de chamada

`<org>` é a organização onde o brabo-ci mora, e `<sha>`, o commit que você fixa (o `ci_ref` repete o SHA do `uses:`).

```yaml
# .github/workflows/exemplo.yml no repositório que chama
name: exemplo
on:
  pull_request:
    types: [opened, reopened, synchronize]
jobs:
  mapa-alinhado:
    permissions:
      contents: read
    uses: <org>/brabo-ci/.github/workflows/mapa-alinhado.yml@<sha>  # vX.Y.Z
    with:
      ci_ref: <sha>
```
