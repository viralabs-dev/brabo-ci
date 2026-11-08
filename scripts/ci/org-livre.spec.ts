// Guarda (AT-831): os reutilizáveis não presumem a org viralabs-dev. O checkout lê `inputs.ci_repo`
// (padrão viralabs-dev/brabo-ci) e o dono vem de `github.repository_owner`.
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { donoDe } from './dono.ts';

const WORKFLOWS = join(resolve(import.meta.dirname, '..', '..'), '.github', 'workflows');
const reutilizaveis = readdirSync(WORKFLOWS)
  .filter((f) => f.endsWith('.yml'))
  .map((f) => ({ f, texto: readFileSync(join(WORKFLOWS, f), 'utf8') }))
  .filter(({ texto }) => /^\s+workflow_call:/m.test(texto));

describe('reutilizáveis sem org fixa', () => {
  it.each(reutilizaveis)('$f: sem repository:/owner:/scope: literal da viralabs-dev', ({ texto }) => {
    const codigo = texto.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
    expect(codigo).not.toMatch(/repository:\s*viralabs-dev\//);
    expect(codigo).not.toMatch(/owner:\s*viralabs-dev\b/);
    expect(codigo).not.toMatch(/scope:\s*'@viralabs-dev'/);
  });

  it.each(reutilizaveis.filter(({ texto }) => texto.includes('inputs.ci_repo')))('$f: declara o input ci_repo com o padrão de hoje', ({ texto }) => {
    const input = parse(texto).on.workflow_call.inputs.ci_repo;
    expect(input).toMatchObject({ type: 'string', required: false, default: 'viralabs-dev/brabo-ci' });
  });
});

describe('donoDe', () => {
  it('lê GITHUB_REPOSITORY_OWNER e cai no padrão se vazio ou fora do formato', () => {
    expect(donoDe({ GITHUB_REPOSITORY_OWNER: 'minha-org' })).toBe('minha-org');
    expect(donoDe({})).toBe('viralabs-dev');
    expect(donoDe({ GITHUB_REPOSITORY_OWNER: 'a/../b|x' })).toBe('viralabs-dev');
  });
});

describe('vinculos com outro dono', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it('aceita repo e URL do dono do chamador e recusa os da viralabs-dev', async () => {
    vi.stubEnv('GITHUB_REPOSITORY_OWNER', 'outra-org');
    vi.resetModules();
    const { URL_OK } = await import('./vinculos.ts');
    expect(URL_OK.test('https://github.com/outra-org/brabo-api/pull/1')).toBe(true);
    expect(URL_OK.test('https://github.com/viralabs-dev/brabo-api/pull/1')).toBe(false);
  });
});
