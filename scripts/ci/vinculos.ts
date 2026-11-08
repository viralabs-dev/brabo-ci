/**
 * vinculos — escreve a tabela "Vínculos" e o diagrama Mermaid no Summary do
 * run: quem originou (repo, PR, SHA, ator, run), os irmãos que o run leu
 * (`repo@SHA`) e para onde o resultado vai (destinos e runs disparados).
 *
 * Todo valor vem de fora (payload, evento, nome de branch): cada um passa por
 * regex antes de entrar no Markdown ou no Mermaid; o que não casa vira `?` e
 * um `::warning::`. O helper NUNCA reprova o job: qualquer erro vira aviso e
 * saída 0.
 *
 * Sintaxe apagável apenas (o Node executa este `.ts` por type stripping, ≥ 22.18).
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

export interface Origem {
  repo: string;
  pr?: string | number;
  sha: string;
  ator: string;
  run_url?: string;
  evento?: string;
}

export interface Entrada {
  origem: Origem;
  /** Este run (repo, SHA e URL do run). */
  este: { repo: string; sha: string; run_url: string };
  irmaos: { repo: string; sha: string }[];
  destino: { rotulo: string; url: string }[];
  disparados: { rotulo: string; url: string }[];
}

const REPO = /^viralabs-dev\/brabo(-[a-z]+)?$/;
const SHA = /^[0-9a-f]{40}$/;
const PR = /^[0-9]{1,7}$/;
export const URL_OK = /^https:\/\/github\.com\/viralabs-dev\/[A-Za-z0-9._\-/#?=&%]{0,200}$/;
const ATOR = /^[A-Za-z0-9-]{1,39}(\[bot\])?$/;
const EVENTO = /^[a-z_]{1,40}$/;
// Rótulo livre: só letras, dígitos e pontuação inofensiva (sem | ` < > [ ] ( ) " \n).
const ROTULO = /^[A-Za-z0-9À-ÿ ._#@:/·←→-]{1,60}$/;

export type Aviso = (msg: string) => void;

function ok(valor: unknown, re: RegExp, nome: string, aviso: Aviso): string {
  if (typeof valor === 'string' && re.test(valor)) return valor;
  if (typeof valor === 'number' && re.test(String(valor))) return String(valor);
  if (valor !== undefined && valor !== '') aviso(`vinculos: ${nome} inválido, ignorado`);
  return '?';
}

const link = (texto: string, url: string): string => (url === '?' ? '?' : `[${texto}](${url})`);
const curto = (sha: string): string => (sha === '?' ? '?' : sha.slice(0, 7));

/** Monta o Markdown (tabela + Mermaid). Puro: não toca disco nem rede. */
export function montar(e: Entrada, aviso: Aviso = () => {}): string {
  const o = e.origem ?? ({} as Origem);
  const repoO = ok(o.repo, REPO, 'origem.repo', aviso);
  const shaO = ok(o.sha, SHA, 'origem.sha', aviso);
  const prO = o.pr === undefined || o.pr === '' ? '' : ok(o.pr, PR, 'origem.pr', aviso);
  const atorO = ok(o.ator, ATOR, 'origem.ator', aviso);
  const evO = o.evento === undefined ? '?' : ok(o.evento, EVENTO, 'origem.evento', aviso);
  const urlO = o.run_url === undefined ? '?' : ok(o.run_url, URL_OK, 'origem.run_url', aviso);
  const repoE = ok(e.este?.repo, REPO, 'este.repo', aviso);
  const shaE = ok(e.este?.sha, SHA, 'este.sha', aviso);
  const urlE = ok(e.este?.run_url, URL_OK, 'este.run_url', aviso);

  const commit = (repo: string, sha: string): string =>
    repo === '?' || sha === '?' ? curto(sha) : link(curto(sha), `https://github.com/${repo}/commit/${sha}`);
  const refPr = (repo: string): string =>
    prO === '' ? evO : repo === '?' || prO === '?' ? `#${prO}` : link(`#${prO}`, `https://github.com/${repo}/pull/${prO}`);

  const linhas: string[][] = [
    ['Origem', repoO, `${refPr(repoO)} · ${atorO}`, commit(repoO, shaO), link('run', urlO)],
    ['Este run', repoE, '', commit(repoE, shaE), link('run', urlE)],
  ];
  const ids: { id: string; texto: string }[] = [];
  for (const [i, ir] of (e.irmaos ?? []).entries()) {
    const r = ok(ir.repo, REPO, 'irmão.repo', aviso);
    const s = ok(ir.sha, SHA, 'irmão.sha', aviso);
    linhas.push(['Irmão', r, '', commit(r, s), '']);
    ids.push({ id: `I${i}`, texto: `${r.replace('viralabs-dev/', '')}@${curto(s)}` });
  }
  const extras = (papel: string, lista: { rotulo: string; url: string }[], pre: string) =>
    (lista ?? []).forEach((d, i) => {
      const rotulo = ok(d.rotulo, ROTULO, `${papel}.rótulo`, aviso);
      const url = ok(d.url, URL_OK, `${papel}.url`, aviso);
      linhas.push([papel, '', rotulo, '', link('abrir', url)]);
      ids.push({ id: `${pre}${i}`, texto: rotulo });
    });
  extras('Disparado', e.disparados, 'X');
  extras('Destino', e.destino, 'D');

  const tabela = [
    '## Vínculos',
    '',
    '| Papel | Repo | Ref / PR | SHA | Run |',
    '|---|---|---|---|---|',
    ...linhas.map((l) => `| ${l.join(' | ')} |`),
  ];
  const nome = (r: string): string => r.replace('viralabs-dev/', '');
  const arestas = [`O["${nome(repoO)}${prO && prO !== '?' ? `#${prO}` : ''} · ${curto(shaO)} · ${atorO}"] --> E["${nome(repoE)} · este run"]`];
  for (const n of ids) {
    const forma = n.id.startsWith('D') ? `${n.id}(["${n.texto}"])` : `${n.id}["${n.texto}"]`;
    arestas.push(n.id.startsWith('D') ? `E --> ${forma}` : n.id.startsWith('X') ? `E -.-> ${forma}` : `${forma} --> E`);
  }
  return [...tabela, '', '```mermaid', 'flowchart LR', ...arestas.map((a) => `  ${a}`), '```', ''].join('\n');
}

const linhasDe = (v: string | undefined): string[] =>
  (v ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

function paresRotuloUrl(v: string | undefined): { rotulo: string; url: string }[] {
  return linhasDe(v).map((l) => {
    const i = l.indexOf('|');
    return i < 0 ? { rotulo: l, url: '' } : { rotulo: l.slice(0, i).trim(), url: l.slice(i + 1).trim() };
  });
}

/** `owner/repo@sha` literal, ou caminho de checkout (lê HEAD e `origin`). */
export function resolverIrmao(linha: string, aviso: Aviso): { repo: string; sha: string } {
  const lit = /^([^@\s]+)@([0-9a-f]{40})$/.exec(linha);
  if (lit) return { repo: lit[1] ?? '?', sha: lit[2] ?? '?' };
  try {
    const git = (...a: string[]): string => execFileSync('git', ['-C', linha, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const m = /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(git('remote', 'get-url', 'origin'));
    return { repo: m?.[1] ?? '?', sha: git('rev-parse', 'HEAD') };
  } catch {
    aviso('vinculos: irmão ilegível, ignorado');
    return { repo: '?', sha: '?' };
  }
}

/** Origem automática: este próprio run (PR usa o head, não o merge commit). */
export function origemAuto(env: NodeJS.ProcessEnv, aviso: Aviso): Origem {
  let sha = env.GITHUB_SHA ?? '';
  let pr: string | undefined;
  let run_url = `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`;
  try {
    const ev = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH ?? '', 'utf8'));
    if (ev.pull_request) {
      pr = String(ev.pull_request.number);
      sha = ev.pull_request.head?.sha ?? sha;
    }
  } catch {
    // sem evento legível: fica com o que as variáveis dão
  }
  if (env.GITHUB_REF_TYPE === 'tag') {
    // O carimbo escreve `Carimbo: <url do run>` na mensagem da tag anotada.
    try {
      const msg = execFileSync('git', ['for-each-ref', `refs/tags/${env.GITHUB_REF_NAME}`, '--format=%(contents)'], { encoding: 'utf8' });
      const m = /^Carimbo: (\S+)$/m.exec(msg);
      if (m?.[1]) run_url = m[1];
      else aviso('vinculos: tag sem a linha "Carimbo:"');
    } catch {
      aviso('vinculos: não consegui ler a tag');
    }
  }
  return { repo: env.GITHUB_REPOSITORY ?? '', pr, sha, ator: env.GITHUB_ACTOR ?? '', run_url, evento: env.GITHUB_EVENT_NAME };
}

/** Link de volta ao painel (AT-792): só no modo auto com PR. O `run-name` do painel traz `<repo>#<n>`, e o filtro do Actions casa esse texto. */
export function linhaDoPainel(origem: Origem): { rotulo: string; url: string } | null {
  const m = /^viralabs-dev\/(brabo(?:-[a-z]+)?)$/.exec(origem.repo ?? '');
  if (!m || !PR.test(String(origem.pr ?? ''))) return null;
  return { rotulo: 'Painel da mudança', url: `https://github.com/viralabs-dev/brabo-ci/actions/workflows/painel.yml?query=${m[1]}%23${origem.pr}` };
}

export function main(env: NodeJS.ProcessEnv = process.env): void {
  const aviso: Aviso = (m) => console.log(`::warning::${m}`);
  try {
    let origem: Origem;
    let auto = !env.VINCULOS_ORIGEM?.trim();
    try {
      origem = auto ? origemAuto(env, aviso) : JSON.parse(env.VINCULOS_ORIGEM as string);
    } catch {
      aviso('vinculos: origem não é JSON, usei a automática');
      origem = origemAuto(env, aviso);
      auto = true;
    }
    const painel = auto ? linhaDoPainel(origem) : null;
    const md = montar(
      {
        origem,
        este: { repo: env.GITHUB_REPOSITORY ?? '', sha: env.GITHUB_SHA ?? '', run_url: `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` },
        irmaos: linhasDe(env.VINCULOS_IRMAOS).map((l) => resolverIrmao(l, aviso)),
        destino: paresRotuloUrl(env.VINCULOS_DESTINO),
        disparados: [...paresRotuloUrl(env.VINCULOS_DISPARADOS), ...(painel ? [painel] : [])],
      },
      aviso,
    );
    const arquivo = `${env.RUNNER_TEMP ?? '.'}/vinculos.md`;
    writeFileSync(arquivo, md);
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${md}\n`);
    if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `arquivo=${arquivo}\n`);
  } catch (erro) {
    aviso(`vinculos: falhou (${(erro as Error).name}), job segue`);
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
