/**
 * qa-e2e-disparar — PR com base `main`: resolve as imagens, cria o check
 * "E2E do brabo-qa" em andamento e dispara o `e2e-pr` no brabo-qa (AT-765).
 * As imagens vão por TAG: a espera (30 min) e a resolução tag->digest ficam no brabo-qa, para o
 * check não nascer vermelho enquanto a release ainda publica. Tag git ausente já nasce vermelho `ambiente`.
 *
 * PR com base `dev` (AT-769, `PR_BASE_REF=dev`): seleciona as funcionalidades tocadas pelo catálogo do brabo-qa,
 * usa a imagem `sha-<12>` do head e publica o check `Regressivo do brabo-qa` (nunca exigido).
 *
 * AT-790: antes de dar vermelho por ambiente ou assinatura, espera (QA_ESPERA_MINUTOS, padrão 10) a tag -dev do head, a imagem
 * e a assinatura (cosign) dela.
 *
 * Env: GH_TOKEN (token do App), GITHUB_REPOSITORY, PR_NUMERO, PR_HEAD_SHA, PR_HEAD_REF, GITHUB_RUN_URL;
 * opcionais (AT-773): PR_AUTOR (login do autor da PR; sem ele, GITHUB_ACTOR), GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, GITHUB_SHA, GITHUB_STEP_SUMMARY;
 * só na dev: PR_BASE_REF, PR_HEAD_REPO (full_name do repo do head, para a guarda de fork).
 * Sintaxe apagável apenas (o Node executa este `.ts` por type stripping).
 */

import {
  SemTagParaOHead,
  consultarGhcr,
  escolherTags,
  maisNova,
  paginar,
  montarPayload,
  type EscolhaDeTags,
  type RepoGatilho,
} from './qa-e2e-imagens.ts';
import { NOME_DO_CHECK_POR_MODO, montarCheck, secaoMotivos } from './qa-e2e-resumo.ts';
import { escreverNoSummary, procurarRun, vinculosDoGatilho, type RunDoQa } from './qa-e2e-vinculos.ts';
import { AssinaturaAusente, ImagemAusente, cosignAssinada, esperarImagemAssinada, relogioReal, repetirAte, tetoDoEnv } from './qa-e2e-espera.ts';
import { buscaTagsDoHead } from './qa-e2e-busca-tags.ts';
import { lerCatalogo, selecionar, type Selecao } from './qa-regressivo-selecao.ts';

export const NOME_DO_CHECK = NOME_DO_CHECK_POR_MODO.main;

const CATALOGO_URL = 'https://raw.githubusercontent.com/viralabs-dev/brabo-qa/dev/funcionalidades.yml';
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

async function arquivosDaPr(dono: string, nome: string, pr: string): Promise<string[]> {
  const todos: string[] = [];
  for (let pagina = 1; ; pagina++) {
    const itens = (await gh(`repos/${dono}/${nome}/pulls/${pr}/files?per_page=100&page=${pagina}`)) as { filename: string; previous_filename?: string }[];
    for (const f of itens) todos.push(f.filename, ...(f.previous_filename ? [f.previous_filename] : []));
    if (itens.length < 100) return todos;
  }
}

async function principal(): Promise<void> {
  const env = (n: string) => process.env[n] ?? '';
  const [dono, nome] = env('GITHUB_REPOSITORY').split('/') as [string, string];
  const headSha = env('PR_HEAD_SHA');
  const headRef = env('PR_HEAD_REF');
  const urlDoRun = env('GITHUB_RUN_URL');
  const dev = env('PR_BASE_REF') === 'dev';
  const nomeDoCheck = NOME_DO_CHECK_POR_MODO[dev ? 'dev' : 'main'];
  const check = (corpo: object) => gh(`repos/${dono}/${nome}/check-runs`, { method: 'POST', body: JSON.stringify({ name: nomeDoCheck, head_sha: headSha, ...corpo }) });
  const neutro = async (motivo: string) => {
    const c = montarCheck({ modo: 'dev', causa: null, linhas: [], specsQueFalharam: [], urlDoRun, neutro: motivo });
    await check({ status: 'completed', conclusion: c.conclusion, external_id: c.external_id, output: { title: c.title, summary: c.summary } });
    console.log(`Regressivo neutro: ${motivo}`);
  };

  let extra: object = {};
  let sobreDono = '';
  let selecao: Selecao | null = null;
  if (dev) {
    // Fork não recebe segredo nem publica imagem; a seleção só lê arquivos e o catálogo público.
    if (env('PR_HEAD_REPO') !== env('GITHUB_REPOSITORY')) return neutro('Regressivo não roda em PR de fork.');
    const r = await fetch(CATALOGO_URL);
    if (!r.ok) throw new Error(`catálogo do brabo-qa: ${r.status}`);
    const s = selecionar({ repo: nome, arquivos: await arquivosDaPr(dono, nome, env('PR_NUMERO')), catalogo: lerCatalogo(await r.text()) });
    if (nome === 'brabo-contracts') return neutro('Consumido por TAG; o regressivo roda na PR que sobe a TAG.');
    if (s.modo === 'nenhum') return neutro('Sem funcionalidade tocada.');
    selecao = s;
    extra = { modo: s.modo, funcionalidades: s.funcionalidades, selecao: { motivos: s.motivos, semDono: s.semDono, tocadas: s.tocadas } };
    sobreDono = s.semDono.length > 0 ? `\n\nSem dono no mapa:\n${s.semDono.map((c) => `- ${c}`).join('\n')}` : '';
  } else if (nome !== 'brabo-contracts') {
    // Portão da main (AT-791): o conjunto segue o catálogo inteiro; a seleção pelo mapa é só informação,
    // para o relatório separar "a PR toca" de "só rodou". Falhar aqui nunca reprova o gatilho.
    try {
      const r = await fetch(CATALOGO_URL);
      if (!r.ok) throw new Error(`catálogo do brabo-qa: ${r.status}`);
      selecao = selecionar({ repo: nome, arquivos: await arquivosDaPr(dono, nome, env('PR_NUMERO')), catalogo: lerCatalogo(await r.text()) });
      extra = { selecao: { motivos: selecao.motivos, semDono: selecao.semDono, tocadas: selecao.tocadas } };
    } catch (e) {
      console.log(`::warning::seleção informativa da main falhou (${(e as Error).message}); segue sem motivos`);
    }
  }

  let escolha: EscolhaDeTags | null = null;
  let erro = '';
  let causaDoErro: 'ambiente' | 'assinatura' = 'ambiente';
  // AT-790: o carimbo do head (tag -dev, imagem) e a assinatura da `sha-` ainda podem estar rodando; espera até o teto.
  const limite = relogioReal.agora() + tetoDoEnv(env('QA_ESPERA_MINUTOS'));
  let avisouTag = false;
  const resolver = async (): Promise<EscolhaDeTags> => {
    const ultimaDev = {} as Record<(typeof CHAVES)[number], string>;
    const ultimaFinal = {} as Record<(typeof CHAVES)[number], string>;
    let tagsDoHead: string[] = [];
    for (const c of CHAVES) {
      const repo = `brabo-${c}`;
      const refs = await tagsDe(repo);
      const nomes = refs.map((r) => r.ref.replace('refs/tags/', ''));
      // `devMaisNova`, nunca `dev`: o `dev` de fora é "a base é a dev" (AT-769). O shadowing
      // fazia `!dev` ser sempre falso e o portão da main nunca achar a -dev do head (AT-789).
      const devMaisNova = maisNova(nomes.filter((t) => t.includes('-dev.')));
      const final = maisNova(nomes.filter((t) => !t.includes('-')));
      if (!devMaisNova || !final) {
        if (!avisouTag) console.log(`esperando tag ${devMaisNova ? 'final' : '-dev'} de ${repo}`);
        avisouTag = true;
        throw new SemTagParaOHead(`${repo} não tem tag ${devMaisNova ? 'final' : '-dev'} publicada`);
      }
      ultimaDev[c] = devMaisNova;
      ultimaFinal[c] = final;
      if (buscaTagsDoHead({ repo, repoDaPr: nome, baseDev: dev })) {
        const commitDe = async (r: Ref) => (r.object.type === 'tag' ? (await gh(`repos/viralabs-dev/${repo}/git/tags/${r.object.sha}`)).object.sha : r.object.sha);
        for (const r of refs) if ((await commitDe(r)) === headSha) tagsDoHead.push(r.ref.replace('refs/tags/', ''));
      }
    }
    return escolherTags({ repo: nome as RepoGatilho, headSha, headRef, baseRef: dev ? 'dev' : 'main', tagsDoHead, ultimaDev, ultimaFinal });
  };
  try {
    const t0 = Date.now();
    escolha = await repetirAte(resolver, (e) => e instanceof SemTagParaOHead, limite);
    if (avisouTag) console.log(`tags do head achadas após ${Math.round((Date.now() - t0) / 1000)} s`);
    // Só o repo do evento tem imagem nova; as outras já estão carimbadas e assinadas.
    const dono = nome.replace('brabo-', '');
    const tag = (escolha.tags as Record<string, string>)[dono];
    if (tag && dono !== 'infra' && dono !== 'qa') {
      await esperarImagemAssinada({ imagem: nome, tag, digestDe: consultarGhcr, assinada: cosignAssinada, limite, log: (m) => console.log(m) });
    }
  } catch (e) {
    if (e instanceof AssinaturaAusente) causaDoErro = 'assinatura';
    else if (!(e instanceof SemTagParaOHead || e instanceof ImagemAusente)) throw e;
    escolha = null;
    erro = (e as Error).message;
  }

  if (!escolha) {
    const c = montarCheck({ modo: dev ? 'dev' : 'main', causa: causaDoErro, linhas: [], specsQueFalharam: [], urlDoRun });
    await check({ status: 'completed', conclusion: 'failure', external_id: c.external_id, output: { title: c.title, summary: `${erro}\n\n${c.summary}` } });
    console.log(`E2E vermelho (${causaDoErro}): ${erro}`);
    return;
  }
  const criado = await check({ status: 'in_progress', details_url: urlDoRun, output: { title: dev ? 'Regressivo em andamento' : 'E2E em andamento', summary: `Disparado no brabo-qa. Run do gatilho: ${urlDoRun}${sobreDono}` } });
  const runId = env('GITHUB_RUN_ID') || '0';
  const runAttempt = env('GITHUB_RUN_ATTEMPT') || '1';
  const ator = env('PR_AUTOR') || env('GITHUB_ACTOR');
  const correlacao = `${runId}-${runAttempt}`;
  const antes = Date.now() - 5_000;
  try {
    await gh('repos/viralabs-dev/brabo-qa/dispatches', { method: 'POST', body: JSON.stringify({ event_type: 'e2e-pr', client_payload: montarPayload(escolha, { repo: `${dono}/${nome}`, pr: Number(env('PR_NUMERO')), headSha, checkRunId: criado.id, origem: { ator, runId, runAttempt, runUrl: urlDoRun } }, extra) }) });
  } catch (e) {
    // Sem dispatch ninguém conclui o check: não deixar em andamento.
    const msg = e instanceof Error ? e.message : String(e);
    const c = montarCheck({ causa: 'ambiente', linhas: [], specsQueFalharam: [], urlDoRun });
    await gh(`repos/${dono}/${nome}/check-runs/${criado.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed', conclusion: 'failure', external_id: c.external_id, output: { title: c.title, summary: `Falha ao disparar o e2e-pr: ${msg}\n\n${c.summary}` } }) });
    throw e;
  }
  console.log(`e2e-pr disparado (check ${criado.id})`);
  await registrarVinculos();

  // Vínculos no Summary do run de origem; falha aqui nunca reprova o gatilho.
  async function registrarVinculos(): Promise<void> {
    try {
      const desde = new Date(antes).toISOString().replace(/\.\d+Z$/, 'Z');
      const achou = await procurarRun(async () => {
        const r = await gh(`repos/viralabs-dev/brabo-qa/actions/workflows/e2e-pr.yml/runs?event=repository_dispatch&created=%3E%3D${desde}&per_page=20`);
        return r.workflow_runs as RunDoQa[];
      }, correlacao);
      if (!achou) console.log(`::warning::vinculos: run do brabo-qa com c=${correlacao} não apareceu em 60 s; ficou o link do check`);
      // "Funcionalidades e motivo" no Summary do run de origem (AT-791).
      const motivos = selecao ? secaoMotivos(Object.entries(selecao.motivos).map(([id, motivo]) => ({ id, motivo })), selecao.semDono) : '';
      if (motivos) escreverNoSummary(motivos.replace('### Por que estas funcionalidades', '## Funcionalidades e motivo'));
      escreverNoSummary(
        vinculosDoGatilho({
          origem: { repo: `${dono}/${nome}`, pr: env('PR_NUMERO'), sha: headSha, ator, run_url: urlDoRun, evento: 'pull_request' },
          este: { repo: `${dono}/${nome}`, sha: env('GITHUB_SHA') || headSha, run_url: urlDoRun },
          runDoQa: achou?.html_url,
          urlDoCheck: `https://github.com/${dono}/${nome}/runs/${criado.id}`,
          aviso: (m) => console.log(`::warning::${m}`),
        }),
      );
    } catch (e) {
      console.log(`::warning::vinculos: falhou (${(e as Error).name}), gatilho segue`);
    }
  }
}

const { pathToFileURL } = await import('node:url');
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await principal();
}
