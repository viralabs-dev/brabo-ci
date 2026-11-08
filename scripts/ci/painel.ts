/**
 * painel — uma run que compõe as runs de uma mudança espalhada pelos repos (AT-792, RN-1054 a RN-1056).
 *
 * Mudança = componente conexo do grafo `Depende-de` (nos dois sentidos) a partir de uma ou mais PRs, ou da PR
 * de uma tag. O painel junta, por PR, as runs do head SHA, do merge SHA (carimbo, tag, release) e o E2E do
 * brabo-qa (`c=`), acompanha a cada 60 s e escreve tabela + Mermaid no Summary. NUNCA reprova e NÃO publica
 * check nas PRs (decisão do dono, 07/11/2026): a ligação de volta é a linha "Painel da mudança" dos Vínculos.
 *
 * Modos (argv[2]): `chave` (calcula a chave, saída `chave` e `inicio`), `painel` (acompanha e escreve o Summary),
 * `avisar` (remetente: dispara o painel, com debounce). Env: GH_TOKEN (App), GITHUB_REPOSITORY, PR_NUMERO,
 * PAINEL_REPO/PAINEL_PR (dispatch), PAINEL_PRS (`repo#n ...`), PAINEL_TAG (`repo@vX`), PAINEL_CHAVE, PAINEL_INICIO.
 * Sintaxe apagável apenas (type stripping).
 */
import { createHash } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { DONO, PROFUNDIDADE_MAXIMA, REPOS, chave as chaveRef, lerDeclaracoes, type Ref } from './dependencias-de-merge.ts';
import { URL_OK } from './vinculos.ts';

export const QUIETUDE_MS = 3 * 60_000;
export const TETO_MS = 45 * 60_000;
export const INTERVALO_MS = 60_000;
export const INTERVALO_LENTO_MS = 5 * 60_000;
export const LIMITE_RATE_BAIXO = 500;

export interface Pr {
  ref: Ref;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  corpo: string;
  criada: string;
  head: string;
  merge: string | null;
}
export interface Run {
  id: number;
  name: string;
  display_title: string;
  status: string;
  conclusion: string | null;
  run_attempt: number;
  run_started_at: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  head_sha: string;
  head_branch: string | null;
  event: string;
}
export type Fase = 'PR' | 'E2E' | 'merge' | 'tag';
export interface Linha {
  repo: string;
  fase: Fase;
  run: Run;
}
export type Kind = 'ok' | 'falha' | 'andamento' | 'pulou' | 'outro';

// ---- componente ----

export type BuscarPr = (ref: Ref) => Promise<Pr | null>;
export type Citadoras = (ref: Ref) => Promise<Ref[]>;

/** BFS pelos dois sentidos do `Depende-de`; ciclo não trava (conjunto de vistos), profundidade 5. */
export async function componente(inicio: Ref[], buscar: BuscarPr, citadoras: Citadoras): Promise<Pr[]> {
  const vistos = new Map<string, Pr>();
  const tentados = new Set<string>();
  let fila = inicio.map((ref) => ({ ref, prof: 0 }));
  while (fila.length > 0) {
    const { ref, prof } = fila.shift() as { ref: Ref; prof: number };
    const k = chaveRef(ref);
    if (tentados.has(k) || prof > PROFUNDIDADE_MAXIMA || !REPOS.includes(ref.repo)) continue;
    tentados.add(k);
    const pr = await buscar(ref);
    if (!pr) continue;
    vistos.set(k, pr);
    const vizinhos = [...lerDeclaracoes(pr.corpo).deps, ...(await citadoras(ref))];
    fila = fila.concat(vizinhos.map((v) => ({ ref: v, prof: prof + 1 })));
  }
  return [...vistos.values()].sort((a, b) => chaveRef(a.ref).localeCompare(chaveRef(b.ref)));
}

const curtoRepo = (r: string): string => r.replace(/^brabo-/, '');

/** `ci#29 api#65 … m=1a2b3c4d`: curta para o título; o hash cobre a lista completa. */
export function chaveDaMudanca(prs: Pr[]): string {
  const lista = prs.map((p) => chaveRef(p.ref)).sort();
  const hash = createHash('sha1').update(lista.join('\n')).digest('hex').slice(0, 8);
  return `${prs.map((p) => `${curtoRepo(p.ref.repo)}#${p.ref.n}`).join(' ')} m=${hash}`;
}

/** O componente cresceu (ou encolheu) desde que este painel começou: um painel novo assume. */
export const superado = (chaveInicial: string, prs: Pr[]): boolean => chaveDaMudanca(prs) !== chaveInicial;

/** Tag → PR: dos PRs que contêm o commit da tag, o mergeado. */
export function prDaTag(repo: string, pulls: { number: number; merged_at: string | null }[]): Ref | null {
  const p = pulls.find((x) => x.merged_at);
  return p && REPOS.includes(repo) ? { repo, n: p.number } : null;
}

// ---- runs da mudança ----

const E2E_TITULO = /^(?:E2E|Regressivo) ← viralabs-dev\/([a-z-]+)#(\d+) · ([0-9a-f]{7}) · /;
const TAG = /^v\d+\.\d+\.\d+/;

/** `porSha`: runs listadas por `repo@sha` (head e merge); `qa`: runs do `e2e-pr.yml` do brabo-qa. */
export function runsDaMudanca(prs: Pr[], porSha: Record<string, Run[]>, qa: Run[]): Linha[] {
  const melhores = new Map<string, Linha>();
  const guardar = (l: Linha, k: string): void => {
    const atual = melhores.get(k);
    const novo = l.run.run_attempt > (atual?.run.run_attempt ?? 0) || (l.run.run_attempt === atual?.run.run_attempt && l.run.id > atual.run.id);
    if (!atual || novo) melhores.set(k, l);
  };
  for (const pr of prs) {
    const { repo, n } = pr.ref;
    for (const run of porSha[`${repo}@${pr.head}`] ?? []) guardar({ repo, fase: 'PR', run }, `${repo}|PR|${run.name}|${run.display_title}`);
    for (const run of pr.merge ? (porSha[`${repo}@${pr.merge}`] ?? []) : []) {
      const fase: Fase = TAG.test(run.head_branch ?? '') ? 'tag' : 'merge';
      guardar({ repo, fase, run }, `${repo}|${fase}|${run.name}|${run.display_title}`);
    }
    for (const run of qa) {
      const m = E2E_TITULO.exec(run.display_title);
      if (m?.[1] === repo && Number(m[2]) === n && pr.head.startsWith(m[3] as string) && run.created_at >= pr.criada) guardar({ repo, fase: 'E2E', run }, `${repo}|E2E|${run.display_title.replace(/ · c=.*/, '')}`);
    }
  }
  return [...melhores.values()].sort((a, b) => a.run.created_at.localeCompare(b.run.created_at) || a.run.id - b.run.id);
}

// ---- Markdown ----

export function kind(r: Pick<Run, 'status' | 'conclusion'>): Kind {
  if (r.status !== 'completed') return 'andamento';
  if (r.conclusion === 'success') return 'ok';
  if (r.conclusion === 'skipped') return 'pulou';
  if (r.conclusion === 'failure' || r.conclusion === 'timed_out' || r.conclusion === 'startup_failure') return 'falha';
  return 'outro';
}
const EMOJI: Record<Kind, string> = { ok: '✅', falha: '❌', andamento: '⏳', pulou: '⏭️', outro: '⚪' };
const emojiDe = (r: Run): string => (r.conclusion === 'cancelled' ? '🚫' : r.conclusion === 'timed_out' ? '⌛' : r.conclusion === 'action_required' ? '❔' : EMOJI[kind(r)]);

// Texto livre de run: sem | ` < > [ ] " nem quebra de linha. Parênteses cabem na célula (não vira link).
const CELULA = /^[A-Za-z0-9À-ÿ ._#@:/·←→()-]{1,90}$/;
const celula = (v: string): string => (CELULA.test(v) ? v : '?');
const urlOk = (v: string): string => (URL_OK.test(v) ? v : '');

export function duracao(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
}

export interface OpcoesPainel {
  agora: number;
  chave: string;
  /** Texto fixo do rodapé (superado, teto, aguarda merge); vem do código, não da API. */
  nota?: string;
}

const duracaoDe = (r: Run, agora: number): number => (r.status === 'completed' ? Date.parse(r.updated_at) : agora) - Date.parse(r.run_started_at ?? r.created_at);
const PIOR: Kind[] = ['falha', 'andamento', 'outro', 'ok', 'pulou'];

export function montarPainel(prs: Pr[], linhas: Linha[], o: OpcoesPainel): string {
  const cont: Record<Kind, number> = { ok: 0, falha: 0, andamento: 0, pulou: 0, outro: 0 };
  for (const l of linhas) cont[kind(l.run)]++;
  const resumo = (['ok', 'falha', 'andamento', 'pulou', 'outro'] as Kind[]).filter((k) => cont[k] > 0).map((k) => `${EMOJI[k]} ${cont[k]}`);
  const inicio = Math.min(...linhas.map((l) => Date.parse(l.run.created_at)));
  const fim = Math.max(...linhas.map((l) => (l.run.status === 'completed' ? Date.parse(l.run.updated_at) : o.agora)));
  const out: string[] = [`## Painel da mudança${resumo.length ? ` · ${resumo.join(' · ')}` : ''}`, ''];
  out.push(`Chave: \`${/^[A-Za-z0-9#= -]{1,300}$/.test(o.chave) ? o.chave : '?'}\``);
  if (linhas.length > 0) out.push(`Duração total: ${duracao(fim - inicio)}`);
  out.push(`Atualizado às ${new Date(o.agora).toISOString().slice(11, 19)} UTC`, '');

  for (const pr of prs) {
    const { repo, n } = pr.ref;
    out.push(`### ${repo}#${n} (${pr.state})`, '');
    const minhas = linhas.filter((l) => l.repo === repo);
    const vistas = minhas.filter((l) => kind(l.run) !== 'pulou');
    const puladas = minhas.filter((l) => kind(l.run) === 'pulou');
    const tabela = (ls: Linha[]): string[] => [
      '| Fase | Workflow | Status | Duração | Run |',
      '|---|---|---|---|---|',
      ...ls.map((l) => {
        const url = urlOk(l.run.html_url);
        const andamento = kind(l.run) === 'andamento';
        const status = `${emojiDe(l.run)}${andamento && o.nota?.startsWith('teto') ? ` em andamento há ${duracao(duracaoDe(l.run, o.agora))}` : ''}`;
        const nome = celula(l.fase === 'E2E' ? l.run.display_title.replace(/ · c=.*/, '') : l.run.name);
        return `| ${l.fase} | ${nome} | ${status} | ${duracao(duracaoDe(l.run, o.agora))} | ${url ? `[${l.run.id}](${url})` : String(l.run.id)} |`;
      }),
    ];
    out.push(...(vistas.length ? tabela(vistas) : ['_Nenhuma run encontrada ainda._']), '');
    if (puladas.length) out.push('<details><summary>Puladas</summary>', '', ...tabela(puladas), '', '</details>', '');
  }

  // Mermaid: um subgraph por repo, nós por fase (pior status da fase), aresta pelo Depende-de.
  const mm: string[] = ['flowchart LR'];
  const no = (i: number, f: Fase): string => `r${i}_${f}`;
  prs.forEach((pr, i) => {
    mm.push(`  subgraph s${i}["${pr.ref.repo}#${pr.ref.n}"]`);
    const fases: Fase[] = ['PR', 'E2E', 'merge', 'tag'];
    const presentes = fases.filter((f) => linhas.some((l) => l.repo === pr.ref.repo && l.fase === f));
    for (const f of presentes) {
      const ks = linhas.filter((l) => l.repo === pr.ref.repo && l.fase === f).map((l) => kind(l.run));
      mm.push(`    ${no(i, f)}["${f}"]:::${PIOR.find((k) => ks.includes(k)) ?? 'outro'}`);
    }
    presentes.slice(1).forEach((f, j) => mm.push(`    ${no(i, presentes[j] as Fase)} --> ${no(i, f)}`));
    if (presentes.length === 0) mm.push(`    ${no(i, 'PR')}["sem runs"]:::pulou`);
    mm.push('  end');
  });
  prs.forEach((pr, i) => {
    for (const d of lerDeclaracoes(pr.corpo).deps) {
      const j = prs.findIndex((p) => chaveRef(p.ref) === chaveRef(d));
      if (j >= 0) mm.push(`  s${j} -.-> s${i}`);
    }
  });
  mm.push(
    '  classDef ok fill:#2da44e,color:#fff',
    '  classDef falha fill:#cf222e,color:#fff',
    '  classDef andamento fill:#bf8700,color:#fff',
    '  classDef pulou fill:#8c959f,color:#fff',
    '  classDef outro fill:#6e7781,color:#fff',
  );
  out.push('```mermaid', ...mm, '```', '');
  if (o.nota) out.push(`> ${o.nota.replace(/^(teto|quietude|aguarda-merge|superado): /, '')}`, '');
  return out.join('\n');
}

// ---- parada ----

export interface EstadoParada {
  inicio: number;
  agora: number;
  /** Última vez que apareceu run nova ou mudou o status de alguma. */
  ultimaNovidade: number;
  runs: Pick<Run, 'status'>[];
  todasMergeadas: boolean;
}
export function terminou(e: EstadoParada): { fim: boolean; motivo?: 'teto' | 'quietude' | 'aguarda-merge'; emAndamento: number } {
  const emAndamento = e.runs.filter((r) => r.status !== 'completed').length;
  if (e.agora - e.inicio >= TETO_MS) return { fim: true, motivo: 'teto', emAndamento };
  if (emAndamento > 0) return { fim: false, emAndamento };
  // PR ainda não mergeada: o pós-merge entra por um dispatch novo (evento `closed`).
  if (!e.todasMergeadas) return { fim: true, motivo: 'aguarda-merge', emAndamento };
  if (e.agora - e.ultimaNovidade >= QUIETUDE_MS) return { fim: true, motivo: 'quietude', emAndamento };
  return { fim: false, emAndamento };
}
export const intervalo = (restante: number | null): number => (restante !== null && restante < LIMITE_RATE_BAIXO ? INTERVALO_LENTO_MS : INTERVALO_MS);

/** Debounce do remetente: já há painel na fila/andamento com `repo#n` no título (token inteiro). */
export function jaTemPainel(titulos: string[], ref: Ref): boolean {
  const re = new RegExp(`(^|[\\s·])${ref.repo}#${ref.n}($|[\\s·])`);
  return titulos.some((t) => re.test(t));
}

// ---- GitHub com ETag ----

export interface Cache {
  [caminho: string]: { etag: string; corpo: unknown };
}
export interface Resposta {
  corpo: unknown;
  restante: number | null;
  naoModificado: boolean;
}
type Fetch = (url: string, init: { headers: Record<string, string>; method?: string; body?: string }) => Promise<Pick<Response, 'ok' | 'status' | 'headers' | 'json' | 'text'>>;

/** GET com `If-None-Match`; 304 devolve o corpo guardado (e não conta no rate limit). */
export async function buscarComEtag(caminho: string, cache: Cache, token: string, f: Fetch = fetch as unknown as Fetch): Promise<Resposta> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
  const guardado = cache[caminho];
  if (guardado) headers['If-None-Match'] = guardado.etag;
  const r = await f(`https://api.github.com/${caminho}`, { headers });
  const rest = r.headers.get('x-ratelimit-remaining');
  const restante = rest === null ? null : Number(rest);
  if (r.status === 304 && guardado) return { corpo: guardado.corpo, restante, naoModificado: true };
  if (!r.ok) throw new Error(`GitHub GET ${caminho}: ${r.status}`);
  const corpo = await r.json();
  const etag = r.headers.get('etag');
  if (etag) cache[caminho] = { etag, corpo };
  return { corpo, restante, naoModificado: false };
}

// ---- CLI (só aqui há rede; o spec cobre o que está acima) ----

const REF_TEXTO = /^(?:viralabs-dev\/)?(brabo(?:-[a-z]+)?)#(\d{1,7})$/;
const TAG_TEXTO = /^(brabo(?:-[a-z]+)?)@(v\d+\.\d+\.\d+[A-Za-z0-9.+-]{0,40})$/;

export function lerRefs(texto: string): Ref[] {
  const refs: Ref[] = [];
  for (const t of texto.split(/[\s,]+/).filter(Boolean)) {
    const m = REF_TEXTO.exec(t);
    if (m && REPOS.includes(m[1] as string)) refs.push({ repo: m[1] as string, n: Number(m[2]) });
  }
  return refs;
}

function api(token: string) {
  const cache: Cache = {};
  let restante: number | null = null;
  const get = async (caminho: string): Promise<any> => {
    const r = await buscarComEtag(caminho, cache, token);
    restante = r.restante;
    return r.corpo;
  };
  return { get, restante: () => restante };
}

async function prsDoInicio(inicio: Ref[], get: (c: string) => Promise<any>): Promise<Pr[]> {
  const buscar: BuscarPr = async (ref) => {
    try {
      const p = await get(`repos/${DONO}/${ref.repo}/pulls/${ref.n}`);
      return { ref, state: p.merged ? 'MERGED' : p.state === 'open' ? 'OPEN' : 'CLOSED', corpo: p.body ?? '', criada: p.created_at, head: p.head.sha, merge: p.merged ? p.merge_commit_sha : null };
    } catch {
      return null; // PR inexistente ou ilegível: fora do componente, o painel não reprova
    }
  };
  const citadoras: Citadoras = async (ref) => {
    const q = encodeURIComponent(`org:${DONO} is:pr in:body "${chaveRef(ref)}"`);
    const r = await get(`search/issues?q=${q}&per_page=100`);
    const achados: Ref[] = [];
    for (const i of r.items as { number: number; body: string | null; repository_url: string }[]) {
      const alvo = { repo: i.repository_url.split('/').pop() as string, n: i.number };
      if (lerDeclaracoes(i.body ?? '').deps.some((d) => chaveRef(d) === chaveRef(ref))) achados.push(alvo);
    }
    return achados;
  };
  return componente(inicio, buscar, citadoras);
}

async function inicioDoEvento(env: NodeJS.ProcessEnv, get: (c: string) => Promise<any>): Promise<Ref[]> {
  const tag = TAG_TEXTO.exec(env.PAINEL_TAG ?? '');
  if (tag) {
    const [, repo, nome] = tag as unknown as [string, string, string];
    let ref = await get(`repos/${DONO}/${repo}/git/ref/tags/${nome}`);
    if (ref.object.type === 'tag') ref = { object: await get(`repos/${DONO}/${repo}/git/tags/${ref.object.sha}`).then((t) => t.object) };
    const pr = prDaTag(repo, await get(`repos/${DONO}/${repo}/commits/${ref.object.sha}/pulls`));
    return pr ? [pr] : [];
  }
  const dispatch = env.PAINEL_REPO ? lerRefs(`${env.PAINEL_REPO}#${env.PAINEL_PR}`) : [];
  return [...dispatch, ...lerRefs(env.PAINEL_PRS ?? '')];
}

async function coletar(prs: Pr[], get: (c: string) => Promise<any>): Promise<Linha[]> {
  const porSha: Record<string, Run[]> = {};
  for (const pr of prs) {
    for (const sha of [pr.head, pr.merge].filter((s): s is string => !!s)) {
      const r = await get(`repos/${DONO}/${pr.ref.repo}/actions/runs?head_sha=${sha}&per_page=100`);
      porSha[`${pr.ref.repo}@${sha}`] = r.workflow_runs;
    }
  }
  const desde = prs.map((p) => p.criada).sort()[0] ?? '2020-01-01T00:00:00Z';
  const qa = await get(`repos/${DONO}/brabo-qa/actions/workflows/e2e-pr.yml/runs?event=repository_dispatch&created=%3E%3D${desde}&per_page=100`);
  return runsDaMudanca(prs, porSha, qa.workflow_runs);
}

const saida = (nome: string, valor: string): void => {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${nome}=${valor}\n`);
};
const resumo = (md: string): void => {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
  else console.log(md);
};
const dormir = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function principal(modo: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const { get, restante } = api(env.GH_TOKEN ?? '');
  if (modo === 'avisar') {
    const eu: Ref = { repo: (env.GITHUB_REPOSITORY ?? '').split('/')[1] ?? '', n: Number(env.PR_NUMERO) };
    const titulos: string[] = [];
    for (const status of ['queued', 'in_progress']) {
      const r = await get(`repos/${DONO}/brabo-ci/actions/workflows/painel.yml/runs?status=${status}&per_page=100`);
      titulos.push(...r.workflow_runs.map((x: Run) => x.display_title));
    }
    if (jaTemPainel(titulos, eu)) return console.log(`${chaveRef(eu)}: já há painel em andamento, não disparei outro`);
    const r = await fetch(`https://api.github.com/repos/${DONO}/brabo-ci/dispatches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json' },
      body: JSON.stringify({ event_type: 'painel', client_payload: { repo: eu.repo, pr: String(eu.n) } }),
    });
    return console.log(`${chaveRef(eu)}: painel disparado (${r.status})`);
  }
  const inicio = await inicioDoEvento(env, get);
  if (inicio.length === 0) throw new Error('nenhuma PR válida no evento');
  if (modo === 'chave') {
    const prs = await prsDoInicio(inicio, get);
    saida('chave', chaveDaMudanca(prs));
    saida('inicio', prs.map((p) => chaveRef(p.ref).replace(`${DONO}/`, '')).join(' '));
    return;
  }
  if (modo !== 'painel') throw new Error(`modo desconhecido: ${modo}`);
  const comeco = Date.now();
  let ultima = comeco;
  let assinatura = '';
  for (;;) {
    let prs: Pr[] = [];
    let linhas: Linha[] = [];
    let nota: string | undefined;
    try {
      prs = await prsDoInicio(inicio, get);
      linhas = await coletar(prs, get);
    } catch (e) {
      console.log(`::warning::painel: volta falhou (${(e as Error).message}), tento de novo`);
      if (Date.now() - comeco < TETO_MS) {
        await dormir(intervalo(restante()));
        continue;
      }
    }
    const agora = Date.now();
    if (prs.length > 0 && env.PAINEL_CHAVE && superado(env.PAINEL_CHAVE, prs)) {
      nota = 'superado: a mudança cresceu e um painel novo assume.';
      resumo(montarPainel(prs, linhas, { agora, chave: env.PAINEL_CHAVE, nota }));
      return;
    }
    const sig = linhas.map((l) => `${l.run.id}:${l.run.run_attempt}:${l.run.status}`).join(',');
    if (sig !== assinatura) ultima = agora;
    assinatura = sig;
    const t = terminou({ inicio: comeco, agora, ultimaNovidade: ultima, runs: linhas.map((l) => l.run), todasMergeadas: prs.every((p) => p.state !== 'OPEN') });
    if (t.fim) {
      nota = { teto: `teto: passaram 45 min; ${t.emAndamento} run(s) seguem em andamento.`, quietude: 'quietude: tudo terminou e nada novo apareceu em 3 min.', 'aguarda-merge': 'aguarda-merge: a PR ainda não foi mergeada; o merge acorda um painel novo.' }[t.motivo as string];
      resumo(montarPainel(prs, linhas, { agora, chave: env.PAINEL_CHAVE ?? chaveDaMudanca(prs), nota }));
      return;
    }
    await dormir(intervalo(restante()));
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  // O painel nunca reprova: qualquer erro vira aviso e saída 0.
  principal(process.argv[2] ?? '').catch((e: Error) => console.log(`::warning::painel: ${e.message}`));
}
