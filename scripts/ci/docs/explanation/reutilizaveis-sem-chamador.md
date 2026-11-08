# Reutilizáveis sem chamador (AT-819)

Nenhum dos 11 repos chamava estes seis em `origin/dev` (conferido em 08/11/2026). Nada foi apagado: cada um tem destino e motivo. "Biblioteca para adoção" quer dizer que o reutilizável é suportado e testado aqui, para quem adotar a política do brabo-ci fora do Brabo (EP-034) ou quando um repo passar a precisar dele.

| Reutilizável | Destino | Motivo |
|---|---|---|
| `dependencias-de-merge.yml` | a ligar (o brabo-ci já chama; os outros 10 entram pelo repin) | Decidido na AT-787: o check é exigido em `dev` e `main`. Falta o `checks: write` no App e as provas; só então o chamador entra e o required liga. Os scripts e a rede de hora em hora (`dependencias-de-merge-rede.yml`) já usam o código. |
| `promote.yml` | biblioteca para adoção | Abre a PR de promoção `dev->main`, que hoje o dono abre à mão ou por script local. Ao abrir `dev->main`, escreve o `Depende-de` das promoções abertas das camadas de baixo (AT-788). Sem plano de repo e sem efeito seguro de ligar sem a decisão do dono. |
| `archive-merged-branch.yml` | biblioteca para adoção | Rotina semanal da AT-661 (segunda, `0 12 * * 1`), que rodava no monorepo. Nenhum repo separado a agendou ainda; arquivar branch é efeito destrutivo no remoto e pede escolha do repo e do dono. |
| `backmerge-gate.yml` | biblioteca para adoção | Trava de retropropagação depois de hotfix. Só faz sentido onde há `hotfix/`; a nota não nomeia o repo. |
| `promotion-check.yml` | biblioteca para adoção | Estado da PR de promoção. Só vale como check da `main` e depende de `promote`/carimbo; sem chamador ele não bloqueia nada. |
| `dependabot-para-dev.yml` | biblioteca para adoção | Redireciona PR de segurança do Dependabot para a `dev`. Os repos hoje tratam isso pela política de PR e pelo `dependabot.yml`; ligar muda o fluxo de segurança. |

`claude.yml` e `claude-code-review.yml` já foram aposentados (AT-821, ci#35). Aposentar de fato (apagar) um destes seis exige tirar a linha desta tabela no mesmo PR.
