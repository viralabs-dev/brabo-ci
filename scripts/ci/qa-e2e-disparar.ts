/**
 * qa-e2e-disparar — PR com base `main`: resolve as imagens, cria o check
 * "E2E do brabo-qa" em andamento e dispara o `e2e-pr` no brabo-qa (AT-765).
 * As imagens vão por TAG: a espera (30 min) e a resolução tag->digest ficam no brabo-qa, para o
 * check não nascer vermelho enquanto a release ainda publica. Tag git ausente já nasce vermelho `ambiente`.
 *
 * Env: GH_TOKEN (token do App), GITHUB_REPOSITORY, PR_NUMERO, PR_HEAD_SHA, PR_HEAD_REF, GITHUB_RUN_URL.
 * Sintaxe apagável apenas (o Node executa este `.ts` por type stripping).
 */

import {
  SemTagParaOHead,
  escolherTags,
  maisNova,
  paginar,
  montarPayload,
  type EscolhaDeTags,
  type RepoGatilho,
} from './qa-e2e-imagens.ts';
import { montarCheck } from './qa-e2e-resumo.ts';

export const NOME_DO_CHECK = 'E2E do brabo-qa';
const CHAVES = ['api', 'engine', 'web', 'broker', 'infra'] as const;

interface Ref {
  ref: string;
  object: { sha: string; type: string };
}

async function gh(caminho: string, init: RequestInit = {}): Promise<any> {
  const r = await fetch(`https://api.github.com/${caminho}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
  });
  if (!r.ok) throw new Error(`GitHub ${init.method ?? 'GET'} ${caminho}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

async function tagsDe(repo: string): Promise<Ref[]> {
  return paginar<Ref>(`https://api.github.com/repos/viralabs-dev/${repo}/git/matching-refs/tags/v?per_page=100`, async (url) => {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error(`GitHub GET ${url}: ${r.status} ${await r.text()}`);
    return { itens: (await r.json()) as Ref[], link: r.headers.get('link') };
  });
}

async function principal(): Promise<void> {
  const env = (n: string) => process.env[n] ?? '';
  const [dono, nome] = env('GITHUB_REPOSITORY').split('/') as [string, string];
  const headSha = env('PR_HEAD_SHA');
  const headRef = env('PR_HEAD_REF');
  const urlDoRun = env('GITHUB_RUN_URL');

  let escolha: EscolhaDeTags | null = null;
  let erro = '';
  try {
    const ultimaDev = {} as Record<(typeof CHAVES)[number], string>;
    const ultimaFinal = {} as Record<(typeof CHAVES)[number], string>;
    let tagsDoHead: string[] = [];
    for (const c of CHAVES) {
      const repo = `brabo-${c}`;
      const refs = await tagsDe(repo);
      const nomes = refs.map((r) => r.ref.replace('refs/tags/', ''));
      const dev = maisNova(nomes.filter((t) => t.includes('-dev.')));
      const final = maisNova(nomes.filter((t) => !t.includes('-')));
      if (!dev || !final) throw new SemTagParaOHead(`${repo} não tem tag ${dev ? 'final' : '-dev'} publicada`);
      ultimaDev[c] = dev;
      ultimaFinal[c] = final;
      if (repo === nome) {
        const commitDe = async (r: Ref) => (r.object.type === 'tag' ? (await gh(`repos/viralabs-dev/${repo}/git/tags/${r.object.sha}`)).object.sha : r.object.sha);
        for (const r of refs) if ((await commitDe(r)) === headSha) tagsDoHead.push(r.ref.replace('refs/tags/', ''));
      }
    }
    escolha = escolherTags({ repo: nome as RepoGatilho, headSha, headRef, tagsDoHead, ultimaDev, ultimaFinal });
  } catch (e) {
    if (!(e instanceof SemTagParaOHead)) throw e;
    erro = e.message;
  }

  const check = (corpo: object) => gh(`repos/${dono}/${nome}/check-runs`, { method: 'POST', body: JSON.stringify({ name: NOME_DO_CHECK, head_sha: headSha, ...corpo }) });
  if (!escolha) {
    const c = montarCheck({ causa: 'ambiente', linhas: [], specsQueFalharam: [], urlDoRun });
    await check({ status: 'completed', conclusion: 'failure', external_id: c.external_id, output: { title: c.title, summary: `${erro}\n\n${c.summary}` } });
    console.log(`E2E vermelho (ambiente): ${erro}`);
    return;
  }
  const criado = await check({ status: 'in_progress', details_url: urlDoRun, output: { title: 'E2E em andamento', summary: `Disparado no brabo-qa. Run do gatilho: ${urlDoRun}` } });
  try {
    await gh('repos/viralabs-dev/brabo-qa/dispatches', { method: 'POST', body: JSON.stringify({ event_type: 'e2e-pr', client_payload: montarPayload(escolha, { repo: `${dono}/${nome}`, pr: Number(env('PR_NUMERO')), headSha, checkRunId: criado.id }) }) });
  } catch (e) {
    // Sem dispatch ninguém conclui o check: não deixar em andamento.
    const msg = e instanceof Error ? e.message : String(e);
    const c = montarCheck({ causa: 'ambiente', linhas: [], specsQueFalharam: [], urlDoRun });
    await gh(`repos/${dono}/${nome}/check-runs/${criado.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed', conclusion: 'failure', external_id: c.external_id, output: { title: c.title, summary: `Falha ao disparar o e2e-pr: ${msg}\n\n${c.summary}` } }) });
    throw e;
  }
  console.log(`e2e-pr disparado (check ${criado.id})`);
}

const { pathToFileURL } = await import('node:url');
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await principal();
}
