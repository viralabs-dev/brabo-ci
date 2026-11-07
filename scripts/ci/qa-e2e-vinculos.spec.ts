import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { acharRun, escreverNoSummary, procurarRun, vinculosDoGatilho } from './qa-e2e-vinculos.ts';

const run = (t: string) => ({ display_title: t, html_url: `https://github.com/viralabs-dev/brabo-qa/actions/runs/${t.length}` });
const SHA = 'a'.repeat(40);
const base = {
  origem: { repo: 'viralabs-dev/brabo-api', pr: '48', sha: SHA, ator: 'daneiel', run_url: 'https://github.com/viralabs-dev/brabo-api/actions/runs/9' },
  este: { repo: 'viralabs-dev/brabo-api', sha: SHA, run_url: 'https://github.com/viralabs-dev/brabo-api/actions/runs/9' },
  urlDoCheck: 'https://github.com/viralabs-dev/brabo-api/runs/77',
};

describe('acharRun', () => {
  it('casa a correlação exata no display_title', () => {
    const a = run('E2E ← brabo-api#48 · aaaaaaa · daneiel · c=123-1');
    expect(acharRun([run('outro'), a], '123-1')).toBe(a);
  });
  it('não confunde 123-1 com 123-12 nem com 4123-1', () => {
    expect(acharRun([run('E2E c=123-12')], '123-1')).toBeUndefined();
    expect(acharRun([run('E2E c=4123-1')], '123-1')).toBeUndefined();
  });
});

describe('procurarRun', () => {
  it('acha na segunda volta', async () => {
    const achado = run('x c=5-1');
    const listar = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([achado]);
    const dormir = vi.fn(async () => {});
    expect(await procurarRun(listar, '5-1', { dormir })).toBe(achado);
    expect(dormir).toHaveBeenCalledTimes(1);
  });
  it('desiste depois de 60 s (12 voltas de 5 s) e tolera erro de rede', async () => {
    const listar = vi.fn().mockRejectedValue(new Error('rede'));
    const dormir = vi.fn(async () => {});
    expect(await procurarRun(listar, '5-1', { dormir })).toBeUndefined();
    expect(listar).toHaveBeenCalledTimes(13);
    expect(dormir).toHaveBeenCalledTimes(12);
  });
});

describe('vinculosDoGatilho', () => {
  it('com o run achado, o disparado é o run do qa', () => {
    const md = vinculosDoGatilho({ ...base, runDoQa: 'https://github.com/viralabs-dev/brabo-qa/actions/runs/55' });
    expect(md).toContain('| Disparado |  | E2E no brabo-qa |  | [abrir](https://github.com/viralabs-dev/brabo-qa/actions/runs/55) |');
    expect(md).toContain('[#48](https://github.com/viralabs-dev/brabo-api/pull/48) · daneiel');
  });
  it('sem o run, fica o link do check', () => {
    expect(vinculosDoGatilho(base)).toContain('| Disparado |  | Check na PR |  | [abrir](https://github.com/viralabs-dev/brabo-api/runs/77) |');
  });
});

describe('escreverNoSummary', () => {
  it('acrescenta no arquivo e não quebra sem ele', () => {
    const f = join(mkdtempSync(join(tmpdir(), 'sum-')), 's.md');
    writeFileSync(f, 'antes\n');
    escreverNoSummary('## V', { GITHUB_STEP_SUMMARY: f });
    expect(readFileSync(f, 'utf8')).toBe('antes\n## V\n');
    expect(() => escreverNoSummary('x', {})).not.toThrow();
    expect(() => escreverNoSummary('x', { GITHUB_STEP_SUMMARY: '/nao/existe/s.md' })).not.toThrow();
  });
});
