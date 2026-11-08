---
id: workflow-publish-npm
title: Reutilizável publish-npm
sidebar_label: publish-npm
description: "Publica pacotes npm no GitHub Packages a partir da tag, com o .tgz atestado; -dev.N vai ao dist-tag dev e a versão final a latest."
keywords: [brabo-ci, workflow_call, publish-npm]
---

<!-- GERADO por scripts/ci/referencia-dos-workflows.ts a partir do YAML. Não edite à mão: rode o gerador. -->

# `publish-npm` {#publish-npm}

**Para quem é:** quem vai chamar este reutilizável num repositório seu. **Depois de ler**, você escreve o `uses:` com os inputs, os secrets, as permissões e os gatilhos certos, sem abrir o YAML. Fonte: `.github/workflows/publish-npm.yml`.

## O que faz

Publica pacotes npm no GitHub Packages a partir da tag, com o .tgz atestado; -dev.N vai ao dist-tag dev e a versão final a latest.

## Gatilhos recomendados

O reutilizável não declara gatilhos: quem chama declara. Os recomendados são:

```yaml
push:
  tags: ['v*']
```

## Inputs

| nome | tipo | obrigatório | padrão | descrição |
|---|---|---|---|---|
| `tag` | string | sim | - | Tag que dispara a publicação (vX.Y.Z ou vX.Y.Z-dev.N) |
| `pacotes` | string | sim | - | Diretórios dos pacotes, um por linha (ex.: packages/shared) |
| `ci_ref` | string | sim | - | O MESMO SHA de 40 hex do `uses:` do chamador (sem padrão: tag ou ausência rodaria scripts de outra versão) |
| `ci_repo` | string | não | viralabs-dev/brabo-ci | O repo do brabo-ci de onde vêm os scripts (owner/repo). Só muda num fork; o `uses:` do chamador deve apontar para o mesmo. |

## Secrets

Nenhum.

## Permissões que o chamador precisa conceder

A união do que o workflow e os jobs dele declaram. O job que chama precisa conceder pelo menos isto.

| permissão | nível |
|---|---|
| `attestations` | write |
| `contents` | read |
| `id-token` | write |
| `packages` | write |

## Jobs

Os nomes dos jobs são os nomes dos checks que a PR mostra (o prefixo do job que chama vem antes).

| job | nome do check |
|---|---|
| `publicar` | Publicar no GitHub Packages |

## Exemplo de chamada

`<org>` é a organização onde o brabo-ci mora, e `<sha>`, o commit que você fixa (o `ci_ref` repete o SHA do `uses:`).

```yaml
# .github/workflows/exemplo.yml no repositório que chama
name: exemplo
on:
  push:
    tags: ['v*']
jobs:
  publish-npm:
    permissions:
      attestations: write
      contents: read
      id-token: write
      packages: write
    uses: <org>/brabo-ci/.github/workflows/publish-npm.yml@<sha>  # vX.Y.Z
    with:
      tag: '<valor>'
      pacotes: '<valor>'
      ci_ref: <sha>
```
