/**
 * readme-esqueleto — confere que o README segue o esqueleto didático de 8 seções (AT-826):
 * os títulos `##` na ordem de `README.modelo.md`, nenhum título com id de AT, ADR ou RN, e o
 * bloco do mapa (`<!-- mapa:inicio -->` e `<!-- mapa:fim -->`). Uma vitrine antes da seção 1
 * só é aceita se terminar no marcador `<!-- vitrine:fim -->`.
 *
 * Uso: `node scripts/ci/readme-esqueleto.ts [README...]` (padrão `README.md`); sai com 1 se algum reprova.
 *
 * Sintaxe apagável apenas (o Node executa este `.ts` por type stripping).
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { MARCA_FIM, MARCA_INICIO } from './mapa-dos-repos.ts';

export const MARCA_VITRINE = '<!-- vitrine:fim -->';

/** As seções do esqueleto, em ordem: a 8 são dois títulos. */
export const TITULOS = [
  'Para que existe',
  'Onde se encaixa',
  'Como é usado',
  'Como desenvolver',
  'O que o CI garante',
  'Documentação',
  'Como replicar no seu projeto',
  'Apoie',
  'Licença',
];

const ID = /\b(?:AT-\d+|RN-\d+|ADR\b)/;

/** Os problemas do README, vazio se está de acordo. */
export function conferir(texto: string): string[] {
  const erros: string[] = [];
  const titulos: Array<{ nivel: number; texto: string; linha: number }> = [];
  let cerca = false;
  texto.split('\n').forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) cerca = !cerca;
    const m = !cerca && /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(l);
    if (m) titulos.push({ nivel: m[1]!.length, texto: m[2]!, linha: i + 1 });
  });
  for (const t of titulos) if (ID.test(t.texto)) erros.push(`linha ${t.linha}: o título "${t.texto}" cita AT, ADR ou RN; diga o assunto e deixe o id para o corpo`);

  const h2 = titulos.filter((t) => t.nivel === 2);
  let de = 0;
  for (const alvo of TITULOS) {
    const i = h2.findIndex((t, k) => k >= de && t.texto === alvo);
    if (i < 0) {
      erros.push(h2.some((t) => t.texto === alvo) ? `a seção "${alvo}" está fora da ordem do esqueleto` : `falta a seção "## ${alvo}"`);
    } else de = i + 1;
  }
  const primeira = texto.split('\n').findIndex((l) => l === `## ${TITULOS[0]}`);
  const vitrine = texto.indexOf(MARCA_VITRINE);
  const antes = h2.filter((t) => t.linha - 1 < primeira && primeira >= 0);
  if (antes.length && !(vitrine >= 0 && texto.slice(0, vitrine).split('\n').length <= primeira)) {
    erros.push(`há seção antes de "## ${TITULOS[0]}" ("${antes[0]!.texto}"); só uma vitrine terminada em ${MARCA_VITRINE} pode vir antes`);
  }

  const i = texto.indexOf(MARCA_INICIO);
  const f = texto.indexOf(MARCA_FIM);
  if (i < 0 || f < i) erros.push(`falta o bloco do mapa entre ${MARCA_INICIO} e ${MARCA_FIM}`);
  else {
    const onde = h2.find((t) => t.texto === TITULOS[1]);
    const proxima = h2.find((t) => t.texto === TITULOS[2]);
    const linhaI = texto.slice(0, i).split('\n').length;
    if (onde && proxima && !(onde.linha < linhaI && linhaI < proxima.linha)) erros.push(`o bloco do mapa deve ficar dentro de "## ${TITULOS[1]}"`);
  }
  return erros;
}

function principal(): void {
  const arquivos = process.argv.slice(2);
  let falhou = false;
  for (const arq of arquivos.length ? arquivos : ['README.md']) {
    for (const e of conferir(readFileSync(arq, 'utf8'))) {
      console.log(`::error file=${arq},title=readme-esqueleto::${e}`);
      falhou = true;
    }
  }
  if (falhou) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal();
