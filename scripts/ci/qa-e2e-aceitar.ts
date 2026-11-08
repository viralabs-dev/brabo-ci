/**
 * qa-e2e-aceitar — `/qa-aceitar <justificativa>` num comentário de PR: avalia, e no aceite
 * vira o check "E2E do brabo-qa" para verde, põe a label e comenta (AT-765).
 *
 * Env: GH_TOKEN (token do App), GITHUB_REPOSITORY, PR_NUMERO, COMENTARIO_ACAO, COMENTARIO_AUTOR,
 * COMENTARIO_CORPO, OWNER_HANDLE.
 * Sintaxe apagável apenas (o Node executa este `.ts` por type stripping).
 */

import { avaliarAceite, comentarioDoAceite } from './qa-e2e-aceite.ts';
import { montarCheck } from './qa-e2e-resumo.ts';

const NOME_DO_CHECK = 'E2E do brabo-qa';
const LABEL = 'qa-aceito-com-justificativa';

async function gh(caminho: string, init: RequestInit = {}): Promise<any> {
  const r = await fetch(`https://api.github.com/${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw new Error(`GitHub ${init.method ?? 'GET'} ${caminho}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

async function principal(): Promise<void> {
  const env = (n: string) => process.env[n] ?? '';
  const repo = env('GITHUB_REPOSITORY');
  const pr = env('PR_NUMERO');
  const comentar = (corpo: string) => gh(`repos/${repo}/issues/${pr}/comments`, { method: 'POST', body: JSON.stringify({ body: corpo }) });

  // O head e a base vêm da API, não do evento: o comentário não os traz.
  const dados = await gh(`repos/${repo}/pulls/${pr}`);
  const headSha: string = dados.head.sha;
  const { check_runs } = await gh(`repos/${repo}/commits/${headSha}/check-runs?check_name=${encodeURIComponent(NOME_DO_CHECK)}&app_id=${env('APP_ID')}`);
  const atual = (check_runs as any[]).sort((a, b) => b.id - a.id)[0];

  const veredito = avaliarAceite({
    acao: env('COMENTARIO_ACAO') as 'created',
    autor: env('COMENTARIO_AUTOR'),
    owner: env('OWNER_HANDLE'),
    corpo: env('COMENTARIO_CORPO'),
    baseRef: dados.base.ref,
    check: atual
      ? { conclusao: atual.conclusion, externalId: atual.external_id, titulo: atual.output?.title ?? '' }
      : null,
  });

  if ('ignorar' in veredito) return;
  if (!veredito.aceito) {
    await comentar(`Aceite recusado: ${veredito.motivo}`);
    return;
  }
  const c = montarCheck({
    causa: null,
    linhas: [],
    specsQueFalharam: [],
    urlDoRun: atual.details_url ?? '',
    // Preserva o relatório do vermelho (AT-791): antes o aceite apagava o resumo.
    resumoAnterior: atual.output?.summary ?? '',
    textoAnterior: atual.output?.text ?? undefined,
    aceite: {
      justificativa: veredito.justificativa,
      por: env('COMENTARIO_AUTOR'),
      em: new Date().toISOString(),
      urlDoRunVermelho: atual.details_url ?? atual.html_url,
    },
  });
  await gh(`repos/${repo}/check-runs/${atual.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'completed', conclusion: c.conclusion, output: { title: c.title, summary: c.summary, ...(c.text ? { text: c.text } : {}) } }),
  });
  await gh(`repos/${repo}/issues/${pr}/labels`, { method: 'POST', body: JSON.stringify({ labels: [LABEL] }) });
  await comentar(comentarioDoAceite(env('COMENTARIO_AUTOR'), veredito.justificativa, atual.output?.summary ?? ''));
}

const { pathToFileURL } = await import('node:url');
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await principal();
}
