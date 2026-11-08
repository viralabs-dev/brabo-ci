/**
 * arestas-dos-repos — prova mecânica do `repos.yml` do `brabo` (AT-825 parte b, ADR 0281): cada aresta `depende_de`
 * corresponde ao que os arquivos dizem.
 *
 * Confere (1) a `prova: "<arquivo>:N"` de cada aresta: o arquivo existe no repo que declara e a linha N (ou N-M)
 * menciona o repo de destino; (2) o `REPOS` do `clonar-tudo.sh` do brabo-workspace contra os repos do mapa;
 * (3) o `irmaos.lock` contra as arestas `doc` do brabo; (4) o `componentes.json` contra as arestas do brabo.
 *
 * Uso: `node scripts/ci/arestas-dos-repos.ts [--fonte <url|caminho>] [--raiz <pasta com um checkout por repo>]`
 * Sem `--raiz` lê `raw.githubusercontent.com/<dono>/<repo>/dev/<arquivo>`. Sai com 1 se algo falha.
 *
 * Sintaxe apagável apenas (o Node executa este `.ts` por type stripping).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DONO } from './dono.ts';
import { FONTE, lerMapa, type Mapa } from './mapa-dos-repos.ts';

/** O arquivo de um repo: texto, ou `null` se não existe. */
export type Leitor = (repo: string, arquivo: string) => Promise<string | null>;

// O destino aparece pelo nome; contracts e qa também pelo que o código realmente escreve (pacotes, gatilho do portão).
const ALIAS: Record<string, string> = {
  'brabo-contracts': 'brabo-shared|brabo-docker-port|@brabo/shared',
  'brabo-qa': 'qa-e2e|funcionalidades\\.yml',
};
const menciona = (linha: string, alvo: string) =>
  new RegExp(`(^|[^\\w-])(${alvo}${ALIAS[alvo] ? `|${ALIAS[alvo]}` : ''})($|[^\\w-])`).test(linha);

/** Cada `prova` existe e a(s) linha(s) citada(s) mencionam o destino. */
export async function provarArestas(mapa: Mapa, ler: Leitor): Promise<{ ok: number; falhas: string[] }> {
  const falhas: string[] = [];
  let ok = 0;
  for (const [de, r] of Object.entries(mapa)) {
    for (const a of r.depende_de) {
      const rotulo = `${de} → ${a.repo} (${a.tipo}) ${a.prova}`;
      const [, arq, ini, fim] = /^(\S+):(\d+)(?:-(\d+))?$/.exec(a.prova)!;
      const texto = await ler(de, arq!);
      if (texto === null) { falhas.push(`${rotulo}: arquivo não existe em ${de}`); continue; }
      const linhas = texto.split('\n').slice(Number(ini) - 1, Number(fim ?? ini));
      if (!linhas.length || linhas.every((l) => !l)) falhas.push(`${rotulo}: linha fora do arquivo (${texto.split('\n').length} linhas)`);
      else if (!linhas.some((l) => menciona(l, a.repo))) falhas.push(`${rotulo}: a linha não menciona ${a.repo}: ${linhas[0]!.trim().slice(0, 100)}`);
      else ok++;
    }
  }
  return { ok, falhas };
}

const dif = (rotulo: string, esperado: Set<string>, real: Set<string>, falhas: string[]) => {
  for (const n of real) if (!esperado.has(n)) falhas.push(`${rotulo}: \`${n}\` está lá e não no repos.yml`);
  for (const n of esperado) if (!real.has(n)) falhas.push(`${rotulo}: \`${n}\` está no repos.yml e não lá`);
};
const alvos = (mapa: Mapa, de: string, tipos: string[]) =>
  new Set(mapa[de]?.depende_de.filter((a) => tipos.includes(a.tipo)).map((a) => a.repo));

/** REPOS do workspace, irmaos.lock e componentes.json contra o mapa. */
export async function conferirListas(mapa: Mapa, ler: Leitor): Promise<string[]> {
  const falhas: string[] = [];
  const nomes = Object.keys(mapa);
  const ws = await ler('brabo-workspace', 'clonar-tudo.sh');
  const repos = /^REPOS="([^"]*)"/m.exec(ws ?? '')?.[1];
  if (repos === undefined) falhas.push('clonar-tudo.sh: sem a linha REPOS="..."');
  else {
    // "pasta=remoto" (brabo-old=brabo-legacy) é o histórico, fora do mapa.
    const lista = new Set(repos.split(/\s+/).filter((e) => e && !e.includes('=')));
    dif('clonar-tudo.sh REPOS', new Set(nomes.filter((n) => n !== 'brabo-workspace')), lista, falhas);
    dif('brabo-workspace → clone', alvos(mapa, 'brabo-workspace', ['codigo']), lista, falhas);
  }
  const lock = await ler('brabo', 'irmaos.lock');
  if (lock === null) falhas.push('brabo/irmaos.lock não existe');
  else {
    const lista = new Set(lock.split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split(' ')[0]!));
    dif('irmaos.lock', alvos(mapa, 'brabo', ['doc']), lista, falhas);
  }
  const comp = await ler('brabo', 'componentes.json');
  if (comp === null) falhas.push('brabo/componentes.json não existe');
  else {
    const lista = new Set([...comp.matchAll(/"repo":\s*"[^/"]+\/([^"]+)"/g)].map((m) => m[1]!));
    for (const n of lista) if (!alvos(mapa, 'brabo', ['imagem', 'codigo', 'contrato']).has(n)) falhas.push(`componentes.json: \`${n}\` sem aresta imagem/código/contrato no repos.yml`);
    for (const n of alvos(mapa, 'brabo', ['imagem'])) if (!lista.has(n)) falhas.push(`repos.yml: aresta imagem brabo → ${n} sem entrada em componentes.json`);
  }
  return falhas;
}

function leitor(raiz: string | undefined): Leitor {
  if (raiz) return async (repo, arq) => (existsSync(join(raiz, repo, arq)) ? readFileSync(join(raiz, repo, arq), 'utf8') : null);
  return async (repo, arq) => {
    const r = await fetch(`https://raw.githubusercontent.com/${DONO}/${repo}/dev/${arq}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`${repo}/${arq}: HTTP ${r.status}`);
    return r.text();
  };
}

async function principal(): Promise<void> {
  const args = process.argv.slice(2);
  const valor = (f: string) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);
  const fonte = valor('--fonte') ?? FONTE;
  const yaml = /^https?:\/\//.test(fonte) ? await (await fetch(fonte)).text() : readFileSync(fonte, 'utf8');
  const mapa = lerMapa(yaml);
  const ler = leitor(valor('--raiz'));
  const { ok, falhas } = await provarArestas(mapa, ler);
  falhas.push(...(await conferirListas(mapa, ler)));
  console.log(`arestas-dos-repos: ${ok} arestas provadas, ${falhas.length} falha(s)`);
  for (const f of falhas) console.log(`::error title=arestas-dos-repos::${f}`);
  if (falhas.length) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await principal();
}
