---
id: adotar
title: Adotar a política do brabo-ci
sidebar_label: Adotar a política
sidebar_position: 1
description: Tutorial para pôr a política de PR do brabo-ci (pr-police e escada) num repositório que nunca viu o Brabo, com o repositório-exemplo como prova.
keywords: [brabo-ci, adoção, pr-police, approval-ladder, tag-release, GitHub App, tutorial]
---

# Adotar a política do brabo-ci {#adotar}

**Para quem é:** quem mantém um repositório no GitHub, nunca viu o Brabo e quer a política de PR do brabo-ci nele (nome de branch, destino e aprovação).

**Depois de ler, você consegue:** deixar uma PR do seu repositório policiada pelo `pr-police` e pela `escada`, saber quando precisa do GitHub App e o que fazer quando um check reprova.

**Como se prova:** o repositório [`daneiel/brabo-ci-exemplo`](https://github.com/daneiel/brabo-ci-exemplo) foi montado só com os passos 1 a 4 e tem a [PR de exemplo](https://github.com/daneiel/brabo-ci-exemplo/pull/1) com os dois checks verdes. O `politica.yml` do passo 3 é idêntico ao dele.

Se a política for novidade, leia antes a [política em 10 minutos](../explanation/politica-em-10-minutos.md). Os termos estão no [glossário](../reference/glossario-da-politica.md).

## Antes de começar: o `ci_ref` {#ci-ref}

Cada reutilizável do brabo-ci busca os próprios scripts num segundo checkout. O `ci_ref` diz qual versão. Ele tem de ser o **mesmo SHA de 40 caracteres** do `uses:`, porque o `uses:` escolhe o YAML e o `ci_ref` escolhe os scripts: se divergirem, o YAML novo rodaria scripts de outra versão. Tag e branch não valem. O comentário `# vX.Y.Z` depois do SHA diz a versão a quem lê.

Para achar um SHA, abra as [tags do brabo-ci](https://github.com/viralabs-dev/brabo-ci/tags) e copie o commit da tag que quiser. Este guia usa `738350eb049e9b117818816c29d99c01f7c5667a`, a tag `v1.4.0-dev.8`.

## Kit mínimo: `pr-police` e `escada` {#kit-minimo}

Precisa de uma conta com permissão de administrar o repositório. **Não precisa de GitHub App nem de segredo.**

### 1. Crie `dev` e `main` {#passo-branches}

A esteira é `dev -> main`: o trabalho nasce de `dev` e a `main` só recebe promoções. Se o repositório só tem `main`:

```bash
git checkout main && git pull
git checkout -b dev && git push -u origin dev
```

**Como saber que funcionou:** `git ls-remote --heads origin` lista `dev` e `main`.

### 2. Defina `OWNER_HANDLE` {#passo-vars}

A `escada` trabalha no modo `solo` por padrão (a variável `APPROVAL_MODE` não precisa existir). No modo `solo` a aprovação exigida é a do dono, e ela precisa saber quem é:

```bash
gh variable set OWNER_HANDLE --body seu-login -R seu-login/seu-repo
```

É uma variável, não um segredo. Sem ela a `escada` reprova (veja a [solução de problemas](#problemas)). A PR do próprio dono passa sem review, porque o GitHub não deixa ninguém aprovar a própria PR.

O modo `community` (aprovação por papéis, com `APROVADORES_DEVS`, `APROVADORES_QUALIDADE`, `APROVADORES_PO` e `APROVADORES_GESTAO`) está descrito na [escada](../reference/workflows/approval-ladder.md).

### 3. Cole o `politica.yml` {#passo-politica}

Em `.github/workflows/politica.yml`, na `dev`:

```yaml
name: politica
on:
  pull_request:
    types: [opened, edited, reopened, synchronize, ready_for_review]
  pull_request_review:
    types: [submitted, edited, dismissed]
permissions:
  contents: read
  pull-requests: write
jobs:
  pr-police:
    uses: viralabs-dev/brabo-ci/.github/workflows/pr-police.yml@738350eb049e9b117818816c29d99c01f7c5667a  # v1.4.0-dev.8
    with:
      ci_ref: 738350eb049e9b117818816c29d99c01f7c5667a  # v1.4.0-dev.8
  escada:
    uses: viralabs-dev/brabo-ci/.github/workflows/approval-ladder.yml@738350eb049e9b117818816c29d99c01f7c5667a  # v1.4.0-dev.8
    with:
      ci_ref: 738350eb049e9b117818816c29d99c01f7c5667a  # v1.4.0-dev.8
```

Troque o SHA e o comentário se quiser outra versão, sempre nos quatro lugares ao mesmo tempo. Nunca ponha `if:` nesses jobs: check obrigatório que se pula deixa veredito velho colado ([lição 2](../explanation/licoes-do-ci.md#job-exigido-sem-if)). Os gatilhos ficam no seu repositório; a [referência](../reference/workflows/pr-police.md) lista inputs e permissões.

**Como saber que funcionou:** a aba Actions mostra o workflow `politica`.

### 4. Abra uma PR {#passo-pr}

```bash
git checkout -b feature/minha-primeira-pr dev
git commit --allow-empty -m "docs: primeira PR policiada"
git push -u origin feature/minha-primeira-pr
gh pr create --base dev --fill
```

**Saída esperada**, medida no exemplo ([PR 1](https://github.com/daneiel/brabo-ci-exemplo/pull/1)):

```text
escada / Escada de aprovação        pass
pr-police / Política de branches    pass
```

No log do `pr-police`: `feature/exemplo-de-pr -> dev` e `APROVADO - família: trabalho`. A PR ganha a label `trabalho`; o workflow a cria se ela não existir.

**Como saber que funcionou:** os dois checks verdes e a label na PR. Para ver o contrário, abra uma PR de uma branch `login` (sem a função antes da barra): o `pr-police` reprova com `NOME-FORA-DO-FORMATO`.

### 5. Exija os checks (ruleset) {#passo-ruleset}

Sem ruleset os checks avisam mas não bloqueiam. Em Settings, Rules, Rulesets, crie um para `dev` e `main` que exija PR e os checks, pelos nomes exatos: **Política de branches** e **Escada de aprovação**. O passo a passo e os demais nomes ("Check de promoção", "Backmerge gate") estão em [rulesets](../reference/rulesets.md). O exemplo não liga ruleset, só mostra os checks.

## Carimbo de tag: `tag-release` {#carimbo}

O `tag-release` cria a tag de versão a cada merge em `dev` ou `main` (a função da branch decide MAJOR, MINOR ou PATCH). Cole `.github/workflows/tag.yml`:

```yaml
name: tag
on:
  push:
    branches: [dev, main]
permissions:
  contents: write
  pull-requests: write
  issues: write
jobs:
  carimbar:
    uses: viralabs-dev/brabo-ci/.github/workflows/tag-release.yml@738350eb049e9b117818816c29d99c01f7c5667a  # v1.4.0-dev.8
    with:
      ci_ref: 738350eb049e9b117818816c29d99c01f7c5667a  # v1.4.0-dev.8
    secrets:
      APP_ID: ${{ secrets.APP_ID }}
      APP_PRIVATE_KEY: ${{ secrets.APP_PRIVATE_KEY }}
```

No primeiro merge o `version.ts` carimba `v1.0.0`; depois a função da branch sobe a versão. **Sem o App** a tag nasce com o `GITHUB_TOKEN` e o workflow avisa, mas a tag assim empurrada não dispara outros workflows (a Release não sai), e o hotfix exige o token do App. Este passo não está provado no exemplo; a prova da tag virá com o App.

## O GitHub App {#app}

O App troca o `GITHUB_TOKEN` por um token que **dispara outros workflows**. Você precisa dele para a tag disparar a Release, para a PR de promoção rodar o "Check de promoção" e para hotfix.

1. Em Settings do dono (usuário ou org), Developer settings, GitHub Apps, New GitHub App. Desligue o webhook.
2. Permissões de repositório: `Contents: Read and write`, `Pull requests: Read and write`, `Issues: Read and write`, `Metadata: Read`. São a união dos `permissions:` do `tag-release` e do `promote`.
3. Gere uma chave privada e instale o App no repositório.
4. Cadastre os segredos de repositório `APP_ID` (o Client ID do App) e `APP_PRIVATE_KEY` (o conteúdo do `.pem`). Os nomes são os que o `tag.yml` acima lê; o brabo-ci não fixa o nome do App, só os dois segredos.

O repositório-exemplo não cadastra segredo nenhum, e por isso só prova o kit mínimo.

## Kit completo {#kit-completo}

Cada reutilizável tem uma página gerada do YAML, com gatilhos, inputs, segredos, permissões e um exemplo de chamada. Chame todos com o mesmo `ci_ref` do `uses:`.

| Reutilizável | Para que serve | Check | Precisa do App |
|---|---|---|---|
| [`promote`](../reference/workflows/promote.md) | abre a PR `dev -> main` (`workflow_dispatch`) | Abrir PR de promoção | sim, para a PR disparar checks |
| [`promotion-check`](../reference/workflows/promotion-check.md) | confere a PR de promoção | Check de promoção | não |
| [`backmerge-gate`](../reference/workflows/backmerge-gate.md) | trava PRs enquanto um hotfix espera a retropropagação | Backmerge gate | não |
| [`archive-merged-branch`](../reference/workflows/archive-merged-branch.md) | arquiva branches mergeadas (nunca apaga) | - | não |
| [`dependabot-para-dev`](../reference/workflows/dependabot-para-dev.md) | manda PR de segurança do Dependabot para a `dev` | - | não |
| [`publish-npm`](../reference/workflows/publish-npm.md) | publica pacotes no GitHub Packages a partir da tag | - | não (usa `GITHUB_TOKEN`) |

Prefira o App ao `BOT_TOKEN` (um PAT) no `promote` e no `tag-release`: o PAT é de uma pessoa e vence. Os checks de `promotion-check` e `backmerge-gate` entram no ruleset da `main` pelos nomes da tabela. Os demais reutilizáveis têm uma página cada em `reference/workflows/`, por exemplo [`pr-police`](../reference/workflows/pr-police.md).

## O que é específico do Brabo {#especifico-do-brabo}

Não copie sem pensar: o portão do QA (`qa-e2e-gatilho`, que presume o repo `brabo-qa`, as imagens `brabo-*` e os checks "E2E do brabo-qa" e "Regressivo do brabo-qa"), o `dependencias-de-merge` (os 11 repos e a sintaxe `Depende-de`) e o `contracts-alinhado` (os pacotes `@viralabs-dev/brabo-*`) são padrões do Brabo, não receitas genéricas. Leia [usar em outra org](../explanation/usar-em-outra-org.md) para a lista completa.

## Em outra org ou num fork {#outra-org}

Sem fork, o kit mínimo já roda em qualquer org: o brabo-ci é público e o `uses: viralabs-dev/brabo-ci/...` não pede token. Só o `ci_ref` é seu. O `owner:` do token do App e o escopo do npm vêm de `github.repository_owner`, então valem para o dono de quem chama. Num **fork**, aponte o `uses:` para o fork e passe `ci_repo: seu-dono/seu-fork` no `with:`, junto do `ci_ref`. O repositório-exemplo está num usuário (`daneiel`), fora da `viralabs-dev`, e roda sem mudar nada além do SHA.

## Solução de problemas {#problemas}

Os códigos do `pr-police` e do `backmerge-gate` (`NOME-FORA-DO-FORMATO`, `DESTINO-INVALIDO`, `ORIGEM-CONTAMINADA` e os demais) estão em [códigos de violação](../reference/codigos-de-violacao.md), com o conserto de cada um. Os que a adoção costuma encontrar:

| Sintoma | Causa | Correção |
|---|---|---|
| `escada` reprova: "a variável de repositório `OWNER_HANDLE` não está definida" (medido no exemplo) | falta o passo 2 | `gh variable set OWNER_HANDLE --body seu-login`, e reexecute o workflow |
| `pr-police` reprova com `NOME-FORA-DO-FORMATO` ou `FUNCAO-DESCONHECIDA` | a branch não é `funcao/descritivo` com função da lista | [renomeie a branch](../reference/codigos-de-violacao.md#nome-fora-do-formato) |
| `DESTINO-INVALIDO` | a PR mira a branch errada | `gh pr edit <n> --base dev` |
| a run fica em `action_required` | PR de fork de quem nunca contribuiu: o GitHub espera um mantenedor aprovar a execução | aprove a run na aba da PR |
| o workflow `politica` nunca roda | o arquivo está só numa branch que não é a base da PR, ou o gatilho foi trocado para `pull_request_target` | `pull_request` e o `politica.yml` já na `dev` ([lição 1](../explanation/licoes-do-ci.md#pull-request-x-target)) |
| a PR de promoção ou a tag não dispara outros workflows | foi criada com o `GITHUB_TOKEN` ([lição 3](../explanation/licoes-do-ci.md#github-token-nao-dispara)) | configure o App |
| aviso "'trabalho' not found" | a label não existia | o `pr-police` a cria sozinho; reexecute |
| o check está verde, mas a base da PR mudou | job com `if:` deixou o veredito velho colado ([lição 2](../explanation/licoes-do-ci.md#job-exigido-sem-if)) | tire o `if:` do job que chama |
| erro de `ci_ref` | não tem 40 caracteres ou difere do `uses:` | use o mesmo SHA completo nos dois |

## Provas {#provas}

- PR policiada: <https://github.com/daneiel/brabo-ci-exemplo/pull/1> (`pr-police` e `escada` verdes).
- Promoção e tag `v1.0.0`: ainda não provadas no exemplo (pedem o App).
