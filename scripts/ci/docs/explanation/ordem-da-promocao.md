---
id: ordem-da-promocao
title: Ordem da promoção
sidebar_label: Ordem da promoção
---

# Ordem da promoção

Quem promove os repos (`dev` → `main`) segue esta ordem; cada camada espera a de baixo, porque a `main` do consumidor usa o artefato **final** do produtor (ADR 0284).

| Camada | Repos | Espera por quê |
|---|---|---|
| 0 | `brabo-ci` | os outros pinam o brabo-ci, e a `main` só aceita versão final |
| 1 | `brabo-contracts`, `brabo-workspace` | api, web, runner, broker e qa usam o pacote final do contracts |
| 2 | `brabo-api`, `brabo-engine`, `brabo-web`, `brabo-runner`, `brabo-broker` | o portão da `main` exige a tag final de cada componente |
| 3 | `brabo-infra` | o compose usa os componentes |
| 4 | `brabo-qa` | o E2E roda as imagens dos componentes e do infra |
| 5 | `brabo` | o `componentes.json` pina as finais |

O check `Dependências de merge` aplica a ordem sozinho, sem linha no corpo (e a abertura pelo `promote.yml` também escreve `Depende-de`). Se ele diz `esperando viralabs-dev/brabo-ci#45`, promova essa PR primeiro; ao mergeá-la, o check da sua fica verde em instantes. Se diz `esperando promoção de viralabs-dev/<repo> (a dev está à frente da main)`, abra e promova a PR `dev → main` desse repo.
