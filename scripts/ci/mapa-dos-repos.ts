/**
 * mapa-dos-repos — gera o bloco "Onde se encaixa" dos READMEs a partir do `repos.yml` do
 * `brabo` (AT-825, ADR 0281): uma tabela e um Mermaid com a aresta rotulada pelo tipo, entre
 * `<!-- mapa:inicio -->` e `<!-- mapa:fim -->`, com o repo do README destacado.
 *
 * Uso: `node scripts/ci/mapa-dos-repos.ts --repo <nome> [--fonte <url|caminho>] [--check] [README...]`
 * Sem `--check` reescreve o bloco; com `--check` sai com 1 se o commitado diverge da fonte.
 * `--repo` vem de `GITHUB_REPOSITORY` quando falta; README padrão: `README.md`.
 *
 * Sintaxe apagável apenas (o Node executa este `.ts` por type stripping).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { DONO } from './dono.ts';

export const MARCA_INICIO = '<!-- mapa:inicio -->';
export const MARCA_FIM = '<!-- mapa:fim -->';
export const FONTE = `https://raw.githubusercontent.com/${DONO}/brabo/dev/repos.yml`;

export const TIPOS: Record<string, string> = {
  codigo: 'código',
  imagem: 'imagem',
  workflow: 'workflow',
  contrato: 'contrato',
  doc: 'doc',
};

export interface Aresta {
  repo: string;
  tipo: string;
  prova: string;
}
export interface Repo {
  papel: string;
  proposito: string;
  como_e_usado: string;
  depende_de: Aresta[];
}
export type Mapa = Record<string, Repo>;

/** Valida o YAML do `repos.yml`; erro de forma ou aresta para repo desconhecido derruba. */
export function lerMapa(yaml: string): Mapa {
  const repos = (parse(yaml) as { repos?: Mapa } | null)?.repos;
  if (!repos || typeof repos !== 'object') throw new Error('repos.yml sem a chave `repos`');
  for (const [nome, r] of Object.entries(repos)) {
    for (const c of ['papel', 'proposito', 'como_e_usado'] as const) {
      if (typeof r[c] !== 'string' || !r[c]) throw new Error(`${nome}: falta \`${c}\``);
    }
    if (!Array.isArray(r.depende_de)) throw new Error(`${nome}: falta \`depende_de\``);
    for (const a of r.depende_de) {
      if (!repos[a.repo]) throw new Error(`${nome}: aresta para repo desconhecido \`${a.repo}\``);
      if (!TIPOS[a.tipo]) throw new Error(`${nome} → ${a.repo}: tipo \`${a.tipo}\` inválido`);
      if (!/^\S+:\d+(-\d+)?$/.test(a.prova)) throw new Error(`${nome} → ${a.repo}: prova \`${a.prova}\` não é arquivo:linha`);
    }
  }
  return repos;
}

const celula = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
const id = (nome: string) => nome.replace(/-/g, '_');

/** "repo (tipo, tipo), repo (tipo)" na ordem do mapa. */
function agrupar(arestas: Array<{ repo: string; tipo: string }>): string {
  const por = new Map<string, string[]>();
  for (const a of arestas) por.set(a.repo, [...(por.get(a.repo) ?? []), TIPOS[a.tipo]!]);
  return [...por].map(([r, t]) => `${r} (${[...new Set(t)].join(', ')})`).join(', ') || '—';
}

/** O bloco inteiro, com os marcadores, para o README de `atual`. */
export function gerarBloco(mapa: Mapa, atual: string): string {
  if (!mapa[atual]) throw new Error(`repo \`${atual}\` não está no repos.yml`);
  const nomes = Object.keys(mapa);
  const linhas = nomes.map((n) => {
    const r = mapa[n]!;
    const usado = nomes.flatMap((o) => mapa[o]!.depende_de.filter((a) => a.repo === n).map((a) => ({ repo: o, tipo: a.tipo })));
    const nome = n === atual ? `**${n}**` : n;
    return `| ${nome} | ${celula(r.proposito)} | ${celula(r.como_e_usado)} | ${celula(agrupar(r.depende_de))} | ${celula(agrupar(usado))} |`;
  });
  const arestas: string[] = [];
  for (const n of nomes) {
    const por = new Map<string, string[]>();
    for (const a of mapa[n]!.depende_de) por.set(a.tipo, [...(por.get(a.tipo) ?? []), id(a.repo)]);
    for (const [tipo, alvos] of por) arestas.push(`  ${id(n)} -->|${TIPOS[tipo]}| ${[...new Set(alvos)].join(' & ')}`);
  }
  return [
    MARCA_INICIO,
    `<!-- Gerado do repos.yml do brabo por brabo-ci:scripts/ci/mapa-dos-repos.ts. Não edite à mão. -->`,
    `### Onde se encaixa`,
    '',
    `**${atual}** — ${mapa[atual]!.proposito} ${mapa[atual]!.como_e_usado}`,
    '',
    '| repo | propósito | como é usado | depende de | é usado por |',
    '|---|---|---|---|---|',
    ...linhas,
    '',
    '```mermaid',
    'flowchart LR',
    ...nomes.map((n) => `  ${id(n)}["${n}"]`),
    ...arestas,
    '  classDef atual fill:#fde68a,stroke:#b45309,color:#000',
    `  class ${id(atual)} atual`,
    '```',
    MARCA_FIM,
  ].join('\n');
}

/** Troca o bloco entre os marcadores; `null` se o README não os tem. */
export function trocarBloco(readme: string, bloco: string): string | null {
  const i = readme.indexOf(MARCA_INICIO);
  const f = readme.indexOf(MARCA_FIM);
  if (i < 0 || f < i) return null;
  return readme.slice(0, i) + bloco + readme.slice(f + MARCA_FIM.length);
}

async function carregar(fonte: string): Promise<string> {
  if (!/^https?:\/\//.test(fonte)) return readFileSync(fonte, 'utf8');
  const r = await fetch(fonte);
  if (!r.ok) throw new Error(`${fonte}: HTTP ${r.status}`);
  return r.text();
}

async function principal(): Promise<void> {
  const args = process.argv.slice(2);
  const valor = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const check = args.includes('--check');
  const repo = valor('--repo') ?? process.env.GITHUB_REPOSITORY?.split('/')[1];
  if (!repo) throw new Error('informe --repo <nome> (ou GITHUB_REPOSITORY)');
  const consumidos = new Set(['--repo', valor('--repo'), '--fonte', valor('--fonte'), '--check']);
  const readmes = args.filter((a) => !consumidos.has(a));
  const bloco = gerarBloco(lerMapa(await carregar(valor('--fonte') ?? FONTE)), repo);
  let falhou = false;
  for (const arq of readmes.length ? readmes : ['README.md']) {
    const novo = trocarBloco(readFileSync(arq, 'utf8'), bloco);
    if (novo === null) {
      console.log(`::error file=${arq},title=mapa-alinhado::sem os marcadores ${MARCA_INICIO} e ${MARCA_FIM}`);
      falhou = true;
    } else if (check) {
      if (novo !== readFileSync(arq, 'utf8')) {
        console.log(`::error file=${arq},title=mapa-alinhado::o bloco "Onde se encaixa" difere do repos.yml do brabo; rode mapa-dos-repos.ts sem --check e commite`);
        falhou = true;
      }
    } else writeFileSync(arq, novo);
  }
  if (falhou) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await principal();
}
