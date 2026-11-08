# Contribuindo com o Brabo

Obrigado pelo interesse. Este documento existe para economizar o tempo dos
dois lados: o que ajuda, o que provavelmente não vai ser aceito, e como o
processo funciona de verdade.

## Antes de escrever código: abra uma issue

**Com todas as letras: PR grande sem issue prévia provavelmente será
recusado.** Não por burocracia — por respeito ao seu tempo. Este projeto tem
decisões arquiteturais registradas em [247 ADRs](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/index.md), e uma
mudança que contradiz uma delas custa muito trabalho para depois ser
rejeitada.

Abra uma issue, descreva o problema, e espere alinhamento. Para correção
óbvia (typo, link quebrado, mensagem de erro errada), pode mandar o PR direto.

## Setup

```bash
git clone https://github.com/viralabs-dev/brabo-workspace.git ~/dev/brabo
cd ~/dev/brabo
./clonar-tudo.sh
cd brabo-infra
make dev
```

Depois: <http://localhost:5173>. `pnpm --filter api seed` cria os usuários de
demonstração — o login é `owner@brabo.dev` / `brabo12345678`.

`pnpm bootstrap` abre um menu de terminal com o que se faz no dia a dia (Docker,
Kubernetes, banco e testes), se você preferir não decorar comando. Ele só chama o
que já existe, e `pnpm bootstrap --print-commands` mostra exatamente o quê.

**Quanto tempo leva de verdade:** os comandos acima somam poucos minutos, mas a
**primeira** subida baixa as imagens (Postgres, Elixir, Node) e o
modelo padrão do Ollama. Numa conexão razoável, conte **10 a 20 minutos** na
primeira vez e menos de um minuto nas seguintes. Precisa de ~6 GiB de RAM
livres.

O passo a passo comentado, com o que conferir quando cada etapa falha, está em
[Primeiros passos](https://github.com/viralabs-dev/brabo/blob/dev/docs/getting-started.md).

## Rodando os testes

Este repo é só workflows reutilizáveis e os scripts TypeScript deles (`scripts/ci/`).
Não tem API, web nem engine: a suíte é o Vitest.

```bash
pnpm install
pnpm test               # vitest run: os specs de scripts/ci/ e dos workflows
pnpm typecheck          # tsc --noEmit
pnpm actions:pinadas    # falha em `uses:` preso a tag em vez de SHA
```

Lógica nova de script leva spec com o caminho feliz **e** ao menos um caso de
falha. Os reutilizáveis são testados pelos repos que os chamam: mudou um
`workflow_call`, abra a PR de repinagem no consumidor depois do merge.

## Quando o git pendura ou é recusado (máquina local, agentes em worktree)

Dois contornos medidos na máquina do mantenedor (AT-187). Os dois são de
**configuração local** — nada aqui muda o repositório, e nenhum dos dois é
pré-requisito para quem não tem o sintoma.

**O `origin` por SSH pendura.** `git fetch`/`push`/`ls-remote` ficam parados
sem erro, enquanto o GitHub responde por HTTPS. Diagnostique antes de trocar —
com teto, para o diagnóstico não pendurar também:

```bash
timeout 30 ssh -vT git@github.com      # trava antes do "Authenticated"? o SSH é o problema
curl -sS -o /dev/null -w '%{time_total}s\n' https://github.com   # responde? a rede está de pé
```

A saída `-v` diz em que passo parou (conexão na porta 22, troca de chaves,
oferta da chave do agente). Se o SSH não volta e o HTTPS responde, troque o
`origin` para HTTPS e deixe o `gh` ser o helper de credencial:

```bash
gh auth setup-git
git remote set-url origin https://github.com/viralabs-dev/<repo>.git
git ls-remote origin dev               # confere que voltou a responder
```

**Um hook local reescreve `git`, e o agente em worktree é recusado.** Se o seu
ambiente de agente tem um hook que reescreve as chamadas a `git` (no caso
medido, para `rtk git`) e um guard de worktree que recusa `git` dentro de
comando composto (`&&`, `;`, `|`), chame o binário direto e um comando por vez:

```bash
/usr/bin/git status
/usr/bin/git push -u origin <sua-branch>
```

Esse hook e esse guard são configuração do ambiente de quem desenvolve, **fora
deste repositório** — o `.claude/` versionado aqui só tem as definições de
agente (`.claude/agents/`) e um comando (`.claude/commands/`), nenhum hook.
O conserto, se vier, é nessa configuração local, nunca aqui.

> **TODO(humano):** em que arquivo mora o hook que reescreve `git` para
> `rtk git` (ex.: `~/.claude/settings.json`, um `PreToolUse`?), o que é o `rtk`,
> e qual guard recusa o comando composto — não está no repositório e não pôde
> ser conferido daqui.

## Documentação faz parte do PR

Não é etapa posterior nem tarefa de outra pessoa.

**PR que muda comportamento observável atualiza a doc no mesmo PR.** Aqui a doc
é o `README.md` (o que cada workflow e script faz), o `CLAUDE.md` (as regras do
repo) e o `CHANGELOG.md` (seção `Unreleased`). A doc da política mora aqui, em `scripts/ci/docs/`
(explicação, referência, regras de negócio `ci.md` e traduções); o site do
[`brabo`](https://github.com/viralabs-dev/brabo) a publica em `/prd/`. Os ADRs
e a documentação agregada do produto moram no `brabo`.

- Mudança estrutural pede um
  [ADR](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/index.md) novo no
  `brabo`. Nunca edite um ADR aceito: escreva outro dizendo qual substitui.
- Regra de negócio nova vira uma RN em
  [`docs/business-rules`](https://github.com/viralabs-dev/brabo/tree/dev/docs/business-rules)
  do `brabo`, com `arquivo:linha` e o teste que a cobre.
- Sem informação suficiente para escrever algo, use
  `> **TODO(humano):** <pergunta específica>`. Documentação inventada é pior que
  documentação faltando.

## Fluxo

1. **Fork** e clone.
2. **Branch** a partir de `dev`, nunca de `main`:
   `feature/<assunto>`, `bugfix/<assunto>` ou `docs/<assunto>`.

   A lista de funções é **fechada**: `breaking`, `feature`, `bugfix`, `perf`,
   `refactor`, `chore`, `docs`, `test`, `hotfix`. O `pr-police` reprova o que
   estiver fora — `fix/` inclusive, que é o engano mais comum.
3. **Commits** em [conventional commits](https://www.conventionalcommits.org/),
   **em pt-BR** — é o padrão que o histórico inteiro usa:
   ```
   feat(api): rate limit por usuário e por IP
   fix(engine): drain não deixava sessão órfã com uma réplica
   docs(runbook): funde os seis runbooks num só
   ```

   **Quebra de compatibilidade se marca no commit**, com `!` antes dos
   dois-pontos ou `BREAKING CHANGE:` no corpo — e a branch tem que ser
   `breaking/`:
   ```
   feat(auth)!: o refresh sai do corpo e vai para cookie httpOnly
   ```
   É o marcador que faz a quebra aparecer no CHANGELOG; a função da branch é
   que faz a versão subir MAJOR. O `pr-police` exige os dois juntos, porque
   ter só um deles produz uma release que mente — em algum dos dois sentidos.
4. **PR contra `dev`** (não `main`). PR que toca uma funcionalidade do catálogo (`brabo-qa/funcionalidades.yml`, mapa por caminho) ajusta o regressivo dela no `brabo-qa` contra a `dev`, ou diz no card por que não precisa. Na PR para a `dev` o check `Regressivo do brabo-qa` só atesta (nunca obrigatório); na PR para a `main` o `E2E do brabo-qa` roda o catálogo inteiro e bloqueia, salvo `/qa-aceitar`.
5. **Review** meu.
6. **Squash merge.**

Branches permanentes são `dev`, `qa`, `rc` e `main`. Merge nelas é sempre
manual — inclusive para mim, e há teste garantindo isso.

## Definition of Done

Antes de marcar o PR como pronto:

- [ ] `pnpm test` passando, com o caminho feliz **e** ao menos um caso de falha
- [ ] `pnpm typecheck` e `pnpm actions:pinadas` limpos
- [ ] `README.md`/`CLAUDE.md` atualizados se o comportamento mudou
- [ ] `CHANGELOG.md` (`Unreleased`) tocado, se o comportamento observável mudou
- [ ] Nenhum segredo no diff — o gitleaks roda no CI, mas ele é a última linha

## O que eu aceito com prazer

- Correção de bug com teste que reproduz
- Documentação: erro, lacuna, exemplo que não funciona
- Melhoria de mensagem de erro — especialmente as que hoje não dizem o que fazer
- Cobertura de teste em caminho de falha
- Acessibilidade e correção de contraste na UI
- Provider de git novo, **se** implementar as quinze operações, declarar as
  capabilities honestamente e passar na suite de contrato

## O que provavelmente não aceito

Não é fechamento a ideias — é que estas custam caro e as decisões já foram
tomadas com motivo registrado:

- **Troca de stack.** NestJS, Elixir/OTP, React, Postgres e pnpm estão
  decididos. Não proponha alternativas.
- **Redis.** As filas ficam no Postgres via Oban, e o rate limit é uma janela
  deslizante em SQL. É decisão, não omissão.
- **Refactor amplo sem discussão prévia.** "Limpei o código" num PR de 40
  arquivos é irreviewável.
- **Dependência nova pesada** sem justificativa do que ela resolve e por que
  não dá sem ela.
- **Enfraquecer o pipeline de aprovação.** Qualquer coisa que permita ação com
  efeito externo escapar do `proposed_action`, ou que torne merge em branch
  protegida automatizável, é rejeitada por princípio — há teste garantindo os
  dois.
- **Bitbucket ou um `GenericGitProvider`** — fora de escopo por decisão.
- Mudança de escopo do produto sem issue e alinhamento.

## Prazo de resposta

Projeto mantido em tempo livre. O compromisso honesto: **reviso em geral em até
uma semana**. Se eu sumir por mais que isso, dá um ping educado no PR — não é
falta de interesse, é vida.

Nada de prometer 24 horas.

## Reconhecimento

Seu commit fica no histórico com sua autoria — é o registro que importa. PRs
relevantes são creditados na entrada do `CHANGELOG.md` da versão em que saírem.

Commits feitos por agentes do próprio sistema usam a identidade
`<agente>[bot]` com o humano como co-author, para que dê para distinguir.

## Licenciamento

Ao enviar um PR, você concorda em licenciar sua contribuição sob a mesma
**[MIT](LICENSE)** do projeto. Inbound = outbound.

**Não há CLA.** Você não assina nada nem cede direitos além do que a MIT já
prevê.

O [DCO](https://developercertificate.org/) (`git commit -s`) é **opcional**.
Se você já usa, ótimo. Se não usa, não vou exigir: para contribuidor casual,
descobrir o que é DCO e refazer commits por causa de um trailer é atrito real
que espanta mais gente do que protege.

## Segurança

**Nunca abra issue pública para falha de segurança.** O canal está em
[SECURITY.md](SECURITY.md).

## Código de conduta

Participar deste projeto — issue, PR, review — implica concordar com o
[Código de Conduta](CODE_OF_CONDUCT.md) (Contributor Covenant 2.1). O contato
para reportar comportamento inaceitável está lá.
