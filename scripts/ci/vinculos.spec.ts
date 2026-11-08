import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { linhaDoPainel, montar, resolverIrmao, type Entrada } from './vinculos.ts';

const dir = fileURLToPath(new URL('./__fixtures__/vinculos/', import.meta.url));
const fx = (n: string) => readFileSync(join(dir, n), 'utf8');
const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const RUN = 'https://github.com/viralabs-dev/brabo-qa/actions/runs/77';

const base = (over: Partial<Entrada> = {}): Entrada => ({
  origem: JSON.parse(fx('origem-dispatch.json')),
  este: { repo: 'viralabs-dev/brabo-qa', sha: B, run_url: RUN },
  irmaos: [{ repo: 'viralabs-dev/brabo-infra', sha: A }],
  destino: [{ rotulo: 'Check E2E na PR', url: 'https://github.com/viralabs-dev/brabo-api/runs/5' }],
  disparados: [],
  ...over,
});

describe('montar', () => {
  it('bate com o esperado (dispatch)', () => {
    expect(montar(base())).toBe(fx('esperado-dispatch.md'));
  });

  it('bate com o esperado (schedule, sem PR)', () => {
    const e = base({ origem: JSON.parse(fx('origem-schedule.json')), irmaos: [], destino: [] });
    expect(montar(e)).toBe(fx('esperado-schedule.md'));
  });

  it('valor malicioso nunca entra no Markdown nem no Mermaid', () => {
    const avisos: string[] = [];
    const ruim = '"]-->x|`<img src=x onerror=1>`\n# h';
    const md = montar(
      base({
        origem: { repo: ruim, pr: ruim, sha: ruim, ator: ruim, run_url: 'https://evil.example/x', evento: ruim },
        irmaos: [{ repo: ruim, sha: ruim }],
        destino: [{ rotulo: ruim, url: 'javascript:alert(1)' }],
        disparados: [{ rotulo: 'ok | x', url: 'https://github.com/viralabs-dev/brabo-qa/runs/1' }],
      }),
      (m) => avisos.push(m),
    );
    expect(md).not.toMatch(/evil|javascript|<img|onerror|-->x|```\n#/);
    expect(avisos.length).toBeGreaterThanOrEqual(9);
    // toda linha da tabela mantém 5 colunas
    for (const l of md.split('\n').filter((x) => x.startsWith('| '))) expect(l.split('|').length).toBe(7);
  });
});

describe('formato dos campos', () => {
  it('SHA curto e ator com espaço ou barra viram ?', () => {
    const avisos: string[] = [];
    const md = montar(base({ origem: { repo: 'viralabs-dev/brabo-api', sha: 'abc123', ator: 'a b|c' } }), (m) => avisos.push(m));
    expect(md).toContain('| Origem | viralabs-dev/brabo-api | ? · ? | ? | ? |');
    expect(avisos).toEqual(['vinculos: origem.sha inválido, ignorado', 'vinculos: origem.ator inválido, ignorado']);
  });
});

describe('repo, PR e evento', () => {
  it('repo de outra org, PR não numérica e evento com espaço viram ?', () => {
    const avisos: string[] = [];
    const md = montar(base({ origem: { repo: 'evil/x', pr: '1x', sha: A, ator: 'ok', evento: 'a b' } }), (m) => avisos.push(m));
    expect(md).not.toMatch(/evil|1x|a b/);
    expect(avisos).toEqual(['vinculos: origem.repo inválido, ignorado', 'vinculos: origem.pr inválido, ignorado', 'vinculos: origem.evento inválido, ignorado']);
  });
});

describe('resolverIrmao', () => {
  it('literal repo@sha', () => {
    expect(resolverIrmao(`viralabs-dev/brabo-api@${A}`, () => {})).toEqual({ repo: 'viralabs-dev/brabo-api', sha: A });
  });

  it('caminho de checkout lê HEAD e origin', () => {
    const p = mkdtempSync(join(tmpdir(), 'vinc-'));
    const g = (...a: string[]) => execFileSync('git', ['-C', p, ...a], { encoding: 'utf8' }).trim();
    g('init', '-q');
    g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'x');
    g('remote', 'add', 'origin', 'https://github.com/viralabs-dev/brabo-web.git');
    expect(resolverIrmao(p, () => {})).toEqual({ repo: 'viralabs-dev/brabo-web', sha: g('rev-parse', 'HEAD') });
  });

  it('caminho inexistente vira ? com aviso', () => {
    const avisos: string[] = [];
    expect(resolverIrmao('/nao/existe', (m) => avisos.push(m))).toEqual({ repo: '?', sha: '?' });
    expect(avisos).toHaveLength(1);
  });
});

describe('CLI', () => {
  const rodar = (env: Record<string, string>) => {
    const t = mkdtempSync(join(tmpdir(), 'vinc-cli-'));
    mkdirSync(t, { recursive: true });
    const summary = join(t, 'summary.md');
    const out = join(t, 'out');
    writeFileSync(summary, '');
    writeFileSync(out, '');
    const r = spawnSync(process.execPath, [fileURLToPath(new URL('./vinculos.ts', import.meta.url))], {
      env: { PATH: process.env.PATH ?? '', RUNNER_TEMP: t, GITHUB_STEP_SUMMARY: summary, GITHUB_OUTPUT: out, ...env },
      encoding: 'utf8',
    });
    return { r, summary: readFileSync(summary, 'utf8'), out: readFileSync(out, 'utf8'), t };
  };
  const run = {
    GITHUB_REPOSITORY: 'viralabs-dev/brabo-qa',
    GITHUB_SHA: B,
    GITHUB_RUN_ID: '77',
    GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_ACTOR: 'daneiel',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
  };

  it('origem JSON: escreve Summary, vinculos.md e o output', () => {
    const { r, summary, out, t } = rodar({ ...run, VINCULOS_ORIGEM: fx('origem-dispatch.json'), VINCULOS_DESTINO: 'Check E2E na PR|https://github.com/viralabs-dev/brabo-api/runs/5', VINCULOS_IRMAOS: `viralabs-dev/brabo-infra@${A}` });
    expect(r.status).toBe(0);
    expect(summary).toBe(`${fx('esperado-dispatch.md')}\n`);
    expect(readFileSync(join(t, 'vinculos.md'), 'utf8')).toBe(fx('esperado-dispatch.md'));
    expect(out).toBe(`arquivo=${join(t, 'vinculos.md')}\n`);
  });

  it('origem vazia vira automática (este run)', () => {
    const { r, summary } = rodar(run);
    expect(r.status).toBe(0);
    expect(summary).toContain('| Origem | viralabs-dev/brabo-qa | workflow_dispatch · daneiel |');
  });

  it('nunca reprova: JSON quebrado e lixo viram aviso, saída 0', () => {
    const { r, summary } = rodar({ ...run, VINCULOS_ORIGEM: '{quebrado', VINCULOS_IRMAOS: '/nao/existe', VINCULOS_DESTINO: 'sem-barra' });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('::warning::');
    expect(summary).toContain('## Vínculos');
  });

  it('falha de escrita (Summary num diretório que não existe) ainda sai 0', () => {
    const { r } = rodar({ ...run, GITHUB_STEP_SUMMARY: '/nao/existe/summary.md' });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('::warning::vinculos: falhou');
  });

  it('origem automática em PR usa o head do evento, não o merge commit', () => {
    const t = mkdtempSync(join(tmpdir(), 'vinc-ev-'));
    const ev = join(t, 'ev.json');
    writeFileSync(ev, JSON.stringify({ pull_request: { number: 12, head: { sha: A } } }));
    const { summary } = rodar({ ...run, GITHUB_EVENT_PATH: ev, GITHUB_EVENT_NAME: 'pull_request' });
    expect(summary).toContain(`[#12](https://github.com/viralabs-dev/brabo-qa/pull/12) · daneiel | [aaaaaaa](https://github.com/viralabs-dev/brabo-qa/commit/${A})`);
  });

  it('origem automática em PR ganha a linha "Painel da mudança"; a origem explícita não', () => {
    const t = mkdtempSync(join(tmpdir(), 'vinc-painel-'));
    const ev = join(t, 'ev.json');
    writeFileSync(ev, JSON.stringify({ pull_request: { number: 12, head: { sha: A } } }));
    const { summary } = rodar({ ...run, GITHUB_EVENT_PATH: ev, GITHUB_EVENT_NAME: 'pull_request' });
    expect(summary).toContain('| Disparado |  | Painel da mudança |  | [abrir](https://github.com/viralabs-dev/brabo-ci/actions/workflows/painel.yml?query=brabo-qa%2312) |');
    expect(rodar({ ...run, VINCULOS_ORIGEM: fx('origem-dispatch.json') }).summary).not.toContain('Painel da mudança');
  });

  it('sem GITHUB_RUN_ID etc. ainda sai 0', () => {
    expect(rodar({}).r.status).toBe(0);
  });

  it('tag sem a linha Carimbo: avisa', () => {
    const p = mkdtempSync(join(tmpdir(), 'vinc-tag-'));
    const g = (...a: string[]) => execFileSync('git', ['-C', p, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a]);
    g('init', '-q');
    g('commit', '-q', '--allow-empty', '-m', 'x');
    g('tag', '-a', 'v1.0.0', '-m', 'sem carimbo');
    const { r } = rodar({ ...run, GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: 'v1.0.0', GIT_DIR: join(p, '.git') });
    expect(r.stdout).toContain('sem a linha "Carimbo:"');
    g('tag', '-a', 'v1.0.1', '-m', 'Carimbo: https://github.com/viralabs-dev/brabo-api/actions/runs/5');
    const r2 = rodar({ ...run, GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: 'v1.0.1', GIT_DIR: join(p, '.git') });
    expect(r2.summary).toContain('https://github.com/viralabs-dev/brabo-api/actions/runs/5');
  });
});

describe('linhaDoPainel', () => {
  it('só com repo da org e PR numérica', () => {
    expect(linhaDoPainel({ repo: 'viralabs-dev/brabo-api', pr: 65, sha: A, ator: 'x' })?.url).toBe('https://github.com/viralabs-dev/brabo-ci/actions/workflows/painel.yml?query=brabo-api%2365');
    expect(linhaDoPainel({ repo: 'viralabs-dev/brabo-api', sha: A, ator: 'x' })).toBeNull();
    expect(linhaDoPainel({ repo: 'evil/x', pr: 1, sha: A, ator: 'x' })).toBeNull();
    expect(linhaDoPainel({ repo: 'viralabs-dev/brabo-api', pr: '1x', sha: A, ator: 'x' })).toBeNull();
  });
});
