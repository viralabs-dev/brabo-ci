/**
 * refs-com-simbolo — num irmão, as citações `caminho:N` (`símbolo`) das RNs
 * (docs/business-rules*) têm de apontar para onde o símbolo mora (AT-782).
 * Ref INTERNA quebrada reprova; ref para OUTRO irmão só é listada (quem confere
 * é a subida da trava no `brabo`, ADR 0274). `--escrever` reancora o que dá.
 *
 * O núcleo puro (extrairRefs, conferir, veredito, novaLinha, reancorar) é CÓPIA
 * de `scripts/docs/refs-com-simbolo.mjs` do `viralabs-dev/brabo`, no commit
 * 120fa8c2f87c53877708f7884323899a67d3d093 (origin/dev em 07/11/2026), só com
 * tipos. Mudou lá (janela, padrão, distância)? Mude aqui: a divergência só
 * aparece na PR do bot da trava. Sem dependência; sintaxe apagável apenas.
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// ---------- núcleo copiado do brabo ----------

export const JANELA = 3;
export const DISTANCIA_MAXIMA_DE_REANCORA = 40;

const SIMBOLO = /^[A-Za-z_$][\w$]*[?!]?(?:\.[A-Za-z_$][\w$]*[?!]?)*(?:\(\)|\/\d+)?$/;

export interface Ref {
  caminho: string;
  linha: number;
  simbolo: string;
  linhaNoDoc: number;
  posNumero: number;
  tamNumero: number;
}

interface Bloco {
  inicio: number;
  offset: number;
  texto: string;
}

/** Os itens de um markdown: blocos separados por linha em branco ou `- `. */
function itens(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  let atual: string[] = [];
  let inicio = 1;
  const linhas = texto.split('\n');
  const offsetDaLinha = [0];
  for (const l of linhas) offsetDaLinha.push(offsetDaLinha.at(-1)! + l.length + 1);
  const bloco = (): Bloco => ({ inicio, offset: offsetDaLinha[inicio - 1]!, texto: atual.join('\n') });
  linhas.forEach((linha, i) => {
    const novoItem = /^\s*[-*]\s/.test(linha);
    if (linha.trim() === '' || novoItem) {
      if (atual.length > 0) blocos.push(bloco());
      atual = [];
      inicio = i + 1;
      if (linha.trim() === '') {
        inicio = i + 2;
        return;
      }
    }
    atual.push(linha);
  });
  if (atual.length > 0) blocos.push(bloco());
  return blocos;
}

/** Extrai as refs com símbolo de um texto de RN. */
export function extrairRefs(texto: string): Ref[] {
  const refs: Ref[] = [];
  const REF = /`([^`\s]*):(\d+)`/g;

  for (const bloco of itens(texto)) {
    let caminhoCorrente: string | null = null;
    for (const achado of bloco.texto.matchAll(REF)) {
      const [inteiro, caminhoCru, numero] = achado as unknown as [string, string, string];
      const inicioDaRef = achado.index;
      const fimDaRef = inicioDaRef + inteiro.length;

      if (caminhoCru !== '') {
        if (!/[./]/.test(caminhoCru)) continue;
        caminhoCorrente = caminhoCru;
      }
      const caminho = caminhoCru === '' ? caminhoCorrente : caminhoCru;
      if (caminho === null) continue;

      // Ref colada na anterior por `/` (`:640`/`:647`) é lista, não par.
      if (bloco.texto.slice(inicioDaRef - 2, inicioDaRef) === '`/') continue;

      const depois = /^\s*\(`([^`\n]+)`(.?)/.exec(bloco.texto.slice(fimDaRef));
      if (depois === null) continue;
      const [, simbolo, seguinte] = depois as unknown as [string, string, string];
      if (seguinte === '/') continue;
      if (!SIMBOLO.test(simbolo)) continue;

      const linhaNoDoc = bloco.inicio + bloco.texto.slice(0, inicioDaRef).split('\n').length - 1;
      const posNumero = bloco.offset + fimDaRef - 1 - numero.length;
      refs.push({ caminho, linha: Number(numero), simbolo, linhaNoDoc, posNumero, tamNumero: numero.length });
    }
  }
  return refs;
}

/** O que se procura na janela: o símbolo inteiro e o último segmento. */
export function candidatos(simbolo: string): string[] {
  const limpo = simbolo.replace(/\(\)$/, '').replace(/\/\d+$/, '');
  const ultimo = limpo.split('.').at(-1)!;
  return [...new Set([limpo, ultimo])];
}

function comoPalavra(nome: string): RegExp {
  const escapado = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\w$])${escapado}(?![\\w$])(?![?!][\\w(])`);
}

/** Confere uma ref contra as linhas do arquivo (janela de ±`janela`). */
export function conferir(
  linhasDoArquivo: string[],
  linha: number,
  simbolo: string,
  janela = JANELA,
): { bate: boolean; achadoEm: number | null } {
  const padroes = candidatos(simbolo).map(comoPalavra);
  const aparece = (i: number) =>
    i >= 1 && i <= linhasDoArquivo.length && padroes.some((p) => p.test(linhasDoArquivo[i - 1]!));

  for (let d = 0; d <= janela; d++) {
    if (aparece(linha - d) || aparece(linha + d)) return { bate: true, achadoEm: aparece(linha - d) ? linha - d : linha + d };
  }
  let achadoEm: number | null = null;
  for (let i = 1; i <= linhasDoArquivo.length; i++) {
    if (aparece(i) && (achadoEm === null || Math.abs(i - linha) < Math.abs(achadoEm - linha))) achadoEm = i;
  }
  return { bate: false, achadoEm };
}

/** `CEGO` (zero refs), `reprova` (não bate ou não resolve) ou `ok`. */
export function veredito({
  total,
  naoBatem,
  naoResolvidas,
}: {
  total: number;
  naoBatem: unknown[];
  naoResolvidas: unknown[];
}): 'ok' | 'CEGO' | 'reprova' {
  if (total === 0 && naoResolvidas.length === 0) return 'CEGO';
  if (naoBatem.length > 0 || naoResolvidas.length > 0) return 'reprova';
  return 'ok';
}

/** Para onde reancorar: a ocorrência mais próxima, única à distância e a ≤ 40 linhas. */
export function novaLinha(linhasDoArquivo: string[], linha: number, simbolo: string): number | null {
  const padroes = candidatos(simbolo).map(comoPalavra);
  const ocorrencias: number[] = [];
  linhasDoArquivo.forEach((l, i) => {
    if (padroes.some((p) => p.test(l))) ocorrencias.push(i + 1);
  });
  if (ocorrencias.length === 0) return null;
  const dist = (i: number) => Math.abs(i - linha);
  const menor = Math.min(...ocorrencias.map(dist));
  const maisPerto = ocorrencias.filter((i) => dist(i) === menor);
  if (menor > DISTANCIA_MAXIMA_DE_REANCORA) return null;
  return maisPerto.length === 1 ? maisPerto[0]! : null;
}

/** Reescreve, no texto de um doc, o número de cada ref com `novaLinha`. */
export function reancorar(
  texto: string,
  refs: { posNumero: number; tamNumero: number; novaLinha: number | null }[],
): string {
  let saida = texto;
  const reancoraveis = refs.filter((x) => x.novaLinha !== null).sort((a, b) => b.posNumero - a.posNumero);
  for (const r of reancoraveis) {
    saida = saida.slice(0, r.posNumero) + String(r.novaLinha) + saida.slice(r.posNumero + r.tamNumero);
  }
  return saida;
}

// ---------- o que é do irmão ----------

/** Cópia do `scripts/docs/fontes.yml` do brabo: o prefixo de cada repo na árvore unificada. */
export const PREFIXOS: Readonly<Record<string, string>> = {
  api: 'apps/api',
  engine: 'apps/engine',
  web: 'apps/web',
  runner: 'apps/runner',
  broker: 'apps/broker',
};

export type Classe = { tipo: 'interna'; noRepo: string } | { tipo: 'externa' };

/**
 * Interna: `apps/<eu>/…` (sem o prefixo) ou caminho do próprio repo cujo 1º
 * segmento existe na raiz (`src/…`). O resto (`apps/<outro>/`, `packages/`,
 * `install.sh` do brabo) é externo.
 */
export function classificar(caminho: string, repo: string, raizDoRepo: ReadonlySet<string>): Classe {
  const eu = PREFIXOS[repo];
  if (eu === undefined) throw new Error(`repo sem prefixo conhecido: ${repo}`);
  const limpo = caminho.replace(/^\.\//, '');
  if (limpo.startsWith(`${eu}/`)) return { tipo: 'interna', noRepo: limpo.slice(eu.length + 1) };
  if (limpo.startsWith('apps/') || limpo.startsWith('packages/')) return { tipo: 'externa' };
  return raizDoRepo.has(limpo.split('/')[0]!) ? { tipo: 'interna', noRepo: limpo } : { tipo: 'externa' };
}

/** O caminho exato, ou o ÚNICO versionado que termine nele; `null` se nenhum ou ambíguo. */
export function resolver(caminho: string, versionados: readonly string[]): string | null {
  if (versionados.includes(caminho)) return caminho;
  const achados = versionados.filter((v) => v.endsWith(`/${caminho}`));
  return achados.length === 1 ? achados[0]! : null;
}

/** As RNs fonte (pt-BR) do repo: o mesmo filtro do agregador. */
export const ehDocDeRn = (f: string) => /^docs\/business-rules.*\.md$/.test(f) && !f.includes('/i18n/');

type Achado = Ref & { doc: string; resolvido?: string; achadoEm?: number | null; novaLinha?: number | null };

export interface Resultado {
  total: number;
  batem: number;
  naoBatem: Achado[];
  naoResolvidas: Achado[];
  externas: Achado[];
}

export function aferir(
  raiz: string,
  repo: string,
  versionados: readonly string[],
  ler: (c: string) => string = (c) => readFileSync(join(raiz, c), 'utf8'),
): Resultado {
  const topo = new Set(versionados.map((v) => v.split('/')[0]!));
  const cache = new Map<string, string[]>();
  const linhasDe = (c: string) => {
    if (!cache.has(c)) cache.set(c, ler(c).split('\n'));
    return cache.get(c)!;
  };
  const r: Resultado = { total: 0, batem: 0, naoBatem: [], naoResolvidas: [], externas: [] };
  for (const doc of versionados.filter(ehDocDeRn)) {
    for (const ref of extrairRefs(ler(doc))) {
      const onde: Achado = { doc, ...ref };
      const cl = classificar(ref.caminho, repo, topo);
      if (cl.tipo === 'externa') {
        r.externas.push(onde);
        continue;
      }
      const resolvido = resolver(cl.noRepo, versionados);
      if (resolvido === null) {
        r.naoResolvidas.push(onde);
        continue;
      }
      r.total++;
      const { bate, achadoEm } = conferir(linhasDe(resolvido), ref.linha, ref.simbolo);
      if (bate) r.batem++;
      else r.naoBatem.push({ ...onde, resolvido, achadoEm, novaLinha: novaLinha(linhasDe(resolvido), ref.linha, ref.simbolo) });
    }
  }
  return r;
}

export function resumo(repo: string, r: Resultado, v: ReturnType<typeof veredito>, escreveu: number): string {
  const L = [`## Refs com símbolo (${repo}): ${v}`, ''];
  L.push(`${r.total} internas conferidas, ${r.batem} batem, ${r.naoBatem.length} não batem, ${r.naoResolvidas.length} sem arquivo único.`);
  if (v === 'CEGO') L.push('', 'Nenhuma ref interna extraída: a sintaxe das RNs mudou ou o check ficou sem objeto.');
  if (r.naoBatem.length + r.naoResolvidas.length > 0) {
    L.push('', '### Reprovam', '');
    for (const x of r.naoBatem) {
      const dica = x.novaLinha != null ? `reancora para :${x.novaLinha}` : x.achadoEm != null ? `corrija pelo SÍMBOLO (mais perto em :${x.achadoEm})` : 'corrija pelo SÍMBOLO (sumiu do arquivo)';
      L.push(`- ${x.doc}:${x.linhaNoDoc} → \`${x.caminho}:${x.linha}\` (\`${x.simbolo}\`): ${dica}`);
    }
    for (const x of r.naoResolvidas) L.push(`- ${x.doc}:${x.linhaNoDoc} → \`${x.caminho}\` (\`${x.simbolo}\`): arquivo não existe ou é ambíguo`);
  }
  L.push('', `${r.externas.length} externas (para outros irmãos), conferidas na subida da trava.`);
  if (r.externas.length > 0) {
    L.push('', '<details><summary>Externas</summary>', '');
    for (const x of r.externas.slice(0, 100)) L.push(`- ${x.doc}:${x.linhaNoDoc} → \`${x.caminho}:${x.linha}\` (\`${x.simbolo}\`)`);
    if (r.externas.length > 100) L.push(`- … e mais ${r.externas.length - 100}`);
    L.push('', '</details>');
  }
  if (escreveu > 0) L.push('', `\`--escrever\` reancorou ${escreveu} ref(s) no checkout.`);
  return L.join('\n') + '\n';
}

export function principal(argv: string[], env: NodeJS.ProcessEnv, cwd: string): number {
  const escrever = argv.includes('--escrever');
  const i = argv.indexOf('--repo');
  const nome = (i >= 0 ? argv[i + 1] : undefined) ?? (env.GITHUB_REPOSITORY ? basename(env.GITHUB_REPOSITORY) : basename(cwd));
  const repo = nome.replace(/^brabo-/, '');
  if (!(repo in PREFIXOS)) {
    console.log(`::error title=refs-com-simbolo::repo sem prefixo conhecido: ${nome}`);
    return 2;
  }
  const versionados = execFileSync('git', ['-C', cwd, 'ls-files'], { encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n').filter(Boolean);
  const r = aferir(cwd, repo, versionados);
  const v = veredito(r);

  let escreveu = 0;
  if (escrever) {
    for (const doc of new Set(r.naoBatem.map((x) => x.doc))) {
      const refs = r.naoBatem.filter((x) => x.doc === doc).map((x) => ({ posNumero: x.posNumero, tamNumero: x.tamNumero, novaLinha: x.novaLinha ?? null }));
      const antes = readFileSync(join(cwd, doc), 'utf8');
      const depois = reancorar(antes, refs);
      if (depois !== antes) {
        writeFileSync(join(cwd, doc), depois);
        escreveu += refs.filter((x) => x.novaLinha !== null).length;
      }
    }
  }

  const md = resumo(repo, r, v, escreveu);
  console.log(md);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, md);
  for (const x of [...r.naoBatem, ...r.naoResolvidas]) {
    console.log(`::error file=${x.doc},line=${x.linhaNoDoc},title=refs-com-simbolo::\`${x.caminho}:${x.linha}\` (\`${x.simbolo}\`) não aponta para o símbolo`);
  }
  if (v === 'CEGO') console.log('::error title=refs-com-simbolo::nenhuma ref interna extraída (CEGO)');
  return v === 'ok' ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(principal(process.argv.slice(2), process.env, process.cwd()));
}
