---
id: painel-da-mudanca
title: Painel da mudança
sidebar_label: Painel da mudança
sidebar_position: 4
description: Por que uma mudança do Brabo ganha um painel só, o que ele junta, quando para, como disparar um à mão e por que ele nunca reprova.
---

# Painel da mudança

Uma mudança do Brabo pode tocar de sete a onze repositórios. O painel da mudança é o
run `painel.yml` no `brabo-ci`: ele junta, num lugar só, as runs dessa mudança (PR, E2E
do brabo-qa, merge, carimbo, tag e release), cada uma com status, duração e link.

## O que é uma mudança

Cada mudança tem um painel. A mudança é uma destas três coisas:

- **Componente do `Depende-de`**: a partir da PR do evento, o painel segue o `Depende-de:`
  nos dois sentidos (a PR cita; a PR é citada), com profundidade máxima 5 e só os 11
  repos do Brabo.
- **PR de uma tag**: `tag=repo@vX` resolve o commit da tag e a PR mergeada que o contém.
- **À mão**: `workflow_dispatch` com `prs=`, a lista de PRs da mudança.

## Quem acorda o painel

O job `avisar-painel` do `dependencias-de-merge.yml` (reutilizável) faz um
`repository_dispatch` (`event_type: painel`, com `{repo, pr}`) a cada evento da PR,
merge incluso. Antes de disparar, ele confere o debounce: não dispara se já há um painel
`queued` ou `in_progress` com `<repo>#<n>` no título. O token desse job é restrito ao
brabo-ci (`contents: write`, `actions: read`).

## Como acha as runs

- Por PR: `runs?head_sha=<head>`. Se a PR foi mergeada, também `runs?head_sha=<merge_commit_sha>`,
  que traz o carimbo, o `ci` da base e as runs por tag (todas com o mesmo SHA).
- No brabo-qa: as runs do `e2e-pr.yml` cujo `display_title` traz
  `← viralabs-dev/<repo>#<n> · <sha7>`.
- De cada workflow fica a run de maior `run_attempt`.

## Quando ele atualiza e quando para

- Acompanha a mudança a cada 60 s, com ETag. Um 304 não conta no rate limit. Abaixo de
  500 requisições restantes, a volta passa a 5 min.
- Para quando tudo terminou e houve 3 min sem run nova nem mudança de status. Isso cobre
  o carimbo, a tag e a release, que vêm um depois do outro.
- Para com **"aguarda merge"** quando tudo terminou e a PR ainda não foi mergeada. O painel
  não espera o merge: o próprio merge dispara um painel novo, pelo `avisar-painel`.
- Para no teto de 45 min. Um run ainda em andamento sai como "em andamento há N min".
- Se o componente muda (outra PR passou a depender), o painel escreve "superado" e sai.
  O remetente dispara o novo.

## Chave e `run-name`

A chave é curta: `ci#29 api#65 … m=<8 hex>`. O `m=` é um hash da lista completa, então
um componente que cresce ganha outra chave. O `run-name` é `Painel · <repo>#<n>` quando
o painel nasce do `avisar-painel`, e a própria lista de PRs ou a tag quando sai do
disparo à mão.

## Disparo à mão

Serve para a promoção `dev → main` e para qualquer mudança sem `Depende-de` que a leve:

```bash
gh workflow run painel.yml -R viralabs-dev/brabo-ci -f prs='brabo-ci#NN brabo-api#NN'
```

Para uma tag, use `-f tag=brabo@vX.Y.Z` no lugar de `prs`.

## Nunca reprova

O painel **nunca reprova** e **não publica check** nas PRs (decisão do dono, 07/11/2026).
Ele descreve; quem reprova é o run de origem.

## Onde o link aparece

O link fica nas runs de origem, na linha `Disparado | Painel da mudança` dos Vínculos.
Ele aponta para `brabo-ci/actions/workflows/painel.yml` com a busca pelo repo e pelo
número da PR. A linha só sai no modo automático, com PR. Vale para cada chamador no
repin seguinte do brabo-ci.

## Permissões

O token do App do painel só lê (`actions`, `pull-requests` e `contents`). O único token
com escrita é o do dispatch (`contents: write`, restrito ao brabo-ci).

## Segurança

Todo texto vindo da API (nome de workflow, título, URL) passa por uma lista de caracteres
permitidos antes de entrar no Markdown. O que não casa vira `?`. Uma URL só entra no link
se passar na checagem de URL. O Mermaid leva só o repo da allowlist, o número e o status
da fase.

Regras: [RN-1054 a RN-1056](../business-rules/ci.md#rn-1054). Decisão: [ADR 0278](../adr/0278-a-mudanca-e-vista-num-painel-do-brabo-ci.md).
