/**
 * qa-regressivo-lembrete — RN-1032 / ADR 0268 item 7 (AT-852): a PR para a `dev` toca a funcionalidade X e
 * nenhuma spec `@f-X` mudou (nem na `dev` do brabo-qa desde a base, nem numa PR do qa citada por `Depende-de:`).
 * O App comenta UMA vez (marca `<!-- lembrete-regressivo -->`), edita a cada push, e erro nunca reprova.
 * Sintaxe apagável apenas (o Node executa este `.ts` por type stripping).
 */

import { DONO } from './dono.ts';
import { lerDeclaracoes } from './dependencias-de-merge.ts';
import type { Modo } from './qa-regressivo-selecao.ts';

export const MARCA = '<!-- lembrete-regressivo -->';
const DOC = 'https://github.com/viralabs-dev/brabo/blob/dev/scripts/ci/docs/explanation/regressivo-por-funcionalidade.md';
const TAG = /@f-([a-z0-9-]+)/g;

/** Ids `@f-<id>` citados no texto de uma spec. */
export const tagsDe = (texto: string): string[] => [...texto.matchAll(TAG)].map((m) => m[1] as string);

/** Só lembra com funcionalidades específicas: nunca no catálogo inteiro, nem no qa, nem no contracts. */
export function faltando(e: { repo: string; modo: Modo; tocadas: string[]; comSpecMudada: Iterable<string> }): string[] {
  if (e.modo !== 'funcionalidades' || e.repo === 'brabo-qa' || e.repo === 'brabo-contracts') return [];
  const mudadas = new Set(e.comSpecMudada);
  // Se alguma tocada teve spec mudada, o autor já cuidou do regressivo: não lembra.
  return e.tocadas.some((i) => mudadas.has(i)) ? [] : e.tocadas;
}

export function corpoDoLembrete(ids: string[]): string {
  const lista = ids.map((i) => `\`${i}\``).join(', ');
  return `${MARCA}\nEsta PR toca ${lista}; o regressivo ${ids.length > 1 ? 'dessas funcionalidades' : 'dela'} não mudou. Se o comportamento mudou, abra a PR no brabo-qa e cite com \`Depende-de: viralabs-dev/brabo-qa#<n>\`; se não, responda no card por quê. É só um lembrete: não bloqueia o merge. [Como funciona](${DOC}).`;
}

export const corpoResolvido = (): string => `${MARCA}\nO regressivo das funcionalidades tocadas por esta PR já mudou. Lembrete resolvido.`;

export type Acao = { tipo: 'criar' | 'editar'; corpo: string } | null;

/** Comentário único: cria só se há o que lembrar; edita se já existe (inclusive para dizer que resolveu). */
export function acaoDoLembrete(ids: string[], existente: { id: number; corpo: string } | null): Acao {
  const corpo = ids.length > 0 ? corpoDoLembrete(ids) : corpoResolvido();
  if (!existente) return ids.length > 0 ? { tipo: 'criar', corpo } : null;
  return existente.corpo === corpo ? null : { tipo: 'editar', corpo };
}

export interface Api {
  /** JSON da API do GitHub (token do App). */
  gh: (caminho: string, init?: RequestInit) => Promise<any>;
  /** Texto cru de um arquivo do brabo-qa numa ref. */
  texto: (caminho: string, ref: string) => Promise<string>;
}

const QA = `${DONO}/brabo-qa`;
const ehSpec = (f: string) => f.startsWith('e2e/testes/');

/** Ids com spec mudada: commits da `dev` do qa desde a base da PR + PRs do qa em `Depende-de:`. */
export async function idsComSpecMudada(api: Api, dono: string, nome: string, pr: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const prAtual = await api.gh(`repos/${dono}/${nome}/pulls/${pr}`);
  const base = await api.gh(`repos/${dono}/${nome}/commits/${prAtual.base.sha}`);
  const commits = (await api.gh(`repos/${QA}/commits?sha=dev&path=e2e/testes&since=${base.commit.committer.date}&per_page=100`)) as { sha: string }[];
  for (const c of commits) {
    const detalhe = await api.gh(`repos/${QA}/commits/${c.sha}`);
    for (const f of detalhe.files as { filename: string }[]) if (ehSpec(f.filename)) tagsDe(await api.texto(f.filename, 'dev').catch(() => '')).forEach((i) => ids.add(i));
  }
  for (const dep of lerDeclaracoes(prAtual.body ?? '').deps.filter((d) => d.repo === 'brabo-qa')) {
    const depPr = await api.gh(`repos/${QA}/pulls/${dep.n}`);
    const arquivos = (await api.gh(`repos/${QA}/pulls/${dep.n}/files?per_page=100`)) as { filename: string }[];
    for (const f of arquivos.filter((a) => ehSpec(a.filename))) tagsDe(await api.texto(f.filename, depPr.head.sha).catch(() => '')).forEach((i) => ids.add(i));
  }
  return ids;
}

/** Cria ou edita o comentário único. Qualquer erro vira aviso. */
export async function lembrar(api: Api, e: { dono: string; nome: string; pr: string; modo: Modo; tocadas: string[]; aviso: (m: string) => void }): Promise<void> {
  try {
    if (e.modo !== 'funcionalidades' || e.nome === 'brabo-qa' || e.nome === 'brabo-contracts') return;
    const ids = faltando({ repo: e.nome, modo: e.modo, tocadas: e.tocadas, comSpecMudada: await idsComSpecMudada(api, e.dono, e.nome, e.pr) });
    const lista: { id: number; body: string; user: { type: string } }[] = [];
    for (let p = 1; ; p++) {
      const pagina = await api.gh(`repos/${e.dono}/${e.nome}/issues/${e.pr}/comments?per_page=100&page=${p}`);
      lista.push(...pagina);
      if (pagina.length < 100) break;
    }
    const achado = lista.find((c) => c.user.type === 'Bot' && c.body.startsWith(MARCA));
    const acao = acaoDoLembrete(ids, achado ? { id: achado.id, corpo: achado.body } : null);
    if (!acao) return;
    const corpo = JSON.stringify({ body: acao.corpo });
    if (acao.tipo === 'criar') await api.gh(`repos/${e.dono}/${e.nome}/issues/${e.pr}/comments`, { method: 'POST', body: corpo });
    else await api.gh(`repos/${e.dono}/${e.nome}/issues/comments/${achado!.id}`, { method: 'PATCH', body: corpo });
  } catch (err) {
    e.aviso(`lembrete-regressivo: falhou (${(err as Error).message.slice(0, 200)}), gatilho segue`);
  }
}
