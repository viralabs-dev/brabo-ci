<!--
Modelo de README do Brabo: copie para a raiz do repo, troque o que está entre <> e apague estes comentários.
Os títulos `##` abaixo são fixos e na ordem; `scripts/ci/readme-esqueleto.ts` reprova quem faltar, trocar a ordem
ou pôr id de AT, ADR ou RN no título (o id pode aparecer no corpo, como link de "saiba mais").
Cada seção diz para quem é e o que a pessoa consegue fazer depois de ler. Detalhe longo desce para `docs/`.
-->
# <repo>

<Uma frase: o problema que este repo resolve, sem a stack.>

## Para que existe

<Para quem: quem caiu no repo pelo GitHub. Depois de ler, a pessoa diz em uma linha por que ele existe separado dos outros.>

## Onde se encaixa

<Para quem: quem quer o mapa. Depois de ler, a pessoa aponta de quem este repo depende e quem quebra se ele mudar.>

<!-- mapa:inicio -->
<!-- Gerado do repos.yml do brabo: `node scripts/ci/mapa-dos-repos.ts --repo <repo>`. Não edite à mão. O nome de cada repo na tabela é link para o GitHub; o do próprio repo fica em negrito. -->
<!-- mapa:fim -->

## Como é usado

<Para quem: quem consome o repo. Depois de ler, a pessoa o consome sem ler o código.>
<Diga o canal (tag, SHA, imagem, binário, pacote ou clone) e dê UM exemplo copiável que roda.>

## Como desenvolver

<Para quem: quem vai mudar o repo. Depois de ler, a pessoa roda a suíte local com o mesmo código de saída do CI.>
<Pré-requisitos, comandos e testes: o mesmo comando que o CI roda.>

## O que o CI garante

<Para quem: quem abre PR. Depois de ler, a pessoa prevê o que reprova a PR.>
<Os checks obrigatórios e os opcionais, e o que cada um prova.>

## Documentação

<Para quem: quem quer o detalhe. Depois de ler, a pessoa acha a documentação longa.>
<Links para `docs/` e para a página do site.>

## Como replicar no seu projeto

<Para quem: quem quer o mesmo padrão em outro produto. Depois de ler, a pessoa lista os arquivos que copiaria e o que adaptaria.>
<Aponte o guia de adoção (`scripts/ci/docs/tutorials/adotar.md` do brabo-ci) e a trilha do site sobre orquestrar vários repos.>

## Apoie

Se o projeto te ajuda, você pode [pagar um café no Ko-fi](https://ko-fi.com/daneiel).

## Licença

<MIT, com link para o arquivo LICENSE.>
