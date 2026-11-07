# Changelog

## Unreleased

- `dependencias-de-merge.yml` (reutilizável), `dependencias-de-merge-rede.yml` (cron de hora em hora, só roda a partir da `main`) e `scripts/ci/dependencias-de-merge.ts` novos: a PR declara `Depende-de: viralabs-dev/<repo>#<n>` e o check `Dependências de merge` (check-run do App) fica amarelo `in_progress` "esperando ..." até todas estarem MERGED; reprova owner/repo fora da lista dos 11, linha malformada, autorreferência, PR inexistente, fechada sem merge e ciclo até a profundidade 5; nunca `neutral`. O merge de uma PR atualiza o check das dependentes nos outros repos. Spec com mutações provadas. O template de PR ganhou o campo opcional `Depende-de:` (AT-787).

- `qa-e2e-gatilho.yml`: o job `disparar` instala as dependências dos scripts antes de rodar; desde a AT-769 ele importa a seleção de funcionalidades (picomatch, yaml) e quebrava com `ERR_MODULE_NOT_FOUND` em toda PR para a `main`. Guarda nova `workflows-dependencias.spec.ts`: job que roda script com pacote npm sem instalar reprova (AT-785).

- `politica.yml` do próprio repo repina `pr-police` e `escada` de `b030fbf` para `13f3697` (`ubuntu-26.04`, rótulo de família criado antes de aplicar); a PR deixa de sair com a anotação `exit code 1` e o aviso do `ubuntu-latest` (AT-783).

- `CONTRIBUTING.md`: as seções Testes, Documentação e Definition of Done descrevem o repo separado (Vitest, README/CLAUDE/CHANGELOG, ADRs no `brabo`), não mais o monorepo (AT-783).
- O `politica.yml` do próprio brabo-ci repina o pr-police e a escada em `64a1e15` (merge da ci#19); ficara em `b030fbf` no repin da AT-772, e por isso as PRs do brabo-ci ainda mostravam a nota do `ubuntu-latest` e o `exit code 1` do rótulo de família.

- `refs-com-simbolo.yml` (reutilizável) e `scripts/ci/refs-com-simbolo.ts` novos: cada irmão reprova a ref de RN `caminho:N` (`símbolo`) interna quebrada no PR que a quebra; a ref entre irmãos só é listada no Summary. `--escrever` reancora e o artefato `refs-patch` leva o diff e a receita de `git apply`. Núcleo copiado do `brabo@120fa8c2`; spec com fixture real do brabo-web e mutações (AT-782).
- `pr-police`: a etapa da label de família só remove as famílias que o PR já tem; `--remove-label` de rótulo inexistente no repo (`'promocao' not found`) abortava o `gh` e deixava a anotação `exit code 1` em todo PR (AT-772).
- Vínculos na origem, só `.ts` (AT-773, Rodada A): `montarPayload` ganha `origem` opcional `{repo, pr, sha, sha_curto, ator, run_id, run_attempt, run_url, correlacao}` (`correlacao` = `<run_id>-<attempt>`); `qa-e2e-vinculos.ts` acha o run do `e2e-pr` pelo `c=<correlacao>` no `display_title` (5 s, até 60 s) e o `qa-e2e-disparar.ts` escreve o Vínculos no Summary do run de origem (sem achar, fica o link do check; nunca reprova); `montarCheck` ganha `vinculos?` (a tabela entra no texto do check); a mensagem da tag anotada ganha `Carimbo: <url do run>` (`comCarimbo` em `tag-release.ts`). Nenhum YAML mudou: o `run-name` e o `PR_AUTOR` ficam para a Rodada B. O modo `main` do portão da AT-765 segue igual.
- `pr-police`: a etapa "Aplicar a label de família" cria o rótulo antes de aplicá-lo; antes saía com 1 (`'trabalho' not found`) escondido por `continue-on-error`, e o PR nunca recebia a label (AT-772).

- CI: todo `runs-on` fixa `ubuntu-26.04` no lugar de `ubuntu-latest`, e o `create-github-app-token` usa `client-id` no lugar do `app-id` obsoleto; os runs saem sem anotação de aviso (AT-772).

- `.github/actions/vinculos` (action composta) e `scripts/ci/vinculos.ts` novos: escrevem `## Vínculos` (origem, irmãos `repo@SHA`, destino e runs disparados) e um diagrama Mermaid no Summary do run, mais `vinculos.md`. Entrada validada por regex, nunca reprova o job, usa o node do runner (≥ 22.18). Spec com fixtures e git temporário (AT-773).
- `publish-npm.yml` novo (reutilizável): `pnpm pack`, `actions/attest` sobre o `.tgz` e `npm publish` desse mesmo arquivo em `npm.pkg.github.com`, dist-tag `dev` para `-dev.N` e `latest` para a final; `scripts/ci/publish-npm.ts` calcula versão e dist-tag. RN-1037 (AT-770).
- `contracts-alinhado.yml` e `scripts/ci/contracts-alinhado.ts` novos: versão do brabo-contracts igual no `package.json`, no lock e nas constantes dos scripts; aviso contra o `componentes.json`. RN-1038 (AT-770).
- `scripts/ci/subir-contracts.sh` novo: sobe a versão do contracts num consumidor e recusa o lock que mudou fora das entradas `@viralabs-dev/brabo-*` (AT-770).
- `qa-e2e-gatilho.yml` ganha o job `regressivo-dev` (PR com base `dev`): `qa-regressivo-selecao.ts` tira `{modo, funcionalidades, semDono}` dos arquivos tocados e do catálogo `funcionalidades.yml` do brabo-qa; `qa-e2e-imagens.ts` usa a imagem `sha-<12>` do head (`baseRef: 'dev'`); `qa-e2e-resumo.ts` monta a tabela por funcionalidade ("sem cobertura" não reprova) e o nome do check por modo (`Regressivo do brabo-qa` na dev, `E2E do brabo-qa` na main). O check da dev nunca é exigido, e `regressivo-nao-exigido.spec.ts` falha se o repo o citar como exigido. O portão da `main` não muda (AT-769).
- Ko-fi do mantenedor: seção Apoie no README (AT-768).

- `qa-e2e-gatilho.yml` novo (reutilizável) e scripts `qa-e2e-imagens`, `qa-e2e-aceite`, `qa-e2e-resumo`, `qa-e2e-disparar` e `qa-e2e-aceitar`: o check `E2E do brabo-qa` vira portão da `main`. Escolhe as tags das imagens, dispara o `e2e-pr` no brabo-qa e aceita falha de `spec` ou `ambiente` com `/qa-aceitar <justificativa>` (AT-765).
- Docs: `README.md`, `CONTRIBUTING.md`, `GOVERNANCE.md`, `SECURITY.md`, `SUPPORT.md`, `CODE_OF_CONDUCT.md` e `.github/pull_request_template.md` voltam ao pt-BR, que passa a ser o padrão da documentação de repo público (decisão do dono de 06/11/2026, revertendo o ADR 0260; AT-766). Nenhum workflow ou script lê esses arquivos.
- Docs: os links para `docs/...` do monorepo antigo apontam para onde a doc mora hoje: `viralabs-dev/brabo` (ADRs, `getting-started`, `.docmap.yml`, `business-rules`, `branching-policy` em `scripts/ci/docs/explanation/`), `viralabs-dev/brabo-infra` (runbook, `deploy/docs/runbook.md`) e `viralabs-dev/brabo-api` (`security-surface.md`). O Setup do CONTRIBUTING clona pelo `brabo-workspace` (AT-766).
- README: seção "Repositórios do Brabo", com o papel, o "depende de" e o "é usado por" de cada repo (AT-766).
- Templates de issue: os links do runbook (`question.yml`, `bug_report.yml`) apontam para `viralabs-dev/brabo-infra` (`deploy/docs/runbook.md`), sem âncora: o GitHub ignora o `{#id}` e o slug muda com a tradução do título; o `bug_report.yml` cita a seção "Ambiente de inferência" pelo nome. O `feature_request.yml` usa a âncora `#o-que-provavelmente-não-aceito` do CONTRIBUTING em pt-BR.

- `politica.yml` novo: `pr-police` e `escada` do `brabo-ci` pinados por SHA (AT-733); inclui a dispensa da PR do bot (ADR 0255).
- `approval-ladder`: a PR do GitHub App `viralabs-dev-brabo` na branch fixa `chore/regenera-gerados`, mirando `dev`, dispensa a escada (ADR 0255) — autor E branch, como o Dependabot; na `main`, em outra branch ou com humano, a escada segue inteira.
- `version.ts`: repositório sem tag final carimba `v1.0.0` na primeira vez, qualquer que seja a função da branch (antes partia de 0.0.0); com tag, nada muda.
- `tag-release.yml` (reutilizável) aceita os secrets `APP_ID` e `APP_PRIVATE_KEY` e gera o token do GitHub App dentro do próprio job (output de job com token é descartado pelo Actions, medido); `BOT_TOKEN` segue valendo.
- O próprio `brabo-ci` carimba as suas tags chamando `./.github/workflows/tag-release.yml` (`tag.yml`).

## v1.0.0 - 2026-11-04

Primeira versão, extraída do monorepo `daneiel/brabo` (EP-033, AT-695, ADR 0252) com o histórico dos caminhos.

- Workflows reutilizáveis (`workflow_call`): `pr-police`, `approval-ladder`, `archive-merged-branch`, `backmerge-gate`, `promote`, `promotion-check`, `dependabot-para-dev`, `tag-release`, `claude` e `claude-code-review`.
- Scripts da política em `scripts/ci/` (`pr-police`, `approval-ladder`, `version`, `gate`, `promote`, `promotion-check`, `archive-branch`, `tag-release`, `dependabot-*`, `actions-pinadas`), com vitest.
- Modelos de comunidade: `ISSUE_TEMPLATE`, `pull_request_template.md`, `CODE_OF_CONDUCT`, `CONTRIBUTING`, `GOVERNANCE`, `SECURITY`, `SUPPORT`, `CODEOWNERS`, `FUNDING`.
- CI próprio (`ci.yml`) e `dependabot.yml`.
- Lacuna declarada: o nome do GitHub App da organização e do secret do token ainda não existem; os workflows recebem o token como `secrets.BOT_TOKEN` (opcional) de quem chama.
