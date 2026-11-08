---
id: workflow-qa-e2e-gatilho
title: Reutilizável qa-e2e-gatilho
sidebar_label: qa-e2e-gatilho
description: "Liga a PR ao brabo-qa: na base main cria o check E2E do brabo-qa e dispara o e2e-pr; na base dev roda o regressivo das funcionalidades tocadas; /qa-aceitar aceita falha de spec ou ambiente."
keywords: [brabo-ci, workflow_call, qa-e2e-gatilho]
---

<!-- GERADO por scripts/ci/referencia-dos-workflows.ts a partir do YAML. Não edite à mão: rode o gerador. -->

# `qa-e2e-gatilho` {#qa-e2e-gatilho}

**Para quem é:** quem vai chamar este reutilizável num repositório seu. **Depois de ler**, você escreve o `uses:` com os inputs, os secrets, as permissões e os gatilhos certos, sem abrir o YAML. Fonte: `.github/workflows/qa-e2e-gatilho.yml`.

## O que faz

Liga a PR ao brabo-qa: na base main cria o check E2E do brabo-qa e dispara o e2e-pr; na base dev roda o regressivo das funcionalidades tocadas; /qa-aceitar aceita falha de spec ou ambiente.

## Gatilhos recomendados

O reutilizável não declara gatilhos: quem chama declara. Os recomendados são:

```yaml
pull_request:
  types: [opened, synchronize, reopened]
  branches: [dev, main]
issue_comment:
  types: [created]
```

## Inputs

| nome | tipo | obrigatório | padrão | descrição |
|---|---|---|---|---|
| `ci_ref` | string | sim | - | O MESMO SHA de 40 hex do `uses:` do chamador (sem padrão: tag ou ausência rodaria scripts de outra versão) |
| `ci_repo` | string | não | viralabs-dev/brabo-ci | O repo do brabo-ci de onde vêm os scripts (owner/repo). Só muda num fork; o `uses:` do chamador deve apontar para o mesmo. |
| `espera_minutos` | number | não | 10 | Teto da espera do carimbo e da assinatura da imagem do head antes do vermelho por ambiente/assinatura (AT-790) |

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
| `disparar` | Disparar o E2E |
| `regressivo-dev` | Regressivo por funcionalidade (dev) |
| `aceitar` | Aceitar com justificativa |

## Exemplo de chamada

`<org>` é a organização onde o brabo-ci mora, e `<sha>`, o commit que você fixa (o `ci_ref` repete o SHA do `uses:`).

```yaml
# .github/workflows/exemplo.yml no repositório que chama
name: exemplo
on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [dev, main]
  issue_comment:
    types: [created]
jobs:
  qa-e2e-gatilho:
    permissions:
      contents: read
    uses: <org>/brabo-ci/.github/workflows/qa-e2e-gatilho.yml@<sha>  # vX.Y.Z
    with:
      ci_ref: <sha>
    secrets:
      APP_ID: ${{ secrets.APP_ID }}
      APP_PRIVATE_KEY: ${{ secrets.APP_PRIVATE_KEY }}
```
