import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  QUIETUDE_MS,
  TETO_MS,
  buscarComEtag,
  chaveDaMudanca,
  componente,
  intervalo,
  jaTemPainel,
  montarPainel,
  prDaTag,
  runsDaMudanca,
  superado,
  terminou,
  type Cache,
  type Pr,
  type Run,
} from './painel.ts';

const dir = fileURLToPath(new URL('./__fixtures__/painel/', import.meta.url));
const fx = (n: string) => JSON.parse(readFileSync(join(dir, n), 'utf8'));
const api = fx('pr-api-65.json');
const brabo = fx('pr-brabo-55.json');

const toPr = (repo: string, j: any): Pr => ({ ref: { repo, n: j.number }, state: j.merged ? 'MERGED' : 'OPEN', corpo: j.body ?? '', criada: j.created_at, head: j.head?.sha ?? j.head, merge: j.merge_commit_sha });
const prApi = toPr('brabo-api', api);
const prBrabo = toPr('brabo', brabo);
const porSha = {
  [`brabo-api@${prApi.head}`]: fx('runs-api-65-head.json').workflow_runs,
  [`brabo-api@${prApi.merge}`]: fx('runs-api-65-merge.json').workflow_runs,
  [`brabo@${prBrabo.merge}`]: fx('runs-brabo-55-merge.json').workflow_runs,
};
const qa: Run[] = fx('runs-qa-e2e-pr.json').workflow_runs;
const AGORA = Date.parse('2026-11-07T17:45:00Z');

// grafo falso: cada PR tem corpo com `Depende-de`
const grafo = (corpos: Record<string, string>) => {
  const buscar = async (r: { repo: string; n: number }): Promise<Pr | null> => {
    const corpo = corpos[`${r.repo}#${r.n}`];
    return corpo === undefined ? null : { ref: r, state: 'OPEN', corpo, criada: '2026-11-07T00:00:00Z', head: 'h', merge: null };
  };
  const citadoras = async (r: { repo: string; n: number }) =>
    Object.entries(corpos)
      .filter(([, c]) => c.includes(`Depende-de: viralabs-dev/${r.repo}#${r.n}`))
      .map(([k]) => ({ repo: k.split('#')[0] as string, n: Number(k.split('#')[1]) }));
  return { buscar, citadoras };
};

describe('componente', () => {
  it('segue o Depende-de nos dois sentidos', async () => {
    const g = grafo({ 'brabo-api#1': 'Depende-de: viralabs-dev/brabo-web#2', 'brabo-web#2': '', 'brabo-infra#3': 'Depende-de: viralabs-dev/brabo-web#2', 'brabo-qa#9': '' });
    const prs = await componente([{ repo: 'brabo-web', n: 2 }], g.buscar, g.citadoras);
    expect(prs.map((p) => `${p.ref.repo}#${p.ref.n}`)).toEqual(['brabo-api#1', 'brabo-infra#3', 'brabo-web#2']);
  });

  it('ciclo termina e não duplica', async () => {
    const g = grafo({ 'brabo-api#1': 'Depende-de: viralabs-dev/brabo-web#2', 'brabo-web#2': 'Depende-de: viralabs-dev/brabo-api#1' });
    const prs = await componente([{ repo: 'brabo-api', n: 1 }], g.buscar, g.citadoras);
    expect(prs).toHaveLength(2);
  });

  it('crescimento: a chave muda e o painel antigo é superado', async () => {
    const antes = grafo({ 'brabo-api#1': 'Depende-de: viralabs-dev/brabo-web#2', 'brabo-web#2': '' });
    const p1 = await componente([{ repo: 'brabo-api', n: 1 }], antes.buscar, antes.citadoras);
    const chave = chaveDaMudanca(p1);
    expect(superado(chave, p1)).toBe(false);
    const depois = grafo({ 'brabo-api#1': 'Depende-de: viralabs-dev/brabo-web#2', 'brabo-web#2': '', 'brabo-infra#3': 'Depende-de: viralabs-dev/brabo-api#1' });
    const p2 = await componente([{ repo: 'brabo-api', n: 1 }], depois.buscar, depois.citadoras);
    expect(superado(chave, p2)).toBe(true);
    expect(chave).toMatch(/^api#1 web#2 m=[0-9a-f]{8}$/);
  });

  it('declaração inválida e repo fora da lista não entram', async () => {
    const g = grafo({ 'brabo-api#1': 'Depende-de: evil/x#2\nDepende-de: viralabs-dev/outro#3' });
    expect(await componente([{ repo: 'brabo-api', n: 1 }], g.buscar, g.citadoras)).toHaveLength(1);
  });
});

describe('tag → PR', () => {
  it('acha o PR mergeado do commit da tag (resposta real do brabo, 07/11)', () => {
    expect(prDaTag('brabo', fx('pulls-da-tag.json'))).toEqual({ repo: 'brabo', n: 55 });
    expect(prDaTag('brabo', [{ number: 1, merged_at: null }])).toBeNull();
    expect(prDaTag('evil', fx('pulls-da-tag.json'))).toBeNull();
  });
});

describe('runsDaMudanca (promoção de 07/11)', () => {
  const linhas = runsDaMudanca([prApi, prBrabo], porSha, qa);
  const de = (repo: string, fase: string) => linhas.filter((l) => l.repo === repo && l.fase === fase).map((l) => l.run.name);

  it('junta PR, E2E do qa pelo título, merge e tag', () => {
    expect(de('brabo-api', 'PR')).toContain('ci');
    const e2e = linhas.filter((l) => l.repo === 'brabo-api' && l.fase === 'E2E');
    expect(e2e).toHaveLength(1);
    expect(e2e[0]?.run.display_title).toContain('brabo-api#65 · e410b6c');
    expect(de('brabo-api', 'merge')).toEqual(expect.arrayContaining(['carimbo', 'ci']));
    expect(de('brabo', 'tag')).toContain('release v2.1.1 ← tag do carimbo');
  });

  it('o E2E de outra PR (ou de antes da abertura) não entra', () => {
    expect(linhas.some((l) => l.fase === 'E2E' && /brabo-web#40/.test(l.run.display_title))).toBe(false);
    const antes = qa.map((r) => ({ ...r, created_at: '2026-11-07T10:00:00Z' }));
    expect(runsDaMudanca([prApi], porSha, antes).some((l) => l.fase === 'E2E')).toBe(false);
  });

  it('re-run: fica a run de maior attempt', () => {
    const base = fx('runs-api-65-head.json').workflow_runs[0] as Run;
    const l = runsDaMudanca([prApi], { [`brabo-api@${prApi.head}`]: [{ ...base, id: 1, run_attempt: 1, conclusion: 'failure' }, { ...base, id: 2, run_attempt: 2, conclusion: 'success' }] }, []);
    expect(l).toHaveLength(1);
    expect(l[0]?.run.run_attempt).toBe(2);
  });

  it('o release v2.1.1 vermelho aparece no painel', () => {
    const md = montarPainel([prApi, prBrabo], linhas, { agora: AGORA, chave: chaveDaMudanca([prApi, prBrabo]) });
    expect(md).toMatch(/^## Painel da mudança · ✅ \d+ · ❌ 1/);
    expect(md).toMatch(/\| tag \| release v2\.1\.1 ← tag do carimbo \| ❌ \|/);
    expect(md).toContain('### brabo-api#65 (MERGED)');
    expect(md).toContain('```mermaid\nflowchart LR');
    expect(md).toContain('classDef falha');
    expect(md).toContain(':::falha');
    expect(md).toContain('<details><summary>Puladas</summary>');
  });
});

describe('painel em andamento no teto', () => {
  const rodando: Run = { ...(fx('runs-api-65-head.json').workflow_runs[0] as Run), status: 'in_progress', conclusion: null, run_started_at: '2026-11-07T17:00:00Z', created_at: '2026-11-07T17:00:00Z' };
  const linhas = runsDaMudanca([prApi], { [`brabo-api@${prApi.head}`]: [rodando] }, []);

  it('terminou: sem teto continua; no teto sai com a contagem', () => {
    const e = { inicio: AGORA - 10 * 60_000, agora: AGORA, ultimaNovidade: AGORA, runs: [rodando], todasMergeadas: true };
    expect(terminou(e).fim).toBe(false);
    expect(terminou({ ...e, inicio: AGORA - TETO_MS })).toEqual({ fim: true, motivo: 'teto', emAndamento: 1 });
  });

  it('o painel diz "em andamento há N min" e não reprova', () => {
    const md = montarPainel([prApi], linhas, { agora: AGORA, chave: 'api#65', nota: 'teto: passaram 45 min; 1 run(s) seguem em andamento.' });
    expect(md).toContain('⏳ em andamento há 45m00s');
    expect(md).toContain('> passaram 45 min');
    expect(md).toContain('⏳ 1');
  });
});

describe('terminou: quietude', () => {
  const ok = [{ status: 'completed' }];
  const e = { inicio: 0, agora: QUIETUDE_MS, ultimaNovidade: 0, runs: ok, todasMergeadas: true };
  it('3 min sem novidade fecha; antes disso espera o carimbo → tag → release', () => {
    expect(terminou(e)).toEqual({ fim: true, motivo: 'quietude', emAndamento: 0 });
    expect(terminou({ ...e, agora: QUIETUDE_MS - 1 }).fim).toBe(false);
  });
  it('PR ainda aberta: sai sem esperar a quietude; run andamento segura', () => {
    expect(terminou({ ...e, agora: 1, todasMergeadas: false }).motivo).toBe('aguarda-merge');
    expect(terminou({ ...e, runs: [{ status: 'queued' }] }).fim).toBe(false);
  });
  it('rate limit baixo desacelera para 5 min', () => {
    expect(intervalo(4000)).toBe(60_000);
    expect(intervalo(499)).toBe(300_000);
    expect(intervalo(null)).toBe(60_000);
  });
});

describe('rótulo malicioso', () => {
  it('nome, título, URL e chave nunca entram crus no Markdown nem no Mermaid', () => {
    const ruim = '"]-->x|`<img src=x onerror=1>`\n# h';
    const base = fx('runs-api-65-head.json').workflow_runs[0] as Run;
    const run: Run = { ...base, name: ruim, display_title: ruim, html_url: 'https://evil.example/x' };
    const md = montarPainel([prApi], runsDaMudanca([prApi], { [`brabo-api@${prApi.head}`]: [run] }, []), { agora: AGORA, chave: ruim });
    expect(md).not.toMatch(/evil|<img|onerror|-->x|```\n#|\n# h/);
    for (const l of md.split('\n').filter((x) => x.startsWith('| ') && !x.startsWith('| Fase'))) expect(l.split('|').length).toBe(7);
  });

  it('o debounce casa o token inteiro (api#6 não casa api#65)', () => {
    expect(jaTemPainel(['Painel · brabo-api#65'], { repo: 'brabo-api', n: 65 })).toBe(true);
    expect(jaTemPainel(['Painel · brabo-api#65'], { repo: 'brabo-api', n: 6 })).toBe(false);
    expect(jaTemPainel(['Painel · brabo-web#65 brabo-api#6 · x'], { repo: 'brabo-api', n: 6 })).toBe(true);
    expect(jaTemPainel([], { repo: 'brabo-api', n: 6 })).toBe(false);
  });
});

describe('buscarComEtag', () => {
  const resp = (status: number, headers: Record<string, string>, corpo: unknown = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => corpo,
    text: async () => '',
  });

  it('304 devolve o corpo guardado, manda If-None-Match e não relê', async () => {
    const cache: Cache = {};
    const vistos: Record<string, string>[] = [];
    const respostas = [resp(200, { etag: '"abc"', 'x-ratelimit-remaining': '4000' }, { a: 1 }), resp(304, { 'x-ratelimit-remaining': '4000' })];
    const f = async (_u: string, i: { headers: Record<string, string> }) => {
      vistos.push(i.headers);
      return respostas.shift() as ReturnType<typeof resp>;
    };
    const um = await buscarComEtag('repos/x/y', cache, 't', f);
    const dois = await buscarComEtag('repos/x/y', cache, 't', f);
    expect(um).toEqual({ corpo: { a: 1 }, restante: 4000, naoModificado: false });
    expect(dois).toEqual({ corpo: { a: 1 }, restante: 4000, naoModificado: true });
    expect(vistos[0]?.['If-None-Match']).toBeUndefined();
    expect(vistos[1]?.['If-None-Match']).toBe('"abc"');
  });

  it('erro HTTP vira exceção (o CLI só avisa)', async () => {
    await expect(buscarComEtag('x', {}, 't', async () => resp(403, {}))).rejects.toThrow('403');
  });
});
