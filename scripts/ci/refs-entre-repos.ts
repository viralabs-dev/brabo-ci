/**
 * refs-entre-repos — confere as refs `caminho:N` (`símbolo`) das RNs que
 * cruzam a fronteira entre repos (AT-1029, F1; ADR 0274, itens 3 e 4).
 * `refs-com-simbolo.ts` só lista as externas; aqui elas são conferidas contra
 * a `dev` do vizinho (clone raso, só leitura), com o MESMO núcleo (janela ±3).
 *
 * Dois sentidos, no mesmo run:
 *  (a) DONO DA DOC: as refs `apps/<outro>/…` e `packages/…` das RNs deste repo.
 *      Ref NOVA errada (a tupla caminho:linha+símbolo não existia no mesmo doc
 *      da base da PR) REPROVA; a que já estava quebrada só AVISA. `--escrever`
 *      reancora as externas no checkout (o workflow sobe o `git diff`).
 *  (b) QUEM MOVEU O CÓDIGO: as refs das RNs dos vizinhos que apontam para
 *      `apps/<este>/…`. A que batia na base e não bate no head é causada pela
 *      PR: AVISO (nunca reprova) e um patch por repo dono em `--saida`
 *      (`git apply -p1` na raiz dele).
 *
 * Reusa `extrairRefs`, `conferir`, `novaLinha` e `reancorar` de
 * `refs-com-simbolo.ts`. Sem dependência; sintaxe apagável apenas.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { conferir, extrairRefs, novaLinha, reancorar, resolver, type Ref } from './refs-com-simbolo.ts';

export const ORG = 'viralabs-dev';
export const REPOS = ['api', 'engine', 'web', 'runner', 'broker', 'contracts'] as const;

/** Um repo lido em algum ponto do tempo: lista de arquivos e leitura (null se não existe). */
export interface Fonte {
  arquivos: string[];
  ler(caminho: string): string | null;
}

/** De quem é o caminho citado (tabela de `brabo:scripts/docs/fontes.yml`): `apps/<x>` e `packages`. */
export function donoDe(caminho: string): { repo: string; noRepo: string } | null {
  const c = caminho.replace(/^\.\//, '');
  const m = /^apps\/(api|engine|web|runner|broker)\/(.+)$/.exec(c);
  if (m) return { repo: m[1]!, noRepo: m[2]! };
  return c.startsWith('packages/') ? { repo: 'contracts', noRepo: c } : null;
}

/** As RNs fonte (pt-BR) de qualquer repo: docs/, packages/docs, deploy/docs, scripts/ci/docs. */
export const ehDocDeRn = (f: string) => /^(docs|packages\/docs|deploy\/docs|scripts\/ci\/docs)\/business-rules.*\.md$/.test(f) && !f.includes('/i18n/');

const git = (dir: string, args: string[]) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });

export function fonteGit(dir: string, rev: string): Fonte {
  const arquivos = git(dir, ['ls-tree', '-r', '--name-only', rev]).split('\n').filter(Boolean);
  return {
    arquivos,
    ler: (c) => {
      try {
        return git(dir, ['show', `${rev}:${c}`]);
      } catch {
        return null;
      }
    },
  };
}

export function fonteDisco(dir: string): Fonte {
  return {
    arquivos: git(dir, ['ls-files']).split('\n').filter(Boolean),
    ler: (c) => {
      try {
        return readFileSync(join(dir, c), 'utf8');
      } catch {
        return null;
      }
    },
  };
}

export interface Achado extends Ref {
  doc: string;
  /** Repo e caminho (dentro dele) para onde a ref aponta. */
  alvo: { repo: string; noRepo: string };
  novaLinha: number | null;
}

/** Confere uma ref contra uma fonte: `bate`; arquivo ausente ou ambíguo conta como não bate. */
function bate(f: Fonte, cache: Map<string, string[] | null>, alvo: { noRepo: string }, ref: Ref): { bate: boolean; nova: number | null } {
  const arq = resolver(alvo.noRepo, f.arquivos);
  if (arq === null) return { bate: false, nova: null };
  if (!cache.has(arq)) cache.set(arq, f.ler(arq)?.split('\n') ?? null);
  const linhas = cache.get(arq);
  if (!linhas) return { bate: false, nova: null };
  return conferir(linhas, ref.linha, ref.simbolo).bate ? { bate: true, nova: null } : { bate: false, nova: novaLinha(linhas, ref.linha, ref.simbolo) };
}

const chave = (r: Ref) => `${r.caminho}:${r.linha}|${r.simbolo}`;

export interface SentidoA {
  total: number;
  novas: Achado[];
  antigas: Achado[];
}

/** (a) As externas das RNs de `repo` contra a `dev` dos vizinhos; "nova" = tupla ausente do mesmo doc na base. */
export function sentidoA(repo: string, head: Fonte, base: Fonte, vizinho: (r: string) => Fonte): SentidoA {
  const saida: SentidoA = { total: 0, novas: [], antigas: [] };
  const caches = new Map<string, Map<string, string[] | null>>();
  for (const doc of head.arquivos.filter(ehDocDeRn)) {
    const noBase = new Set(extrairRefs(base.ler(doc) ?? '').map(chave));
    for (const ref of extrairRefs(head.ler(doc) ?? '')) {
      const alvo = donoDe(ref.caminho);
      if (alvo === null || alvo.repo === repo) continue;
      if (!caches.has(alvo.repo)) caches.set(alvo.repo, new Map());
      saida.total++;
      const r = bate(vizinho(alvo.repo), caches.get(alvo.repo)!, alvo, ref);
      if (r.bate) continue;
      (noBase.has(chave(ref)) ? saida.antigas : saida.novas).push({ ...ref, doc, alvo, novaLinha: r.nova });
    }
  }
  return saida;
}

export interface Quebra extends Achado {
  /** O repo cuja doc cita; `doc` é o caminho dentro dele. */
  dono: string;
}

/** (b) Refs das RNs dos vizinhos para ESTE repo que batiam na base e não batem no head. */
export function sentidoB(repo: string, base: Fonte, head: Fonte, vizinhos: Record<string, Fonte>): { total: number; quebras: Quebra[] } {
  const saida = { total: 0, quebras: [] as Quebra[] };
  const cb = new Map<string, string[] | null>();
  const ch = new Map<string, string[] | null>();
  for (const [dono, f] of Object.entries(vizinhos)) {
    if (dono === repo) continue;
    for (const doc of f.arquivos.filter(ehDocDeRn)) {
      for (const ref of extrairRefs(f.ler(doc) ?? '')) {
        const alvo = donoDe(ref.caminho);
        if (alvo?.repo !== repo) continue;
        saida.total++;
        if (!bate(base, cb, alvo, ref).bate) continue; // já estava quebrada: não é desta PR
        const h = bate(head, ch, alvo, ref);
        if (!h.bate) saida.quebras.push({ ...ref, doc, alvo, dono, novaLinha: h.nova });
      }
    }
  }
  return saida;
}

/** `git apply -p1` na raiz do repo dono: antes/depois de cada doc reancorado. Vazio se nada mudou. */
export function gerarPatch(mudancas: { caminho: string; antes: string; depois: string }[]): string {
  const tmp = mkdtempSync(join(tmpdir(), 'refs-patch-'));
  for (const m of mudancas) {
    for (const lado of ['a', 'b']) {
      const p = join(tmp, lado, m.caminho);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, lado === 'a' ? m.antes : m.depois);
    }
  }
  const r = spawnSync('git', ['diff', '--no-index', '--no-color', 'a', 'b'], { cwd: tmp, encoding: 'utf8', maxBuffer: 1 << 28 });
  // `git diff --no-index a b` escreve `a/a/<c>` e `b/b/<c>`: tira o diretório duplicado.
  return r.stdout.replaceAll('a/a/', 'a/').replaceAll('b/b/', 'b/');
}

/** Um patch por repo dono (só as quebras com nova linha), reancorando o doc dele. */
export function patchesDosDonos(quebras: Quebra[], vizinhos: Record<string, Fonte>): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const dono of new Set(quebras.map((q) => q.dono))) {
    const mudancas: { caminho: string; antes: string; depois: string }[] = [];
    for (const doc of new Set(quebras.filter((q) => q.dono === dono).map((q) => q.doc))) {
      const antes = vizinhos[dono]!.ler(doc)!;
      const refs = quebras.filter((q) => q.dono === dono && q.doc === doc);
      const depois = reancorar(antes, refs);
      if (depois !== antes) mudancas.push({ caminho: doc, antes, depois });
    }
    const p = mudancas.length > 0 ? gerarPatch(mudancas) : '';
    if (p !== '') saida[dono] = p;
  }
  return saida;
}

const dica = (x: Achado) => (x.novaLinha != null ? `reancora para :${x.novaLinha}` : 'corrija pelo SÍMBOLO');
const citacao = (x: Achado) => `${x.doc}:${x.linhaNoDoc} → \`${x.caminho}:${x.linha}\` (\`${x.simbolo}\`): ${dica(x)}`;

export interface Opcoes {
  repo: string;
  head: Fonte;
  base: Fonte;
  vizinho: (r: string) => Fonte;
  escrever?: (doc: string, texto: string) => void;
  saida?: string;
}

/** Roda os dois sentidos e devolve `{codigo, resumo, linhas}`. */
export function executar(o: Opcoes): { codigo: number; resumo: string; linhas: string[] } {
  const A = sentidoA(o.repo, o.head, o.base, o.vizinho);
  const vizinhos = Object.fromEntries(REPOS.filter((r) => r !== o.repo).map((r) => [r, o.vizinho(r)]));
  const B = sentidoB(o.repo, o.base, o.head, vizinhos);
  const linhas: string[] = [];
  const L = [`## Refs entre repos (${o.repo})`, ''];

  const nVizinhosComRn = Object.values(vizinhos).filter((f) => f.arquivos.some(ehDocDeRn)).length;
  if (nVizinhosComRn === 0) {
    linhas.push('::error title=refs-entre-repos::nenhum vizinho com RN lida (CEGO)');
    return { codigo: 1, resumo: L.concat('Nenhum vizinho com RN lida: o check ficou sem objeto (CEGO).').join('\n') + '\n', linhas };
  }

  L.push(`**Nas RNs deste repo:** ${A.total} refs para outros repos conferidas na \`dev\` deles; ${A.novas.length} novas erradas, ${A.antigas.length} já quebradas.`);
  for (const x of A.novas) linhas.push(`::error file=${x.doc},line=${x.linhaNoDoc},title=refs-entre-repos::\`${x.caminho}:${x.linha}\` (\`${x.simbolo}\`) não aponta para o símbolo em brabo-${x.alvo.repo}`);
  for (const x of A.antigas) linhas.push(`::warning file=${x.doc},line=${x.linhaNoDoc},title=refs-entre-repos::já quebrada: \`${x.caminho}:${x.linha}\` (\`${x.simbolo}\`) em brabo-${x.alvo.repo}`);
  if (A.novas.length > 0) L.push('', '### Reprovam (a PR acrescentou ou mudou)', '', ...A.novas.map((x) => `- ${citacao(x)}`));
  if (A.antigas.length > 0) L.push('', '<details><summary>Já estavam quebradas (só aviso)</summary>', '', ...A.antigas.slice(0, 100).map((x) => `- ${citacao(x)}`), '', '</details>');
  if (o.escrever) {
    const docs = new Set([...A.novas, ...A.antigas].map((x) => x.doc));
    for (const doc of docs) {
      const antes = o.head.ler(doc)!;
      const depois = reancorar(antes, [...A.novas, ...A.antigas].filter((x) => x.doc === doc));
      if (depois !== antes) o.escrever(doc, depois);
    }
  }

  L.push('', `**Nas RNs dos outros repos que citam este:** ${B.total} refs; esta PR quebra ${B.quebras.length}.`);
  if (B.quebras.length > 0) {
    for (const q of B.quebras) linhas.push(`::warning title=refs-entre-repos::esta PR quebra \`${q.caminho}:${q.linha}\` (\`${q.simbolo}\`) em brabo-${q.dono}:${q.doc}:${q.linhaNoDoc}`);
    L.push('', `### Esta PR quebra ${B.quebras.length} ref(s) da doc de outro repo`, '', ...B.quebras.slice(0, 100).map((q) => `- brabo-${q.dono}: ${citacao(q)}`));
    const patches = patchesDosDonos(B.quebras, vizinhos);
    for (const [dono, p] of Object.entries(patches)) {
      if (o.saida) {
        mkdirSync(o.saida, { recursive: true });
        writeFileSync(join(o.saida, `brabo-${dono}.patch`), p);
      }
      L.push('', `Abra a PR de reancoragem no brabo-${dono} junto com esta: \`git apply brabo-${dono}.patch\` na raiz dele (artefato \`refs-irmaos-patch\`).`);
    }
  }
  return { codigo: A.novas.length > 0 ? 1 : 0, resumo: L.join('\n') + '\n', linhas };
}

/** Os vizinhos: `--vizinhos <dir>` lê `origin/dev` dos clones irmãos; senão, clone raso da `dev` no GitHub. */
function vizinhoPadrao(irmaos: string | undefined): (r: string) => Fonte {
  const cache = new Map<string, Fonte>();
  return (r) => {
    if (!cache.has(r)) {
      let dir = irmaos ? join(irmaos, `brabo-${r}`) : '';
      let rev = 'origin/dev';
      if (!irmaos) {
        dir = mkdtempSync(join(tmpdir(), `viz-${r}-`));
        // Só os blobs citados descem (filter + sem checkout); repo público, sem credencial.
        execFileSync('git', ['clone', '--quiet', '--depth', '1', '--filter=blob:none', '--no-checkout', '-b', 'dev', `https://github.com/${ORG}/brabo-${r}.git`, dir], { stdio: ['ignore', 'ignore', 'inherit'] });
        rev = 'HEAD';
      }
      cache.set(r, fonteGit(dir, rev));
    }
    return cache.get(r)!;
  };
}

export function principal(argv: string[], env: NodeJS.ProcessEnv, cwd: string): number {
  const opt = (n: string) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : undefined);
  const nome = opt('--repo') ?? (env.GITHUB_REPOSITORY ? basename(env.GITHUB_REPOSITORY) : basename(cwd));
  const repo = nome.replace(/^brabo-/, '');
  if (!(REPOS as readonly string[]).includes(repo)) {
    console.log(`::error title=refs-entre-repos::repo desconhecido: ${nome}`);
    return 2;
  }
  try {
    const baseRef = opt('--base') ?? `origin/${env.GITHUB_BASE_REF || 'dev'}`;
    const mb = git(cwd, ['merge-base', baseRef, 'HEAD']).trim();
    const o: Opcoes = {
      repo,
      head: fonteDisco(cwd),
      base: fonteGit(cwd, mb),
      vizinho: vizinhoPadrao(opt('--vizinhos')),
      saida: opt('--saida'),
      escrever: argv.includes('--escrever') ? (doc, texto) => writeFileSync(join(cwd, doc), texto) : undefined,
    };
    const r = executar(o);
    console.log(r.resumo);
    r.linhas.forEach((l) => console.log(l));
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, r.resumo);
    return r.codigo;
  } catch (e) {
    console.log(`::error title=refs-entre-repos::não consegui ler a base ou os vizinhos: ${(e as Error).message.split('\n')[0]}`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(principal(process.argv.slice(2), process.env, process.cwd()));
}
