/**
 * qa-regressivo-selecao — dos arquivos tocados pela PR e do catálogo de funcionalidades
 * (`brabo-qa/funcionalidades.yml`) tira o modo do regressivo e as funcionalidades a rodar (AT-769).
 * Regras de arquivo transversal, nesta ordem: 1 nada, 2 catálogo inteiro, 3 sem dono (smoke + aviso).
 * Sintaxe apagável apenas (o Node executa este `.ts` por type stripping).
 */

import picomatch from 'picomatch';
import { parse } from 'yaml';

export interface Funcionalidade {
  id: string;
  status?: 'ativa' | 'aposentada';
  /** repo (`api` ou `brabo-api`) -> globs */
  caminhos?: Record<string, string[]>;
}

export type Modo = 'nenhum' | 'funcionalidades' | 'completo';

export interface Selecao {
  modo: Modo;
  funcionalidades: string[];
  semDono: string[];
  /** Por que cada funcionalidade entrou (AT-791): até `MAX_MOTIVOS` por id, de até `MAX_MOTIVO` caracteres. */
  motivos: Record<string, string[]>;
  /** As que o MAPA liga à PR (sem o smoke da regra 3): separa "a PR toca" de "só rodou" na recomendação. */
  tocadas: string[];
}

export const MAX_MOTIVOS = 5;
export const MAX_MOTIVO = 200;

export interface EntradaSelecao {
  /** Nome do repo da PR, com ou sem o prefixo `brabo-`. */
  repo: string;
  arquivos: string[];
  catalogo: Funcionalidade[];
  /** brabo-qa: ids das tags `@f-*` dos specs alterados (caminho -> ids). Sem a entrada, spec alterado vale o catálogo inteiro. */
  tagsDosSpecs?: Record<string, string[]>;
}

/** Funcionalidades do smoke da regra 3. */
export const SMOKE = ['instalacao', 'autenticacao'];

const opcoes = { dot: true };
const casa = (globs: string[]) => picomatch(globs, opcoes);

// Regra 1: nada. O `.github/**` perde só para o próprio chamador `qa-e2e.yml`.
const nadaGlobs = casa(['docs/**', '**/*.md', 'CHANGELOG.md', '.github/**', 'test/**', '**/*.{test,spec}.{ts,tsx}', 'test/**/*.exs', '.claude/**']);
const ehNada = (f: string) => f !== '.github/workflows/qa-e2e.yml' && nadaGlobs(f);

// Regra 2: catálogo inteiro (vale para qualquer repo, exceto a restrição por repo logo abaixo).
const inteiroGeral = casa([
  'pnpm-lock.yaml', '**/pnpm-lock.yaml', 'package.json', '**/package.json', 'mix.lock', 'mix.exs',
  'Dockerfile', '**/Dockerfile*', 'docker/docker-compose.install.yml',
  'src/main.ts', 'lib/engine/application.ex', 'src/main.tsx', 'src/router.tsx',
  'e2e/suporte/**', 'e2e/playwright.config.ts',
]);
const inteiroPorRepo: Record<string, (f: string) => boolean> = {
  api: casa(['src/db/**']),
  web: casa(['src/lib/**']),
  engine: casa(['config/**']),
};

const semPrefixo = (repo: string) => repo.replace(/^brabo-/, '');

export function selecionar(e: EntradaSelecao): Selecao {
  const repo = semPrefixo(e.repo);
  const ativas = e.catalogo.filter((f) => f.status !== 'aposentada');
  const todas = ativas.map((f) => f.id);
  // Só a TAG sobe no contracts; o regressivo roda na PR do consumidor.
  const motivos: Record<string, string[]> = {};
  const motivar = (id: string, m: string) => {
    const l = (motivos[id] ??= []);
    const t = m.slice(0, MAX_MOTIVO);
    if (l.length < MAX_MOTIVOS && !l.includes(t)) l.push(t);
  };
  const completo = (porque: string): Selecao => {
    todas.forEach((i) => motivar(i, `catálogo inteiro: ${porque}`));
    return { modo: 'completo', funcionalidades: todas, semDono: [], motivos, tocadas: todas };
  };
  if (repo === 'contracts') return { modo: 'nenhum', funcionalidades: [], semDono: [], motivos: {}, tocadas: [] };

  const globsDe = (f: Funcionalidade) =>
    Object.entries(f.caminhos ?? {}).filter(([r]) => semPrefixo(r) === repo).flatMap(([, g]) => g);
  // Globs do catálogo SEM `dot`: é a semântica do `path.matchesGlob` que o brabo-qa usa para validar o mapa.
  const donos = ativas.map((f) => ({ id: f.id, casa: picomatch(globsDe(f)), tem: globsDe(f).length > 0 }));

  const achadas = new Set<string>();
  const semDono: string[] = [];
  for (const arquivo of e.arquivos) {
    const spec = repo === 'qa' && arquivo.startsWith('e2e/testes/');
    // Spec do qa vem antes da regra 1 (que casaria `*.spec.ts`): vale as tags dele.
    if (!spec && ehNada(arquivo)) continue;
    if (spec) {
      const ids = e.tagsDosSpecs?.[arquivo];
      if (!ids) return completo(`spec sem tag ${arquivo}`);
      ids.filter((i) => todas.includes(i)).forEach((i) => (achadas.add(i), motivar(i, `${repo}: ${arquivo}`)));
      continue;
    }
    if (inteiroGeral(arquivo) || inteiroPorRepo[repo]?.(arquivo)) return completo(arquivo);
    const donosDoArquivo = donos.filter((d) => d.tem && d.casa(arquivo));
    if (donosDoArquivo.length === 0) semDono.push(arquivo);
    donosDoArquivo.forEach((d) => (achadas.add(d.id), motivar(d.id, `${repo}: ${arquivo}`)));
  }
  const tocadas = todas.filter((i) => achadas.has(i));
  if (semDono.length > 0) {
    SMOKE.filter((i) => todas.includes(i)).forEach((i) => (achadas.add(i), semDono.forEach((a) => motivar(i, `smoke: arquivo sem dono ${a}`))));
  }
  const funcionalidades = todas.filter((i) => achadas.has(i));
  return { modo: funcionalidades.length > 0 ? 'funcionalidades' : 'nenhum', funcionalidades, semDono, motivos, tocadas };
}

/** Lê o `funcionalidades.yml` (lista na raiz ou sob a chave `funcionalidades`). */
export function lerCatalogo(texto: string): Funcionalidade[] {
  const doc = parse(texto) as Funcionalidade[] | { funcionalidades?: Funcionalidade[] } | null;
  const lista = Array.isArray(doc) ? doc : doc?.funcionalidades;
  if (!Array.isArray(lista)) throw new Error('funcionalidades.yml sem a lista de funcionalidades');
  return lista;
}
