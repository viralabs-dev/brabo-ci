---
id: codigos-de-violacao
title: Códigos de violação
sidebar_label: Códigos de violação
sidebar_position: 1
description: Os 8 códigos que o pr-police imprime e os 5 motivos do backmerge-gate, cada um com o que significa, um exemplo e o conserto.
keywords: [pr-police, backmerge-gate, violação, reprovação, conserto, branch]
---

# Códigos de violação {#codigos-de-violacao}

**Para quem é:** quem recebeu uma reprovação do `pr-police` ou do `backmerge-gate` e abriu o link do log para entender o que fazer.

**Depois de ler, você consegue:** achar o código que o log mostrou, entender a regra que ele protege e rodar o comando que o conserta. Se a política for novidade, comece pela [política em 10 minutos](../explanation/politica-em-10-minutos.md). Os termos estão no [glossário](glossario-da-politica.md).

O `pr-police` mostra `[CODIGO]`, a regra, o porquê e o conserto. O `backmerge-gate` mostra o motivo e o detalhe. Esta página é o mesmo conteúdo com um exemplo de cada. Uma PR reprovada pelo `pr-police` pode ter mais de um código (por exemplo, `DESTINO-INVALIDO` e `ORIGEM-CONTAMINADA` juntos); conserte um a um.

## `pr-police`: o nome, o destino e a origem da branch

### NOME-FORA-DO-FORMATO {#nome-fora-do-formato}

**O que significa:** o nome da branch não casa com `funcao/descritivo` (`^.{0,30}/\S{0,32}$`): falta a barra, ou um lado passou do limite.
**Por que existe:** a função antes da barra decide destino, aprovadores e o impacto na versão. Sem ela, nada disso é calculável.
**Exemplo:** `login-por-sso` (sem função).
**Conserto:**
```bash
git branch -m login-por-sso feature/login-por-sso
git push origin -u feature/login-por-sso
```

### DESCRITIVO-VAZIO {#descritivo-vazio}

**O que significa:** há função e barra, mas nada depois da barra.
**Por que existe:** o descritivo identifica a branch numa lista de trinta; `feature/` sozinho não diz nada a ninguém.
**Exemplo:** `feature/`.
**Conserto:** `git branch -m feature/ feature/o-que-voce-esta-fazendo`.

### FUNCAO-DESCONHECIDA {#funcao-desconhecida}

**O que significa:** a função não está na lista fechada: `breaking`, `feature`, `bugfix`, `perf`, `refactor`, `chore`, `docs`, `test` e `hotfix`.
**Por que existe:** a função alimenta o cálculo de versão. Fora da tabela, a mudança sairia como PATCH em silêncio. Branch `dependabot/…` de uma pessoa também cai aqui: só o próprio Dependabot usa esse prefixo.
**Exemplo:** `fix/login` ou `feat/login`.
**Conserto:** `git branch -m fix/login bugfix/login`.

### DESTINO-INVALIDO {#destino-invalido}

**O que significa:** a PR mira a branch errada. `hotfix/` volta para `main`; todas as outras funções voltam para `dev`; uma branch permanente só mira outra permanente, e nunca ela mesma.
**Por que existe:** código sobe um degrau por vez. Mirar `main` direto pularia a verificação do degrau do meio.
**Exemplo:** `feature/login` aberta contra `main`.
**Conserto:** `gh pr edit <n> --base dev`. Para levar o que está em `dev` até `main`, a promoção é uma PR entre as permanentes, depois da sua ser mergeada.

### PROMOCAO-NAO-ADJACENTE {#promocao-nao-adjacente}

**O que significa:** uma PR entre permanentes pula um degrau. Com a escada atual, de dois degraus (`dev` e `main`), a regra só reprova se a escada voltar a ter degraus intermediários.
**Por que existe:** cada degrau é um ambiente com sua verificação. Pular promove código que nunca rodou no degrau de baixo.
**Exemplo:** numa escada `dev → qa → main`, uma PR `dev → main`.
**Conserto:** faça em etapas, `dev → qa` e depois `qa → main`, e mude a base com `gh pr edit <n> --base <proximo-degrau>`.

### ORIGEM-CONTAMINADA {#origem-contaminada}

**O que significa:** a branch contém commits que só existem em degraus acima daquele de onde ela deveria ter nascido. Hoje isso vale para o `hotfix/`, que deve nascer de `main`.
**Por que existe:** um hotfix vai direto para produção. Se nasceu de `dev`, o merge leva junto tudo o que ainda está em desenvolvimento, e um deploy de emergência vira um release inteiro sem revisão.
**Exemplo:** `hotfix/corrige-login` criada com `git checkout -b hotfix/corrige-login dev`.
**Conserto:**
```bash
git fetch origin main
git checkout -b hotfix/corrige-login-limpa origin/main
git cherry-pick <sha-do-conserto>   # só o conserto
git push origin -u hotfix/corrige-login-limpa
```

### QUEBRA-SEM-MARCADOR {#quebra-sem-marcador}

**O que significa:** a branch é `breaking/`, mas nenhum commit entre a base e o head marca a quebra.
**Por que existe:** a função da branch sobe a versão para MAJOR, mas quem gera o CHANGELOG lê o commit. Sem o marcador, a versão salta e o changelog não diz o que quebrou.
**Exemplo:** `breaking/remove-keycloak` com commits `feat: remove o keycloak`.
**Conserto:** marque a quebra no assunto, `feat(auth)!: remove o keycloak`, ou no corpo do commit:
```text
BREAKING CHANGE: o que quebrou e o que fazer a respeito
```

### MARCADOR-SEM-BREAKING {#marcador-sem-breaking}

**O que significa:** um commit marca quebra (`!` ou `BREAKING CHANGE:`), mas a função da branch não é `breaking/`.
**Por que existe:** é o inverso do anterior e pior: o changelog anuncia a quebra e a versão sai PATCH ou MINOR. Quem atualizar confiando no número quebra sem aviso.
**Exemplo:** `feature/novo-contrato` com um commit `feat!: troca o contrato`.
**Conserto:** `git branch -m feature/novo-contrato breaking/novo-contrato`. Se a mudança não quebra nada, tire o marcador do commit.

## `backmerge-gate`: a trava depois de um hotfix

O gate responde "esta PR pode entrar agora?". Dois motivos aprovam e três reprovam. Contexto: [O portão de retropropagação](../explanation/branching-policy.md#the-back-merge-gate).

### GATE-LIMPO {#gate-limpo}

**O que significa:** nenhuma branch está travada. Aprovado.
**O que fazer:** nada.

### RETROPROPAGACAO-DA-VEZ {#retropropagacao-da-vez}

**O que significa:** a PR é de `main` para a branch que é a próxima na ordem de destrava. Aprovado.
**O que fazer:** mergear. Ao mergear, a branch sai da trava; se sobrar outra, a próxima vem depois.

### FORA-DE-ORDEM {#fora-de-ordem}

**O que significa:** é uma retropropagação de `main` para uma branch travada, mas existe outra mais acima na ordem que ainda não foi destravada.
**Por que existe:** mergear `main` num degrau de baixo antes do de cima deixa o degrau do meio sem a correção, que é o buraco que o gate fecha. Hoje, com duas permanentes, a ordem tem um degrau só.
**Conserto:** mergear primeiro a PR indicada na mensagem; esta passa em seguida.

### DESTINO-NAO-TRAVADO {#destino-nao-travado}

**O que significa:** a PR é uma retropropagação, mas a branch de destino não está travada. Aprovado.
**O que fazer:** nada; a retropropagação é inofensiva.

### DESTINO-TRAVADO {#destino-travado}

**O que significa:** a PR mira uma branch que está travada, aguardando a retropropagação de um hotfix, e não é ela mesma a retropropagação.
**Por que existe:** deixar trabalho novo entrar agora faria o próximo release desfazer a correção, em silêncio.
**Exemplo:** depois do hotfix `v1.2.1`, uma `feature/x` mira `dev`.
**Conserto:** resolva a PR de retropropagação (`main → dev`) que a mensagem aponta. A sua passa a liberar sozinha, sem mudar nada nela.
