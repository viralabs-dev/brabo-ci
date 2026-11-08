# Painel da mudança (AT-792)

Uma run só no `brabo-ci` que mostra as runs de uma mudança espalhada pelos repos: PR, E2E do brabo-qa, merge, carimbo, tag e release, cada uma com status, duração e link.

## O que é uma mudança
- **Componente do `Depende-de`**: a partir da PR do evento, segue o `Depende-de:` nos dois sentidos (a PR cita; a PR é citada), com profundidade máxima 5 e só os 11 repos do Brabo.
- **PR de uma tag**: `tag=repo@vX` resolve o commit da tag e a PR mergeada que o contém.
- **À mão**: `workflow_dispatch` com `prs=brabo-ci#29 brabo-api#65 ...` (a promoção `dev → main` enquanto o `Depende-de` automático nas promoções, AT-788, não existe).

A chave é `ci#29 api#65 … m=<8 hex>`; o hash cobre a lista completa. O `run-name` é `Painel · <repo>#<n>`.

## Como achar as runs
Por PR: `runs?head_sha=<head>`; se mergeada, `runs?head_sha=<merge_commit_sha>` (carimbo, `ci` da base e as runs por tag, que têm o mesmo SHA); e no brabo-qa as runs do `e2e-pr.yml` cujo `display_title` traz `← viralabs-dev/<repo>#<n> · <sha7>` (o `c=` do E2E, AT-773). De cada workflow fica a run de maior `run_attempt`.

## Acompanhamento
- Volta a cada 60 s com `If-None-Match` (304 não conta no rate limit). Abaixo de 500 requisições restantes, a volta passa a 5 min.
- Termina quando tudo está `completed` e houve 3 min sem run nova nem mudança de status (cobre carimbo → tag → release), ou quando a PR ainda não foi mergeada (o merge acorda um painel novo). Teto: 45 min; run ainda em andamento sai como "em andamento há N min".
- Se o componente muda (outra PR passou a depender), o painel escreve "superado" e sai; o remetente dispara o novo.
- O painel **nunca reprova** e **não publica check nas PRs** (decisão do dono, 07/11/2026). O token do App é só leitura (`actions`, `pull-requests`, `contents`).

## Quem acorda o painel
O job `avisar-painel` do `dependencias-de-merge.yml` (reutilizável) faz `repository_dispatch` (`event_type: painel`, `{repo, pr}`) a cada evento da PR (merge incluso). Debounce: não dispara se há painel `queued` ou `in_progress` com `<repo>#<n>` no título. O token desse job é restrito ao brabo-ci (`contents: write`, `actions: read`).

## Link de volta
O helper de Vínculos, no modo auto com PR, acrescenta `Disparado | Painel da mudança` com `https://github.com/viralabs-dev/brabo-ci/actions/workflows/painel.yml?query=<repo>%23<n>`. Vale para cada chamador no repin seguinte do `brabo-ci`.

## Segurança
Todo texto vindo da API (nome de workflow, título, URL) passa por lista de caracteres permitidos antes de entrar no Markdown; o que não casa vira `?`. O Mermaid só leva repo da allowlist, número e o status da fase.
