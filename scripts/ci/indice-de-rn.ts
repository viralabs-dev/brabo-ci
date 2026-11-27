/**
 * indice-de-rn — o índice `business-rules/<x>.md` das áreas partidas é GERADO das
 * partes `<x>/parte-NN.md` e tem de estar completo (AT-1029, F3; ADR 0287). A
 * grade `<a id="rn-NNN">` era "congelada" e só crescia à mão: a da api parava na
 * RN-1352 e faltavam 44 RNs, então `api.md#rn-N` abria o índice no topo sem achar
 * a RN. Agora a tabela (parte, desde, nº de RNs, seções `## `) e a grade (toda RN
 * de cabeçalho `### RN-NNN`, na ordem das partes) saem das partes; o frontmatter
 * e o texto de abertura do índice ficam como estão.
 *
 * Também mede o peso em Markdown de cada página de RN (o `docs:build` do `brabo`
 * só mede o HTML, depois do merge): AVISO acima de `AVISO_KB` (o `ORCAMENTO_KB`
 * do `partir-rn.mjs`; a RN nova já vai para a `parte-NN+1.md`) e ERRO acima de
 * `TETO_KB`. Páginas de `i18n/` e fixtures ficam de fora.
 *
 * Uso (na raiz do repo): `node indice-de-rn.ts [--escrever]`. Sai 1 se algum
 * índice difere do gerado ou se uma página passa do teto; com `--escrever`
 * reescreve os índices e o código de saída continua sendo o do veredito de
 * ANTES (como o `refs-com-simbolo`), para o workflow subir o patch.
 *
 * Sintaxe apagável apenas (o Node executa este `.ts` por type stripping).
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** O alvo de corte do `brabo:scripts/docs/partir-rn.mjs` (`ORCAMENTO_KB`). */
export const AVISO_KB = 90;
/**
 * Teto em Markdown, calibrado em 27/11 (AT-1039) no site publicado: a pior razão HTML/MD das
 * páginas acima de 90 KB é 1,502 (engine `parte-07`, locale ru: 101.806 B de MD, 152.895 B de HTML);
 * 150 KB (teto do `orcamento.mjs`, ADR 0287) ÷ 1,502 = 99,8 KB. Os 105 KB antigos deixavam passar
 * ~157 KB de HTML. Recalibrar se a razão piorar.
 */
export const TETO_KB = 99.8;

export interface Parte {
  /** `docs/business-rules/api/parte-01.md` */
  arquivo: string;
  texto: string;
}

const RN = /^#{2,4} +RN-(\d+)\b/;
const pad = (n: number | string) => String(n).padStart(3, '0');

/** Cabeçalhos de RN (números, na ordem, sem repetir) e seções `## ` (sem `{#id}`, sem repetir) de uma parte. */
export function lerParte(texto: string): { rns: number[]; secoes: string[] } {
  const rns: number[] = [];
  const secoes: string[] = [];
  for (const l of texto.split('\n')) {
    const m = RN.exec(l);
    if (m && !rns.includes(Number(m[1]))) rns.push(Number(m[1]));
    const s = /^## +(.+?)(?: +\{#[^}]*\})?\s*$/.exec(l);
    if (s && !secoes.includes(s[1]!)) secoes.push(s[1]!);
  }
  return { rns, secoes };
}

/** Reescreve a tabela e a grade de `atual` a partir de `partes` (já na ordem `parte-NN`); o resto fica. */
export function gerarIndice(atual: string, area: string, partes: readonly Parte[]): string {
  const linhas = atual.split('\n');
  const i = linhas.findIndex((l) => l.startsWith('| Parte |'));
  if (i < 0) throw new Error('o índice não tem a tabela `| Parte | Desde | RNs | Seções |`');
  let j = i + 2;
  while (j < linhas.length && linhas[j]!.startsWith('|')) j++;
  const frase = linhas.slice(j).find((l) => l.trim() !== '' && !l.startsWith('<a id')) ?? '';
  const vistos = new Set<number>();
  const tabela: string[] = [];
  const grade: string[] = [];
  partes.forEach((p, k) => {
    const { rns, secoes } = lerParte(p.texto);
    const nome = `parte-${String(k + 1).padStart(2, '0')}.md`;
    tabela.push(`| [parte ${k + 1}](${area}/${nome}) | ${rns.length > 0 ? `RN-${pad(rns[0]!)}` : '—'} | ${rns.length} | ${secoes.join('; ') || '—'} |`);
    for (const n of rns) {
      if (vistos.has(n)) continue;
      vistos.add(n);
      grade.push(`<a id="rn-${pad(n)}"></a>[${pad(n)}](${area}/${nome}#rn-${pad(n)})`);
    }
  });
  const dez: string[] = [];
  for (let k = 0; k < grade.length; k += 10) dez.push(grade.slice(k, k + 10).join(' '));
  return [...linhas.slice(0, i + 2), ...tabela, '', frase, '', ...dez, ''].join('\n');
}

export interface Pagina {
  arquivo: string;
  bytes: number;
  /** Última parte da área (ou página única): é onde a RN nova entra. */
  ultima: boolean;
}

export interface Peso {
  erros: string[];
  avisos: string[];
}

export function pesar(paginas: readonly Pagina[]): Peso {
  const r: Peso = { erros: [], avisos: [] };
  for (const p of paginas) {
    const kb = p.bytes / 1024;
    const tam = `${p.arquivo}: ${kb.toFixed(1)} KB em Markdown`;
    if (kb > TETO_KB) r.erros.push(`${tam}, acima do teto de ${TETO_KB} KB (o HTML passaria de 150 KB, ADR 0287). Parta a página: a RN nova vai para a próxima parte.`);
    else if (kb > AVISO_KB) r.avisos.push(`${tam}, acima de ${AVISO_KB} KB. ${p.ultima ? 'A RN nova já deve ir para a próxima parte (`parte-NN+1.md`).' : 'A parte já está cheia: RN nova não entra aqui.'}`);
  }
  return r;
}

const PARTE = /^(.*\/business-rules)\/([^/]+)\/parte-(\d+)\.md$/;
const FORA = /(^|\/)(i18n|__fixtures__|fixtures|node_modules)\//;

/** Áreas partidas (`índice`, `área`, `partes` ordenadas) e as páginas de RN, dos arquivos versionados. */
export function descobrir(versionados: readonly string[]) {
  const areas = new Map<string, { indice: string; area: string; partes: Array<{ n: number; arquivo: string }> }>();
  for (const f of versionados) {
    const m = PARTE.exec(f);
    if (!m || FORA.test(f)) continue;
    const indice = `${m[1]}/${m[2]}.md`;
    if (!versionados.includes(indice)) continue;
    const a = areas.get(indice) ?? { indice, area: m[2]!, partes: [] };
    a.partes.push({ n: Number(m[3]), arquivo: f });
    areas.set(indice, a);
  }
  for (const a of areas.values()) a.partes.sort((x, y) => x.n - y.n);
  const paginas = versionados.filter((f) => /\/business-rules\/.+\.md$/.test(f) && !FORA.test(f));
  return { areas: [...areas.values()], paginas };
}

export function principal(cwd: string, escrever: boolean): number {
  const lista = execFileSync('git', ['-C', cwd, 'ls-files'], { encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n').filter(Boolean);
  const { areas, paginas } = descobrir(lista);
  let ruim = 0;
  for (const a of areas) {
    const atual = readFileSync(join(cwd, a.indice), 'utf8');
    const novo = gerarIndice(atual, a.area, a.partes.map((p) => ({ arquivo: p.arquivo, texto: readFileSync(join(cwd, p.arquivo), 'utf8') })));
    if (novo === atual) continue;
    ruim++;
    const antes = new Set([...atual.matchAll(/id="rn-(\d+)"/g)].map((m) => m[1]));
    const faltam = [...novo.matchAll(/id="rn-(\d+)"/g)].filter((m) => !antes.has(m[1])).length;
    console.log(`::error file=${a.indice},title=indice-de-rn::o índice difere do gerado das partes (${faltam} RN(s) fora da grade). Rode \`node .brabo-ci/scripts/ci/indice-de-rn.ts --escrever\` e commite (ou aplique o patch \`indice-de-rn-patch\`).`);
    if (escrever) writeFileSync(join(cwd, a.indice), novo);
  }
  const ultimas = new Set(areas.map((a) => a.partes[a.partes.length - 1]!.arquivo));
  const emPartes = new Set(areas.flatMap((a) => a.partes.map((p) => p.arquivo)));
  const peso = pesar(
    paginas.map((arquivo) => ({ arquivo, bytes: statSync(join(cwd, arquivo)).size, ultima: ultimas.has(arquivo) || !emPartes.has(arquivo) })),
  );
  for (const m of peso.avisos) console.log(`::warning title=indice-de-rn::${m}`);
  for (const m of peso.erros) console.log(`::error title=indice-de-rn::${m}`);
  console.log(`indice-de-rn: ${areas.length} área(s) partida(s), ${ruim} índice(s) fora do gerado, ${peso.avisos.length} aviso(s) e ${peso.erros.length} erro(s) de tamanho.`);
  return ruim + peso.erros.length === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(principal(process.cwd(), process.argv.includes('--escrever')));
}
