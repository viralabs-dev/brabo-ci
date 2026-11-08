---
id: licoes-do-ci
title: Lições do CI
sidebar_label: Lições do CI
sidebar_position: 3
description: Quatro armadilhas do GitHub Actions que o brabo-ci já pagou para aprender, cada uma com o porquê em poucas linhas e o arquivo onde a lição está aplicada.
keywords: [github actions, pull_request_target, status check, GITHUB_TOKEN, pin por SHA]
---

# Lições do CI {#licoes-do-ci}

**Para quem é:** quem vai escrever ou copiar workflows de política para o próprio repositório e quer evitar erros que já custaram caro aqui.

**Depois de ler, você consegue:** reconhecer quatro armadilhas do GitHub Actions e saber por que os workflows deste repo têm a forma que têm. Cada lição vem de um comentário no próprio YAML, onde ela continua valendo.

## 1. `pull_request`, não `pull_request_target` {#pull-request-x-target}

- **O erro:** usar `pull_request_target` porque ele deixa escrever rótulo em PR de fork.
- **Por que dá errado:** `pull_request_target` só dispara se o workflow existir na **branch padrão**. Aqui a padrão é `main`, que só avança pela esteira que o próprio workflow deveria guardar. O `pr-police` com `_target` nunca rodou, com zero execuções.
- **O que fazer:** use `pull_request`. Em PR de fork o token é só leitura, então o rótulo (cosmético) deixa de ser escrito, mas a validação segue sendo o portão. Um check que nunca roda é pior do que um rótulo que às vezes falta.
- **Onde:** o cabeçalho de `.github/workflows/pr-police.yml`.

## 2. Job exigido nunca leva `if:` {#job-exigido-sem-if}

- **O erro:** pular o job quando a PR "não é do tipo certo", com `if:` no job.
- **Por que dá errado:** o status check é indexado por (sha, nome). Trocar a base de uma PR não gera sha novo, então um job pulado deixa o PASS antigo colado no sha e a proteção de branch aceita. O buraco é silencioso. A forma de um job dependente ficar vermelho e, ainda assim, contar como verde é o mesmo: `skipped` conta como verde.
- **O que fazer:** deixe o job sempre rodar, e faça o filtro ("é uma promoção?") **dentro** dele, com uma saída explícita. Em job que dependa de outro, use `if: ${{ !cancelled() }}`.
- **Onde:** `.github/workflows/pr-police.yml` e `.github/workflows/promotion-check.yml`, nos comentários dos passos.

## 3. O `GITHUB_TOKEN` não dispara workflow {#github-token-nao-dispara}

- **O erro:** abrir a PR de promoção, ou empurrar a tag, com o token padrão do workflow.
- **Por que dá errado:** o GitHub não dispara workflow a partir de eventos criados pelo `GITHUB_TOKEN`, para evitar recursão. A PR de promoção chegava a "mergeável" sem o Check de promoção ter rodado. Uma tag empurrada assim nunca publicou a Release.
- **O que fazer:** use o token de um App ou um PAT para o que precisa disparar outro workflow. Sem o segredo, o workflow cai no token padrão e **avisa**: a degradação é visível, não silenciosa.
- **Onde:** `.github/workflows/promote.yml` (abertura da PR) e `.github/workflows/tag-release.yml` (empurrar a tag).

## 4. Pin por SHA, não por tag {#pin-por-sha-x-tag}

- **O erro:** `uses: actions/checkout@v4`.
- **Por que dá errado:** tag é um ponteiro que o dono da action move sem aviso, e quem a move executa código no runner que tem o checkout e os segredos do seu workflow.
- **O que fazer:** fixe o SHA do commit e deixe a versão num comentário ao lado: `@<sha>  # v4`. O comentário é o que diz a uma pessoa, e ao Dependabot, qual versão aquele hash é. Todo binário baixado passa por `sha256sum -c`.
- **Onde:** a regra é conferida por `scripts/ci/actions-pinadas.ts` e explicada em [Cadeia de suprimentos do CI](cadeia-de-suprimentos-do-ci.md#actions-commit-sha-with-the-version-alongside).
