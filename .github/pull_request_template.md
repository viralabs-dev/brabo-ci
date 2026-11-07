# Descrição

<!-- O que muda e por quê. Se houver issue de alinhamento, é ela que carrega o
contexto — aqui basta o resumo. -->

Closes #

<!-- Opcional, uma linha por PR de outro repo que precisa mergear antes desta (AT-787):
Depende-de: viralabs-dev/brabo-api#56
Tire o comentário e escreva a linha no corpo; o check "Dependências de merge" espera o merge dela. -->

## Tipo de mudança

- [ ] Correção de bug
- [ ] Funcionalidade
- [ ] Documentação
- [ ] Infraestrutura / CI
- [ ] Refactor sem mudança de comportamento
- [ ] **Breaking change** — quebra comportamento existente

## Como testar

<!-- Passos para quem revisa reproduzir. Comando de teste específico, se houver:
     pnpm --filter api test -- rate-limit -->

## Screenshots

<!-- Só se mexeu em UI. Antes e depois ajuda mais que só o depois. -->

## Definition of Done

- [ ] Testes passando — caminho feliz **e** ao menos um caso de falha
- [ ] Lint limpo
- [ ] **Atualizei a documentação afetada** (ver [`docs/.docmap.yml`](https://github.com/viralabs-dev/brabo/blob/dev/docs/.docmap.yml)) — o diff da doc está neste PR
- [ ] `CHANGELOG.md` tocado, se o comportamento observável mudou
- [ ] `pnpm docs:build` sem link quebrado
- [ ] ADR novo, se a mudança é estrutural (nenhum ADR aceito foi editado)
- [ ] Nenhum segredo no diff

## Licença

- [ ] Concordo em licenciar esta contribuição sob a [MIT](../LICENSE) do projeto

<!-- PR mira `dev`, nunca `main`. Merge em branch protegida é sempre manual. -->
