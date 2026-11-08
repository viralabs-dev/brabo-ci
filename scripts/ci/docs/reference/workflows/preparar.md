---
id: workflow-preparar
title: Action preparar
sidebar_label: preparar
description: "Depois do checkout mínimo do brabo-ci em .brabo-ci/, confere o ci_ref, instala o Node e, se pedido, as dependências de produção dos scripts."
keywords: [brabo-ci, action composta, preparar]
---

<!-- GERADO por scripts/ci/referencia-dos-workflows.ts a partir do YAML. Não edite à mão: rode o gerador. -->

# `preparar` {#preparar}

**Para quem é:** quem vai usar esta action num repositório seu. **Depois de ler**, você escreve o `uses:` com os inputs certos, sem abrir o YAML. Fonte: `.github/actions/preparar/action.yml`.

## O que faz

Depois do checkout mínimo do brabo-ci em .brabo-ci/, confere o ci_ref, instala o Node e, se pedido, as dependências de produção dos scripts.

## Inputs

| nome | tipo | obrigatório | padrão | descrição |
|---|---|---|---|---|
| `ci_ref` | string | sim | - | O mesmo SHA de 40 hex do `uses:` do reutilizável. |
| `dependencias` | string | não | false | true instala as dependências de produção dos scripts (picomatch, yaml). |

## Exemplo de chamada

`<org>` é a organização onde o brabo-ci mora, e `<sha>`, o commit que você fixa (o `ci_ref` repete o SHA do `uses:`).

```yaml
- uses: ./.brabo-ci/.github/actions/preparar
  with:
    ci_ref: <sha>
```
