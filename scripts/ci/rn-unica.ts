/**
 * rn-unica — a PR que DEFINE uma regra de negócio (RN) cujo número já está
 * DEFINIDO na `dev` de outro repo da organização reprova (AT-1029, F2). Caso
 * real de 26/11: RN-1507, 1508, 1516 e 1517 definidas na api e no engine; só o
 * agregador `brabo` viu, depois dos dois merges.
 *
 * "Definir" é o CABEÇALHO da regra (`### RN-NNN — …`, a regex do
 * `brabo:scripts/docs/regras-de-negocio.mjs`), nunca a citação no texto.
 * Só conta o que a PR ACRESCENTA (números do head que a base não tinha): a
 * duplicata herdada não trava o repo. Os vizinhos são lidos na `dev` por clone
 * raso (`--depth 1 --filter=blob:none`; repos públicos, sem token), e só quando
 * a PR acrescenta alguma RN. Não há registro único de números. Duas PRs abertas
 * ao mesmo tempo continuam sem se ver: a segunda a mergear é a pega.
 *
 * Uso (na raiz do repo, com a base buscada): `node rn-unica.ts --repo <nome>
 * [--base origin/dev] [--vizinhos <dir> --vizinhos-ref origin/dev]`. Com
 * `--vizinhos`, lê `<dir>/<repo>` em vez de clonar (testes e prova local).
 *
 * Sintaxe apagável apenas (o Node executa este `.ts` por type stripping).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DONO } from './dono.ts';

/** Onde cada repo DEFINE as próprias RNs (pathspec literal; o `i18n` e as fixtures ficam de fora). */
export const RAIZES: Readonly<Record<string, readonly string[]>> = {
  'brabo-api': ['docs/business-rules/api.md', 'docs/business-rules/api/'],
  'brabo-engine': ['docs/business-rules/engine.md', 'docs/business-rules/engine/'],
  'brabo-web': ['docs/business-rules/web.md', 'docs/business-rules/web/'],
  'brabo-runner': ['docs/business-rules/runner.md', 'docs/business-rules/runner/'],
  'brabo-broker': ['docs/business-rules/'],
  'brabo-contracts': ['packages/docs/business-rules/'],
  'brabo-infra': ['deploy/docs/business-rules/'],
  'brabo-ci': ['scripts/ci/docs/business-rules/'],
  // O agregador copia as RNs dos irmãos em docs/business-rules/<x>/; as dele são só as de `produto`.
  brabo: ['docs/business-rules/produto.md', 'docs/business-rules/produto/'],
};

export interface Definicao {
  numero: number;
  arquivo: string;
  linha: number;
}

const CABECALHO = '^#{2,4} +RN-[0-9]+\\b';

/** Lê a saída de `git grep -n <ref>` (`ref:arquivo:linha:texto`) e devolve só os cabeçalhos de RN. */
export function definicoesDe(saida: string, ref: string): Definicao[] {
  const achados: Definicao[] = [];
  for (const l of saida.split('\n')) {
    if (!l.startsWith(`${ref}:`)) continue;
    const m = /^(.+?):(\d+):#{2,4} +RN-(\d+)\b/.exec(l.slice(ref.length + 1));
    if (m) achados.push({ arquivo: m[1]!, linha: Number(m[2]), numero: Number(m[3]) });
  }
  return achados;
}

/** Lê os cabeçalhos de RN de `ref` num clone git (`dir`), só nas raízes do `repo`. */
export function lerDefinicoes(dir: string, ref: string, repo: string): Definicao[] {
  const raizes = RAIZES[repo];
  if (!raizes) throw new Error(`repo desconhecido: ${repo}`);
  let saida = '';
  try {
    saida = execFileSync('git', ['-C', dir, 'grep', '-n', '-E', CABECALHO, ref, '--', ...raizes], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    // git grep sai 1 sem achados; qualquer outra saída é falha de verdade.
    if ((e as { status?: number }).status !== 1) throw e;
  }
  return definicoesDe(saida, ref);
}

/** Números que o head define e a base não definia (o que a PR acrescenta). */
export function acrescentadas(base: readonly Definicao[], head: readonly Definicao[]): Definicao[] {
  const antes = new Set(base.map((d) => d.numero));
  return head.filter((d) => !antes.has(d.numero));
}

export interface Colisao {
  numero: number;
  aqui: Definicao;
  repo: string;
  la: Definicao;
}

export function colisoes(novas: readonly Definicao[], vizinhos: Readonly<Record<string, readonly Definicao[]>>): Colisao[] {
  const achados: Colisao[] = [];
  for (const aqui of novas) {
    for (const [repo, defs] of Object.entries(vizinhos)) {
      const la = defs.find((d) => d.numero === aqui.numero);
      if (la) achados.push({ numero: aqui.numero, aqui, repo, la });
    }
  }
  return achados;
}

/** O próximo número livre: o maior definido em qualquer repo (head incluído) mais um. */
export function proximoLivre(todas: ReadonlyArray<readonly Definicao[]>): number {
  return Math.max(0, ...todas.flatMap((ds) => ds.map((d) => d.numero))) + 1;
}

/** Mensagens de erro (uma por colisão), cada uma com o próximo número livre distinto. */
export function mensagens(cs: readonly Colisao[], livre: number): string[] {
  const dados = new Map<number, number>();
  for (const c of cs) if (!dados.has(c.numero)) dados.set(c.numero, livre + dados.size);
  return cs.map(
    (c) =>
      `RN-${c.numero} (definida em ${c.aqui.arquivo}:${c.aqui.linha}) já existe DEFINIDA na dev de ${c.repo}: ` +
      `${c.la.arquivo}:${c.la.linha}. Renumere esta para RN-${dados.get(c.numero)} (próximo livre) ` +
      `ou, se for a mesma regra, deixe a definição só no repo dono e cite aqui.`,
  );
}

const VIZINHOS = Object.keys(RAIZES);

function clonar(repo: string, destino: string): string {
  const dir = join(destino, repo);
  execFileSync(
    'git',
    ['clone', '--quiet', '--depth', '1', '--filter=blob:none', '--no-checkout', '-b', 'dev', `https://github.com/${DONO}/${repo}.git`, dir],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  return dir;
}

function arg(nome: string, padrao: string): string {
  const i = process.argv.indexOf(nome);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : padrao;
}

export function main(): number {
  const repo = arg('--repo', '');
  if (!repo || !RAIZES[repo]) {
    console.error(`uso: rn-unica.ts --repo <${VIZINHOS.join('|')}> [--base origin/dev] [--vizinhos <dir> --vizinhos-ref origin/dev]`);
    return 2;
  }
  const base = arg('--base', 'origin/dev');
  const head = lerDefinicoes('.', 'HEAD', repo);
  const novas = acrescentadas(lerDefinicoes('.', base, repo), head);
  if (novas.length === 0) {
    console.log(`rn-unica: a PR não acrescenta RN em ${repo}; nada a cruzar.`);
    return 0;
  }
  const local = arg('--vizinhos', '');
  const refLocal = arg('--vizinhos-ref', 'origin/dev');
  const tmp = mkdtempSync(join(tmpdir(), 'rn-unica-'));
  const vizinhos: Record<string, Definicao[]> = {};
  try {
    for (const outro of VIZINHOS.filter((r) => r !== repo)) {
      try {
        const dir = local ? join(local, outro) : clonar(outro, tmp);
        if (local && !existsSync(dir)) throw new Error(`${dir} não existe`);
        vizinhos[outro] = lerDefinicoes(dir, local ? refLocal : 'HEAD', outro);
      } catch (e) {
        console.log(`::warning::rn-unica: não consegui ler a dev de ${outro}: ${(e as Error).message.split('\n')[0]}`);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  if (Object.keys(vizinhos).length === 0) {
    console.log('::error::rn-unica: nenhum vizinho legível; não dá para conferir (CEGO).');
    return 1;
  }
  const achadas = colisoes(novas, vizinhos);
  if (achadas.length === 0) {
    console.log(`rn-unica: ${novas.length} RN nova(s) em ${repo}, nenhuma colide com a dev de ${Object.keys(vizinhos).length} vizinhos.`);
    return 0;
  }
  const livre = proximoLivre([head, ...Object.values(vizinhos)]);
  for (const m of mensagens(achadas, livre)) console.log(`::error::${m}`);
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(main());
