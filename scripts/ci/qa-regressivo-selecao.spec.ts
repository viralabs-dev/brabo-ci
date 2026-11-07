import { describe, expect, it } from 'vitest';
import { lerCatalogo, selecionar, type Funcionalidade } from './qa-regressivo-selecao.ts';

// Fixture no formato da nota da AT-769; o arquivo real é `brabo-qa/funcionalidades.yml`.
const catalogo = lerCatalogo(`
funcionalidades:
  - id: autenticacao
    status: ativa
    caminhos:
      api: ['src/**/{auth,iam}/**']
      web: ['src/routes/LoginPage*', 'src/components/AcessoRapido*']
  - id: aprovacoes
    status: ativa
    caminhos:
      api: ['src/**/actions/**']
  - id: container-e-broker
    status: ativa
    caminhos:
      broker: ['src/**']
  - id: instalacao
    status: ativa
    caminhos:
      infra: ['docker/backup/**']
  - id: velha
    status: aposentada
    caminhos:
      api: ['src/**/velha/**']
`);
const sel = (repo: string, arquivos: string[], extra: object = {}) => selecionar({ repo, arquivos, catalogo, ...extra });
const todas = ['autenticacao', 'aprovacoes', 'container-e-broker', 'instalacao'];

describe('selecionar', () => {
  it('mapa casa: só as funcionalidades dos globs, na ordem do catálogo', () => {
    expect(sel('brabo-api', ['src/application/actions/x.ts', 'src/interfaces/http/auth/a.ts'])).toEqual({
      modo: 'funcionalidades', funcionalidades: ['autenticacao', 'aprovacoes'], semDono: [],
    });
  });
  it('aceita o repo com e sem prefixo e a lista na raiz', () => {
    expect(selecionar({ repo: 'web', arquivos: ['src/routes/LoginPage.tsx'], catalogo: lerCatalogo('- {id: a, caminhos: {brabo-web: ["src/routes/**"]}}') }).funcionalidades).toEqual(['a']);
  });
  it('regra 1: docs, md, testes, .claude e .github viram nenhum', () => {
    const r = sel('brabo-api', ['docs/a.md', 'README.md', 'src/auth/a.test.ts', 'test/x.exs', '.claude/agents/a.md', '.github/workflows/ci.yml']);
    expect(r).toEqual({ modo: 'nenhum', funcionalidades: [], semDono: [] });
  });
  it('regra 1: o próprio qa-e2e.yml não é nada, vira sem dono', () => {
    expect(sel('brabo-api', ['.github/workflows/qa-e2e.yml']).semDono).toEqual(['.github/workflows/qa-e2e.yml']);
  });
  it.each([
    ['brabo-api', 'pnpm-lock.yaml'], ['brabo-api', 'Dockerfile'], ['brabo-engine', 'mix.lock'], ['brabo-engine', 'config/runtime.exs'],
    ['brabo-api', 'src/db/schema.ts'], ['brabo-web', 'src/lib/socket.ts'], ['brabo-web', 'src/router.tsx'],
    ['brabo-infra', 'docker/docker-compose.install.yml'], ['brabo-qa', 'e2e/suporte/api.ts'],
  ])('regra 2: %s %s roda o catálogo inteiro (sem aposentadas)', (repo, arquivo) => {
    expect(sel(repo, ['src/application/actions/x.ts', arquivo])).toEqual({ modo: 'completo', funcionalidades: todas, semDono: [] });
  });
  it('regra 2 por repo: src/lib no api não é catálogo inteiro', () => {
    expect(sel('brabo-api', ['src/lib/x.ts']).modo).not.toBe('completo');
  });
  it('regra 3: sem dono roda o smoke e lista o caminho', () => {
    expect(sel('brabo-api', ['src/zzz/x.ts'])).toEqual({ modo: 'funcionalidades', funcionalidades: ['autenticacao', 'instalacao'], semDono: ['src/zzz/x.ts'] });
  });
  it('regra 3 soma ao que o mapa achou', () => {
    const r = sel('brabo-api', ['src/application/actions/x.ts', 'src/zzz/x.ts']);
    expect(r.funcionalidades).toEqual(['autenticacao', 'aprovacoes', 'instalacao']);
  });
  it('aposentada nunca roda', () => {
    expect(sel('brabo-api', ['src/application/velha/x.ts']).funcionalidades).toEqual(['autenticacao', 'instalacao']);
  });
  it('contracts não tem regressivo na própria PR', () => {
    expect(sel('brabo-contracts', ['packages/contracts/src/a.ts', 'package.json'])).toEqual({ modo: 'nenhum', funcionalidades: [], semDono: [] });
  });
  it('qa: spec alterado vale as tags dele; sem tag conhecida vale o catálogo inteiro', () => {
    const arq = ['e2e/testes/a.spec.ts'];
    expect(sel('brabo-qa', arq, { tagsDosSpecs: { 'e2e/testes/a.spec.ts': ['aprovacoes', 'inexistente'] } }).funcionalidades).toEqual(['aprovacoes']);
    expect(sel('brabo-qa', arq).modo).toBe('completo');
  });
  it('repo sem globs no catálogo cai em sem dono', () => {
    expect(sel('brabo-runner', ['src/a.ts']).semDono).toEqual(['src/a.ts']);
  });
});

describe('lerCatalogo', () => {
  it('recusa arquivo sem lista', () => {
    expect(() => lerCatalogo('a: 1')).toThrow('sem a lista');
  });
  it('tipo', () => {
    const f: Funcionalidade[] = lerCatalogo('- {id: x}');
    expect(f[0]!.id).toBe('x');
  });
});
