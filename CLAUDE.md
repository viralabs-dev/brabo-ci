# brabo-ci

Workflows reutilizáveis (`workflow_call`) e a lógica de política em `scripts/ci/`: PR, escada, promoção, carimbo de tag, arquivamento e Dependabot.

> Partido do `CLAUDE.md` do monorepo `daneiel/brabo` (hoje `brabo-legacy`, `dev` @ `1586158973`) na AT-708 (EP-033, ADR 0252). Copiado, não resumido: o que era de outro repo foi cortado e os caminhos do monorepo viraram a raiz deste repo (ou `brabo-<x>:caminho`). Caminhos sem prefixo que não existem aqui (`docker/`, `deploy/`, `install.sh`, `e2e/`, `scripts/dev/`, `scripts/ci/` fora do `brabo-ci`) moram no `brabo-infra`, no `brabo-qa` ou no `brabo-ci`. O resto das regras mora no `CLAUDE.md` da pasta-mãe (`brabo-workspace`, clonado em `~/dev/brabo/CLAUDE.md`) e no de cada repo irmão.

## Stack (decidida — não proponha alternativas)
- `brabo-ci`: workflows reutilizáveis (`on: workflow_call`) em `.github/workflows/`, lógica em `scripts/ci/` (TypeScript pelo Node por type stripping, vitest). Cada reutilizável faz um segundo checkout em `.brabo-ci/` pelo input `ci_ref` (o mesmo SHA do `uses:`); os gatilhos ficam no repo que chama. Pine sempre por SHA com `# vX`.

## Repositório, branches e PR (vale para todo repo `brabo-*`)
- Branches permanentes: dev, main — um branch, um ambiente; a esteira é
  `dev → main`. A `qa` foi APOSENTADA por hora (ADR 0235, só no repositório do
  Brabo; arquivada em `refs/archive/qa`, segue em `PROTECTED_BRANCHES` do
  produto e em `NUNCA_ARQUIVAR`). `rc` saiu
  da política (ADR 0030) e o bootstrap parou de criá-la, mas continua em
  `PROTECTED_BRANCHES` DE PROPÓSITO: a lista decide o que a trava de merge
  RECUSA, e repositórios bootstrapados por versões anteriores ainda têm a
  branch. Proteger uma branch que não existe não custa nada; desproteger
  uma que existe custa caro. Não "limpe" essa lista.
  Trabalho nasce de dev com a taxonomia da política (breaking/,
  feature/, bugfix/, perf/, refactor/, chore/, docs/, test/);
  hotfix/ nasce de main. Os AGENTES seguem a mesma régua desde a RN-664: o
  worktree do dev agent nasce de `dev`, a PR dele e a de ADR miram `dev`, e o
  gate julga o diff contra `dev` — os três juntos, nunca um só (o gate
  julgaria um diff que não é o da PR); repositório sem `dev` falha nomeado,
  sem queda para a default. A PR de INFRA (`open_infra_pr`) segue a
  mesma régua desde a RN-729: `feature/infra-setup` nasce de `dev`, mira `dev`
  e leva o autor `infra[bot]`. Formato funcao/descritivo,
  regex ^.{0,30}/\S{0,32}$. EXCEÇÃO nomeada: `dependabot/…` é branch
  PERMITIDA sem critério de caracteres (sem limite de tamanho, qualquer número
  de barras), mas só quando o AUTOR é o próprio Dependabot
  (`ehBranchDoDependabot` em `scripts/ci/pr-police.ts`) — humano com esse
  prefixo reprova em `FUNCAO-DESCONHECIDA`, senão o prefixo vira a porta para
  escapar do formato. Commits em conventional commits, pt-BR.
  A FUNÇÃO da branch decide a VERSÃO (scripts/ci/version.ts): breaking/
  sobe MAJOR, feature/ sobe MINOR, todo o resto é PATCH. Mudança que
  exige ação do operador antes do deploy nasce em breaking/ mesmo quando
  o conteúdo é correção — o v2.5.1 saiu patch porque a chave obrigatória
  do OAuth nasceu em bugfix/, e um patch diz "atualize sem pensar".
  Versão não se corrige à mão depois: o valor de ela ser calculada vem de
  não ser negociada caso a caso.
- Toda mudança entra por PR — push direto em permanente é bloqueado;
  únicas exceções de push: tags (bot de release) e .release/gate.json
  (bot do gate).
- Toda branch cujo PR é mergeado é ARQUIVADA automaticamente, SEM carência, por checagem
  SEMANAL (segunda 09:00 de Brasília, AT-661) (`.github/workflows/archive-merged-branch.yml`,
  AT-557): sem PR aberta e sem commit depois do merge; branch sem PR mergeada
  não é tocada — move de
  `refs/heads/<nome>` para `refs/archive/<nome>`, nunca apaga: histórico
  intacto, recuperável com um `git push` de volta. Exceções: dev/qa/main
  (aparecem como `head` de todo PR de promoção), `gh-pages` (deploy do
  site, não é branch de feature) e branch de fork. A política mora em
  `scripts/ci/archive-branch.ts` (testado), ver
  scripts/ci/docs/explanation/branching-policy.md, seção "Merged branches get
  archived".
- PR do Dependabot entra pela `dev`, nunca direto na `main`; na `dev` ele não espera aprovação humana (ADR 0236) e a `main` segue com a escada inteira. Dependência de linguagem só por segurança (`open-pull-requests-limit: 0`), `github-actions` e `docker` semanais, `target-branch: dev`. O `dependabot-para-dev.yml` do `brabo-ci` fecha ou redireciona o PR de segurança que o GitHub abre contra a `main`.
- Merge em branch protegida (`dev`/`main`) é SEMPRE manual do usuário, sem opção de automatizar. A política de PR, escada, promoção e carimbo de tag vem dos workflows reutilizáveis do `brabo-ci`, fixados por SHA com `# vX` no `uses:`. Imagem de terceiro por digest com a tag inline. Segredo nunca é impresso; teste nunca roda contra o Postgres da instalação.
- PR que toca uma funcionalidade do catálogo (`brabo-qa/funcionalidades.yml`, mapa por caminho) ajusta o regressivo dela no `brabo-qa` contra a `dev`, ou diz no card por que não precisa. Na PR para a `dev` o check `Regressivo do brabo-qa` só atesta (nunca obrigatório); na PR para a `main` o `E2E do brabo-qa` roda o catálogo inteiro e bloqueia, salvo `/qa-aceitar` (AT-769). A seleção mora em `scripts/ci/qa-regressivo-selecao.ts` (testado).

## Convenções (repositório, dados e domínio)
- Branches permanentes: dev, main — um branch, um ambiente; a esteira é
  `dev → main`. A `qa` foi APOSENTADA por hora (ADR 0235, só no repositório do
  Brabo; arquivada em `refs/archive/qa`, segue em `PROTECTED_BRANCHES` do
  produto e em `NUNCA_ARQUIVAR`). `rc` saiu
  da política (ADR 0030) e o bootstrap parou de criá-la, mas continua em
  `PROTECTED_BRANCHES` DE PROPÓSITO: a lista decide o que a trava de merge
  RECUSA, e repositórios bootstrapados por versões anteriores ainda têm a
  branch. Proteger uma branch que não existe não custa nada; desproteger
  uma que existe custa caro. Não "limpe" essa lista.
  Trabalho nasce de dev com a taxonomia da política (breaking/,
  feature/, bugfix/, perf/, refactor/, chore/, docs/, test/);
  hotfix/ nasce de main. Os AGENTES seguem a mesma régua desde a RN-664: o
  worktree do dev agent nasce de `dev`, a PR dele e a de ADR miram `dev`, e o
  gate julga o diff contra `dev` — os três juntos, nunca um só (o gate
  julgaria um diff que não é o da PR); repositório sem `dev` falha nomeado,
  sem queda para a default. A PR de INFRA (`open_infra_pr`) segue a
  mesma régua desde a RN-729: `feature/infra-setup` nasce de `dev`, mira `dev`
  e leva o autor `infra[bot]`. Formato funcao/descritivo,
  regex ^.{0,30}/\S{0,32}$. EXCEÇÃO nomeada: `dependabot/…` é branch
  PERMITIDA sem critério de caracteres (sem limite de tamanho, qualquer número
  de barras), mas só quando o AUTOR é o próprio Dependabot
  (`ehBranchDoDependabot` em `scripts/ci/pr-police.ts`) — humano com esse
  prefixo reprova em `FUNCAO-DESCONHECIDA`, senão o prefixo vira a porta para
  escapar do formato. Commits em conventional commits, pt-BR.
  A FUNÇÃO da branch decide a VERSÃO (scripts/ci/version.ts): breaking/
  sobe MAJOR, feature/ sobe MINOR, todo o resto é PATCH. Mudança que
  exige ação do operador antes do deploy nasce em breaking/ mesmo quando
  o conteúdo é correção — o v2.5.1 saiu patch porque a chave obrigatória
  do OAuth nasceu em bugfix/, e um patch diz "atualize sem pensar".
  Versão não se corrige à mão depois: o valor de ela ser calculada vem de
  não ser negociada caso a caso.
- Toda mudança entra por PR — push direto em permanente é bloqueado;
  únicas exceções de push: tags (bot de release) e .release/gate.json
  (bot do gate).
- PR do Dependabot entra pela `dev`, nunca direto na `main` — chega lá pela
  promoção, como o resto. Na `dev` ele NÃO espera aprovação humana: a escada o
  dispensa (ADR 0236, AT-668), reconhecido por autor E branch
  (`ehBranchDoDependabot`), e os outros checks são a revisão; a `main` segue
  com a escada inteira. `target-branch: dev` cobre atualização de VERSÃO;
  SECURITY update o GitHub abre sempre contra a branch default (`main`), e
  `.github/workflows/dependabot-para-dev.yml` FECHA o que a `dev` já corrige
  (versão resolvida >= primeira corrigida do ALERTA, nunca o "to" do PR, que é
  a mais nova e não a mínima) e REDIRECIONA o resto — na dúvida redireciona,
  nunca fecha. O gatilho que vale é `push` na `dev`: `pull_request_target` e
  `pull_request` não enxergam workflow que só existe na `dev`. Medido na 1ª
  execução: o `GITHUB_TOKEN` NÃO lê os alertas, então hoje a decisão compara com
  o destino do PR e o redundante é REDIRECIONADO, não fechado. Depois de
  redirecionar, os checks da `dev` só rodam com `@dependabot rebase` de quem
  tem escrita (evento do `GITHUB_TOKEN` não dispara workflow).
  PR do Dependabot que SÓ troca pin de action (SHA do `uses:` + comentário de
  versão, mesma action, mesma indentação) ganha `docs-not-needed:` escrito
  pelo BOT, num passo do job `Drift, gerados e build` antes do drift
  (`scripts/ci/dependabot-justifica-pin.ts`, AT-094) — autor E diff, as duas;
  qualquer outra linha e nada é escrito. NÃO mova isso para workflow irmão: o
  `GITHUB_TOKEN` não dispara `edited`, re-executar o job reusa o corpo ANTIGO
  do payload (medido, run 34898913072) e `pull_request_target` só roda o
  workflow da `main`. É por isso que o drift lê `PR_BODY_FILE` antes de
  `PR_BODY`. A linha do bot é marcada e sai sozinha se o diff deixar de ser
  pin; a de humano nunca é tocada.
- Toda branch cujo PR é mergeado é ARQUIVADA automaticamente, SEM carência, por checagem
  SEMANAL (segunda 09:00 de Brasília, AT-661) (`.github/workflows/archive-merged-branch.yml`,
  AT-557): sem PR aberta e sem commit depois do merge; branch sem PR mergeada
  não é tocada — move de
  `refs/heads/<nome>` para `refs/archive/<nome>`, nunca apaga: histórico
  intacto, recuperável com um `git push` de volta. Exceções: dev/qa/main
  (aparecem como `head` de todo PR de promoção), `gh-pages` (deploy do
  site, não é branch de feature) e branch de fork. A política mora em
  `scripts/ci/archive-branch.ts` (testado), ver
  scripts/ci/docs/explanation/branching-policy.md, seção "Merged branches get
  archived".

## Convenções (agentes, telas e testes)
- Commits de agentes usam identidade "<agente>[bot]" com o usuário
  como co-author.

## CI/CD e cadeia de suprimentos (regras)
- Vínculos no Summary (AT-773): `.github/actions/vinculos` + `scripts/ci/vinculos.ts` são o ÚNICO helper que escreve `## Vínculos` (tabela + Mermaid) e `vinculos.md`; repo nenhum copia essa lógica. Todo valor de fora passa por regex (repo `viralabs-dev/brabo*`, SHA de 40 hex, PR numérica, URL `https://github.com/viralabs-dev/`, ator, rótulo sem `|`/crase/`<>`/colchetes), nunca entra cru em Markdown ou Mermaid, e o helper NUNCA reprova o job (erro vira `::warning::`, saída 0). Roda no `node` do runner (≥ 22.18, sem `setup-node`); o `.ts` só usa sintaxe apagável. Mudou regex ou formato: ajuste `vinculos.spec.ts` e os `esperado-*.md`.
- Painel da mudança (AT-792, RN-1054 a RN-1056, ADR 0278): `.github/workflows/painel.yml` + `scripts/ci/painel.ts` compõem as runs de uma mudança (componente do `Depende-de`, PR de tag ou `prs=` à mão) numa tabela + Mermaid no Summary do `brabo-ci`. Funções puras (`componente`, `runsDaMudanca`, `montarPainel`, `terminou`) e CLI com ETag; volta de 60 s (5 min com rate limit baixo), quietude de 3 min, teto de 45 min. NUNCA reprova e NÃO publica check nas PRs (decisão do dono, 07/11/2026): o token do App é só `actions/pull-requests/contents: read`, e a volta é a linha "Painel da mudança" dos Vínculos (`linhaDoPainel`). O passo "Avisar o painel" do `dependencias-de-merge.yml` dispara por `repository_dispatch` com debounce (não dispara se há painel na fila ou em andamento com `<repo>#<n>` no título), com token restrito ao brabo-ci (`contents: write`). Detalhe em `docs/painel-da-mudanca.md`.
- Refs com símbolo no irmão (AT-782): `refs-com-simbolo.yml` + `scripts/ci/refs-com-simbolo.ts` (sem dependência) conferem as refs `caminho:N` (`símbolo`) das RNs do PRÓPRIO repo. O núcleo (`extrairRefs`, `conferir`, `veredito`, `novaLinha`, `reancorar`) é CÓPIA de `scripts/docs/refs-com-simbolo.mjs` do `brabo`, com o SHA de origem no cabeçalho: mudou lá (janela, padrão, distância), mude aqui. Interna = `apps/<eu>/…` ou 1º segmento na raiz do repo (`src/…` da api); `apps/<outro>/`, `packages/` e o resto são externas: só LISTADAS no Summary, sem `::warning::` nem reprovação. `--escrever` reancora o checkout e o workflow sobe o `refs-patch`. Check não obrigatório (só `pr-police` e `escada` são). Spec com fixture real do brabo-web e mutações; a tabela `PREFIXOS` copia o `fontes.yml` do brabo.
- Publicação do contracts no GitHub Packages (AT-770): `publish-npm.yml` publica o `.tgz` atestado por `actions/attest` (nunca `--provenance`, sem suporte fora do npmjs); versão vem da tag, `-dev.N` vai para o dist-tag `dev` e a final para `latest` (RN-1037). `contracts-alinhado.yml` exige uma versão só do contracts no `package.json`, no lock e nos scripts de download (RN-1038, não obrigatório). `scripts/ci/subir-contracts.sh <versão>` é o único jeito de subir a versão num consumidor: recusa o lock que mudou fora das entradas `@viralabs-dev/brabo-*`; nunca reescreva o lock inteiro.
- CI/CD de release: GitHub Actions com lógica em scripts testáveis
  (scripts/ci/, vitest). Todo `uses:` de terceiro é preso a COMMIT SHA, com
  a versão num comentário ao lado (`@<sha>  # v4`) — tag é ponteiro que o
  dono da action move sem aviso, e quem move executa código no runner que
  tem o checkout e os segredos daquele workflow. O comentário é obrigatório:
  é o que diz a um humano, e ao Dependabot, que versão é aquele hash.
  `scripts/ci/actions-pinadas.ts` reprova no job `lint` quem esquecer, e
  todo `curl` de binário passa por `sha256sum -c`. Desde o ADR 0159 essa
  regra tem uma IRMÃ, e o argumento é o mesmo palavra por palavra: toda
  IMAGEM de terceiro é presa por DIGEST, e o digest é o do ÍNDICE, nunca o de
  uma plataforma — pinar o manifesto de `linux/amd64` quebraria `linux-arm64`
  sem aviso. Desde o ADR 0178 (AT-139) a TAG mora DENTRO da referência, antes
  do digest — `neo4j:5.26-community@sha256:…`, e no Dockerfile
  `FROM node:26.10.0-alpine3.24@sha256:… AS deps` —, e NÃO num comentário, que
  era a forma do ADR 0159: o Dependabot não lê comentário em formato nenhum e
  atualiza pin só de digest para o digest da `latest`, com o comentário
  mentindo e o lint verde. Com os dois, o Docker puxa pelo digest. Comentário
  ao lado é PERMITIDO só se disser a MESMA tag (um token com dígito que
  diverge reprova), e em DOCKERFILE comentário no FIM da linha do `FROM`
  continua proibido: o parser do Docker só reconhece `#` no INÍCIO da linha,
  então `FROM x@sha256:… # tag` é um `FROM` com TRÊS argumentos e o build
  morre — aprendido errando, e o `hadolint` tinha passado (parser próprio;
  linter concordar não é build concordar). Vale nas TRÊS árvores onde imagem de terceiro entra: `docker/`
  (compose E `FROM` de Dockerfile), `deploy/k8s/` e `.github/workflows/` —
  esta última é `services:` de job, ou seja, o MESMO runner que a regra das
  actions protege, alcançado pela outra porta, e foi o lugar que o próprio
  levantamento do `BRB-004` não tinha visto. E desde o ADR 0197 (AT-246) os
  workflows NÃO têm literal de imagem nenhum: o `image:` dos `services:` é
  `${{ needs.imagens.outputs.<imagem> }}`, de um job `imagens` que chama o
  reutilizável `.github/workflows/imagens-do-compose.yml`, que lê o serviço do
  compose de DEV (`scripts/ci/imagens-do-compose.ts`, tabela
  `IMAGENS_DOS_WORKFLOWS`). Serviço novo de workflow entra por ESSE caminho —
  imagem no compose, linha na tabela, output no reutilizável (o spec reprova
  se divergirem) —, nunca com um literal. Job EXIGIDO que dependa de `imagens`
  leva `if: ${{ !cancelled() }}`, senão `imagens` vermelho o deixaria
  `skipped`, que conta como verde. `scripts/ci/imagens-pinadas.ts`
  reprova no job `lint`, e reprova: referência mutável, digest sem a tag
  INLINE (inclusive a forma antiga, tag só no comentário), comentário que
  diverge da tag inline, comentário no fim do `FROM`, a MESMA tag inline com
  dois digests diferentes, e — num WORKFLOW — imagem literal (mesmo por
  digest), expressão que não seja EXATAMENTE `${{ needs.<job>.outputs.<x> }}`
  (literal na expressão, `||`, `env.`, `vars.`, `format()` são onde um literal
  mutável se esconde) e `needs` de job que não chama o reutilizável. A regra
  dos dois digests nasceu da promessa do `golden-set-rag.yml` de rodar a
  mesma versão do compose de dev (o piso do golden-set é chaveado por MODELO,
  não por ambiente); desde o ADR 0197 essa promessa é CONSTRUÇÃO, e a regra
  segue guardando composes × Dockerfiles × manifests. São DOIS
  scripts e não um: `uses:` mora em YAML de workflow com uma sintaxe, imagem
  mora em compose, manifest do kustomize e Dockerfile com outras três. O
  check NÃO cobre as imagens que o PRODUTO publica, e isso é decisão com três
  razões — não há terceiro que as mova; `brabo-api:prod` é tag LOCAL cujo
  digest não existe antes do build; e onde elas atravessam registry o ADR
  0119 já as resolve, com o overlay guardando o MARCADOR de propósito, então
  cobrar digest literal ali reprovaria o estado CERTO. Também ficam fora
  referência interpolada (`${BRABO_API_IMAGE:?…}`) e estágio de multi-stage.
  A lista de exceções é por NOME e falha fechado: imagem de terceiro nova
  nunca casa com `brabo-`. Preço DECLARADO e não pago aqui: digest congela, e
  imagem congelada não recebe correção de segurança até alguém trocá-lo — e
  desde o ADR 0197 o Dependabot `docker-compose` (`/docker`) e `docker`
  (`/docker/*` e `/deploy/k8s/**`, NUNCA `/docker` sem o `/*`: o `docker`
  também lê YAML e abriria um segundo PR para os composes) estão LIGADOS,
  `target-branch: dev`, cada um com UM grupo — sem grupo, a mesma tag em três
  pastas de Dockerfile viraria três PRs vermelhos. Segue DECLARADO: `neo4j` e
  `ollama` moram também em `deploy/k8s/base/`, os dois ecossistemas nunca
  dividem um PR, e uma re-publicação da MESMA tag faz os dois PRs nascerem
  vermelhos pela regra dos dois digests até um humano juntá-los — não afrouxe
  a regra para eles passarem. O `imageName` do CNPG e a
  `IMAGEM_DO_GOLDEN_SET_QA` ficam no procedimento manual em qualquer caso. Subir um digest é procedimento de runbook, e a regra NÃO tem RN,
  pelo mesmo motivo que a irmã não tem: as duas moram aqui e em
  scripts/ci/docs/explanation/cadeia-de-suprimentos-do-ci.md, e pôr uma delas em
  business-rules.md daria dois endereços à mesma política. E desde a RN-524 (ADR
  0149) a esteira também ASSINA o que publica: `cosign` keyless (OIDC do
  Actions) nas imagens publicadas (cinco desde o ADR 0162) por DIGEST — nunca por tag, que é ponteiro
  móvel — e UM `checksums.txt` assinado cobrindo os binários do runner
  (quatro alvos desde o ADR 0174), não uma assinatura por binário. Os dois workflows VERIFICAM o que
  assinaram no mesmo run, porque assinatura que ninguém tenta verificar é
  arquivo a mais e a falha apareceria só na máquina de quem instala. E desde
  o ADR 0172 (AT-179) o `release.yml` ESCANEIA o que publica antes de
  assinar: Trivy sobre o DIGEST de cada imagem do `.release/images.json`
  (`--image-src remote`), entre o registro e o `cosign sign` — imagem
  reprovada não é assinada, e o `install.sh` não instala imagem sem
  assinatura. Até ali só o `ci.yml` escaneava, e ele escaneia um build LOCAL do
  PR, enquanto a tag constrói FRIA noutra execução (AT-110). O portão usa as
  flags do `ci.yml` BYTE A BYTE (`--severity HIGH,CRITICAL --ignore-unfixed
  --exit-code 1`, o MESMO `.trivyignore.yaml`) e o veredito é o código de
  saída do Trivy, nunca uma régua em TS; o que NÃO tem correção é RELATADO
  (resumo do job e asset `trivy-sem-correcao.md`, por
  `scripts/ci/trivy-do-release.ts`) e não bloqueia. Sem allowlist nova — não
  acrescente `--ignorefile`, `--skip-*` nem `--vex` ao release para uma tag
  passar. Versão, `sha256` e flags do Trivy existem nos DOIS workflows, de
  propósito (`env:` não se importa), e `scripts/ci/trivy-do-release.spec.ts`
  reprova a divergência e o portão depois da assinatura: quem sobe o Trivy sobe
  nos dois no mesmo PR. Preço declarado: o push vem antes do scan, então tag
  reprovada deixa imagem SEM assinatura no GHCR e sem Release. Desde a
  RN-525 o proxy `GET /runner-releases/binary` VERIFICA — mas só o sha256
  contra o `checksums.txt` da mesma release, nunca a ASSINATURA dele: é
  INTEGRIDADE e não procedência, e está escrito assim no docblock, na
  OpenAPI, na mensagem de recusa e na RN. As duas formas de a api verificar
  assinatura foram MEDIDAS e recusadas — `cosign` na imagem custa 155 MB
  contra um runtime Alpine+Node, e `@sigstore/verify` (2,5 MB, barato) faria
  uma rota `@Public()` depender de um SEGUNDO host de terceiro
  (`tuf-repo-cdn.sigstore.dev`) para verificar algo que nenhuma Release
  carrega ainda, o que a régua dos ADRs 0041/0042 proíbe declarar sem prova.
  Quem verifica assinatura é o `install.sh`, com `cosign` pinado — e ele roda
  na máquina DOS OUTROS, então não assume ferramenta que o SO possa não ter:
  hash é UMA função com DUAS ferramentas aceitas (`sha256sum` **ou**
  `shasum -a 256`), resolvidas ANTES do primeiro download e nunca no meio de
  uma verificação, pela mesma disciplina que já fez o `case` de
  `sha_do_cosign` recusar array associativo (bash 3.2 do macOS) e
  `comparar_versoes` recusar `sort -V`. Faltar as DUAS é recusa PRÓPRIA, que
  nomeia a ferramenta — NUNCA a de hash divergente, que é a de INCIDENTE
  (*"pare e investigue"*): o script chamava `sha256sum` direto nos cinco
  pontos de verificação, o macOS não o traz, e o `command not found` chegava
  como acusação de adulteração, bloqueando toda instalação na plataforma que
  ele mesmo suporta e ensinando a ignorar a frase no dia em que ela for
  verdade (AT-091, RN-526). Ferramenta ausente e hash divergente são recusas
  DIFERENTES, com textos diferentes — não as colapse. Fica FORA,
  declarado: code-signing de SO dos binários (notarização, Authenticode) e a
  metade de PROCEDÊNCIA do proxy — BRB-005 segue aberto só nela. E desde a
  RN-565 o manifesto NÃO é mais refém da matriz: o job `checksums` perdeu o
  `needs: build` e passou a esperar os ASSETS da Release, com teto, em vez do
  JOB mais lento — que podia nem começar. O número é medido nas três tags que
  existem: `darwin-x64` ficava 24h00m01s na fila e era cancelado, o MESMO
  valor nas três, enquanto os outros quatro terminavam em no máximo 4m18s (o
  alvo saiu da matriz depois, no ADR 0174; a correção vale para qualquer alvo
  sem runner). `always()`
  cobria dependência CANCELADA e por isso o job RODAVA; o que ele nunca
  cobriu foi QUANDO, e um manifesto que chega um dia depois é, para quem
  instala, um manifesto ausente (RN-525/526 recusam sem ele, em TODA
  plataforma, inclusive as que anexaram). O teto dos binários é 1200s porque
  é o `timeout-minutes: 20` do próprio job `build` — o máximo que um alvo COM
  runner demora depois de começar; não cobrir tempo de FILA é o ponto. Ver
  scripts/ci/docs/explanation/cadeia-de-suprimentos-do-ci.md, que também DECLARA o que
  segue confiado na fé (sem proveniência de dependência npm; o Dependabot e a
  imagem de terceiro por tag saíram dessa lista, e o que ficou no lugar do
  segundo é o preço do pin — digest não recebe correção sozinho).
  E há UM workflow que NÃO roda em `pull_request` e não pode passar a rodar:
  `install-e2e.yml` (RN-534/RN-549). O instalador verifica a própria origem
  contra o `checksums.txt` ASSINADO de uma Release, que só existe depois de uma
  tag final — fazê-lo rodar em PR exigiria dar-lhe uma porta para PULAR a
  verificação, que é a porta que o ADR 0150 recusa e que, aberta, vale para
  qualquer um. A consequência é DECLARADA e não escondida: **PR que mexe nesse
  workflow não o executa**, e verde ali não significa provado. O que roda em PR
  é `scripts/dev/install-e2e.spec.ts`, e ele guarda as duas formas de o E2E
  apodrecer calado — o gatilho afrouxado, e uma frase do `install.sh` reescrita
  (que não faz as asserções falharem: faz elas SUMIREM). Mesma decisão, mesmo
  motivo, do golden-set do RAG (ADR 0138) e do golden-set do QA
  (`golden-set-qa.yml`, SEMANAL, ADR 0168 — api, engine e broker nativos no
  runner, o socket do Docker só no broker, e a imagem dos casos lida do
  próprio seed, nunca de um segundo literal no workflow). E ele guarda uma TERCEIRA, medida na
  AT-083: o instrumento que não mede. O passo "com TTY" rodava
  `script -qec "… < respostas"`, o `<` ficava DENTRO do `script`, e o
  instalador nunca viu terminal — o comentário afirmava o contrário. Quem roda o
  instalador agora é um driver de pty em Python, e o spec EXTRAI esse driver do
  workflow e o roda contra um instalador de mentira; lógica de workflow que só
  roda em tag se prova assim, em PR, nunca por leitura. A forma de instalar é
  BAIXAR e rodar um arquivo (`curl -fsSLO … && bash install.sh`, RN-526) — o
  `sh -c "$(curl …)"` antigo nunca funcionou, porque a autoverificação calcula o
  hash de `$0`; não reabra essa forma nem dê à verificação uma porta de pular
- Dependência de merge entre repos (AT-787): `dependencias-de-merge.yml` (reutilizável; o chamador declara `pull_request` `[opened, edited, synchronize, reopened, closed]` e passa `APP_ID`/`APP_PRIVATE_KEY`) avalia o `Depende-de: viralabs-dev/<repo>#<n>` do corpo (`scripts/ci/dependencias-de-merge.ts`, lista fechada dos 11 repos, regex estrita, sem flag `i`) e publica o check-run `Dependências de merge` pelo App: `in_progress` "esperando ..." enquanto falta merge, `success` sem dependência ou com todas MERGED, `failure` para o resto (owner/repo inválido, linha malformada, autorreferência, 404, fechada sem merge, ciclo ou cadeia além da profundidade 5). NUNCA `neutral`: para ruleset ele contaria como verde. O job `avisar-dependentes` (PR mergeada) acha as PRs abertas que a citam e atualiza o check delas; o `dependencias-de-merge-rede.yml` do próprio brabo-ci varre de hora em hora, mas `schedule` só lê a branch PADRÃO: a rede só liga quando o brabo-ci chegar à `main`. Os jobs têm `continue-on-error` e o 403 (App sem `checks: write`) só vira `::warning::`. O corpo da PR é lido pela API e nunca interpolado em `run:`. Ligar o check como exigido no ruleset é gesto do dono, depois das provas.
- Regressivo por funcionalidade (AT-769): `qa-e2e-gatilho.yml` tem o job `regressivo-dev` para PR com base `dev`. Ele seleciona as funcionalidades tocadas (`qa-regressivo-selecao.ts`; regras de arquivo transversal: nada, catálogo inteiro, sem dono = smoke + aviso), publica o check `Regressivo do brabo-qa` e usa a imagem `sha-<12>` do head. Esse check NUNCA entra em ruleset (`regressivo-nao-exigido.spec.ts` guarda); o portão da `main` segue sendo o `E2E do brabo-qa`. O catálogo é lido de `brabo-qa/funcionalidades.yml` na `dev`.
- Relatório de decisão do regressivo (AT-791): `qa-e2e-resumo.ts` tem `recomendar()` (RN-1051), `caber()` (teto de 60 000 caracteres por campo do check, corte por prioridade e aviso) e o tipo `RelatorioRegressivo` (o `relatorio-regressivo.json` v1 que o brabo-qa escreve); com `relatorio`, `montarCheck` devolve `summary` e `text` (um `<details>` por funcionalidade). `selecionar()` devolve `motivos` e `tocadas` e roda também na `main`, só como informação. O aceite (`qa-e2e-aceitar.ts`) passa `resumoAnterior` e `textoAnterior` para o check vermelho sobreviver ao `/qa-aceitar` (RN-1052). Sem `relatorio`, nada muda para quem chama como antes.
- Espera do carimbo e da assinatura (AT-790, RN-1066): `qa-e2e-espera.ts` (`repetirAte`, `esperarImagemAssinada`, `cosignAssinada`, relogio injetavel) e usado pelo `qa-e2e-disparar.ts` nos dois modos. Teto `espera_minutos` (padrao 10, env `QA_ESPERA_MINUTOS`); o vermelho diz se faltou tag `-dev`, imagem (causa `ambiente`) ou assinatura (causa `assinatura`). A identidade do cosign e a do `e2e-pr` do brabo-qa; mude as duas juntas.
- Vínculos na origem (AT-773): `qa-e2e-disparar.ts` manda `origem` no payload (`correlacao` = `<GITHUB_RUN_ID>-<GITHUB_RUN_ATTEMPT>`, que o `run-name` do `e2e-pr` repete como `c=<...>`), procura o run disparado por essa correlação por até 60 s e escreve o Vínculos no Summary do run de origem (`qa-e2e-vinculos.ts`, helper `vinculos.ts`); sem achar, fica o link do check. Tudo isso é best-effort e nunca reprova o gatilho. `PR_AUTOR` (env opcional) é o autor da PR; sem ele vale `GITHUB_ACTOR`. A mensagem da tag anotada termina em `Carimbo: <url do run>` (`comCarimbo`), que o `vinculos` lê no run disparado pela tag.

## Documentação é parte da definição de pronto (permanente)
- A doc deste repo mora em `docs/` (fonte pt-BR; `en`, `ru` e `zh-Hans` em `docs/i18n/`). Ao alterar código, atualize a doc da área NA MESMA mudança e mostre o diff dela junto com o do código. Não pergunte se deve: faça. NUNCA crie `website/docs/`: o site é agregado pelo `brabo`, que lê a `docs/` de cada repositório.
- Mudança de comportamento observável → entrada em `CHANGELOG.md` (Unreleased). Versão própria a partir da 1.0.0, e toda tag nasce de workflow (nunca versionar à mão).
- Regra de negócio nova → RN-XXX com `caminho:N` (`símbolo`) e o teste que a cobre, na `docs/business-rules*` deste repo; a numeração é UMA só no produto (nunca reinicie), a âncora `{#rn-NNN}` é o contrato e não muda quando a RN muda de arquivo. Aloque o número varrendo as branches locais e o remoto (colide com frente paralela).
- Mudança estrutural (fronteira de camada, banco, modelo de consistência, dependência pesada) → ADR novo com o próximo número; ADR aceito NUNCA é editado (o novo o referencia). Os ADRs moram no repo `brabo` (a porta de entrada do produto).
- Nunca inventar conteúdo de doc: sem informação suficiente, use `> **TODO(humano):** <pergunta específica>.`. Diagramas em Mermaid no próprio Markdown, nunca imagem.
- Este arquivo também é doc: toda mudança verifica se ele precisa mudar (Stack, convenções, "O que NÃO fazer"). Ele é lido em toda sessão e não passa de 40 mil caracteres (`wc -m`, nunca `wc -c`); o que só vale para uma área sai daqui para `.claude/rules/` com `paths:`.

## O que NÃO fazer
- Não instalar libs sem justificar no plano. Não versionar à mão: toda tag nasce de workflow. Este repo não tem produto.
