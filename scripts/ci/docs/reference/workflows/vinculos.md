---
id: workflow-vinculos
title: Action vinculos
sidebar_label: vinculos
description: "Escreve a tabela Vínculos (origem, irmãos, destino) e o diagrama Mermaid no Summary do run; nunca reprova o job."
keywords: [brabo-ci, action composta, vinculos]
---

<!-- GERADO por scripts/ci/referencia-dos-workflows.ts a partir do YAML. Não edite à mão: rode o gerador. -->

# `vinculos` {#vinculos}

**Para quem é:** quem vai usar esta action num repositório seu. **Depois de ler**, você escreve o `uses:` com os inputs certos, sem abrir o YAML. Fonte: `.github/actions/vinculos/action.yml`.

## O que faz

Escreve a tabela Vínculos (origem, irmãos, destino) e o diagrama Mermaid no Summary do run; nunca reprova o job.

## Inputs

| nome | tipo | obrigatório | padrão | descrição |
|---|---|---|---|---|
| `origem` | string | não | - | JSON {repo, pr?, sha, ator, run_url?, evento?}. Vazio = este próprio run. |
| `irmaos` | string | não | - | Uma linha por irmão: caminho de checkout ou owner/repo@sha. |
| `destino` | string | não | - | Uma linha "rótulo\|url" por destino do resultado. |
| `disparados` | string | não | - | Uma linha "rótulo\|url" por run disparado por este. |

## Outputs

| nome | tipo | obrigatório | padrão | descrição |
|---|---|---|---|---|
| `arquivo` | string | não | - | Caminho do vinculos.md gerado. |

## Exemplo de chamada

`<org>` é a organização onde o brabo-ci mora, e `<sha>`, o commit que você fixa (o `ci_ref` repete o SHA do `uses:`).

```yaml
- uses: <org>/brabo-ci/.github/actions/vinculos@<sha>  # vX.Y.Z
  with:
    irmaos: |
      ../brabo-infra
      <org>/brabo-api@<sha de 40 hex>
```
