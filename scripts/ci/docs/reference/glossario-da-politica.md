---
id: glossario-da-politica
title: Glossário da política
sidebar_label: Glossário da política
sidebar_position: 2
description: Os termos próprios da política de branches do brabo-ci (esteira, degrau, família, trava, carimbo, retropropagação, promoção, contaminação), cada um em uma frase.
keywords: [glossário, esteira, degrau, trava, carimbo, retropropagação, promoção, contaminação]
---

# Glossário da política {#glossario-da-politica}

**Para quem é:** quem lê a política de branches pela primeira vez e esbarra em palavras que parecem jargão.

**Depois de ler, você consegue:** entender cada termo que o `pr-police` e o `backmerge-gate` imprimem. Para ver os termos em ação, leia a [política em 10 minutos](../explanation/politica-em-10-minutos.md).

> **Atenção com "gate".** Neste glossário "gate" (trava, portão) é o **portão de retropropagação**: um check do CI. No glossário do produto Brabo, "gate" é o portão do agente. São coisas diferentes.

| termo | o que é |
|---|---|
| **permanente** | uma das branches que nunca morrem, `dev` e `main`. Cada uma é um ambiente. |
| **esteira** (ou **escada**) | a ordem das permanentes por onde o código sobe: `dev → main`. |
| **degrau** | uma posição da esteira. A promoção sobe um degrau por vez. |
| **função** | a palavra antes da barra no nome da branch (`feature`, `bugfix`, `hotfix`...). Ela decide a origem, o destino e a versão. |
| **família** | o tipo da PR segundo o `pr-police`: `trabalho`, `promocao`, `retropropagacao` ou `correcao-alta` (o hotfix). |
| **promoção** | a PR que leva o que está num degrau ao degrau de cima (`dev → main`). |
| **retropropagação** | a PR que leva o que está num degrau de cima de volta ao de baixo (`main → dev`), para que um hotfix não se perca. |
| **hotfix** | a correção urgente que nasce de `main` e vai direto para produção, sem esperar a esteira. |
| **trava** (ou **gate**, **portão**) | o estado que impede PRs de entrar numa branch enquanto a retropropagação de um hotfix não desceu. Mora em `.release/gate.json`. |
| **destravar** | fechar a trava: a retropropagação foi mergeada. |
| **carimbo** | a marca que um degrau recebe quando é promovido: a tag da versão (e, na `dev`, a tag `-dev.N`) com a URL da run que a gerou. O check de promoção confere que o degrau de baixo foi carimbado. |
| **contaminação** | uma branch que contém commits de um degrau acima daquele de onde deveria ter nascido. Reprova em `ORIGEM-CONTAMINADA`. |
| **escada de aprovação** | quantas aprovações cada destino exige (`approval-ladder`). Depende do modo `solo` ou `community`. |
| **marcador de quebra** | o `!` no assunto do commit ou `BREAKING CHANGE:` no corpo. |
| **ci_ref** | o SHA do brabo-ci que um workflow reutilizável usa para buscar os scripts. É igual ao SHA do `uses:`. |

Os códigos de reprovação estão em [Códigos de violação](codigos-de-violacao.md).
