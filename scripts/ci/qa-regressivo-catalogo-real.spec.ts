import { readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';
import picomatch from 'picomatch';
import { describe, expect, it } from 'vitest';
import { lerCatalogo, selecionar } from './qa-regressivo-selecao.ts';

// Cópia do `funcionalidades.yml` real do brabo-qa (feature/catalogo-de-funcionalidades).
const catalogo = lerCatalogo(readFileSync(new URL('./__fixtures__/funcionalidades.real.yml', import.meta.url), 'utf8'));
const sel = (repo: string, arquivos: string[]) => selecionar({ repo, arquivos, catalogo });

describe('catálogo real', () => {
  it('lê as 14 funcionalidades ativas', () => {
    expect(catalogo).toHaveLength(14);
    expect(catalogo.every((f) => f.status === 'ativa')).toBe(true);
  });
  it.each([
    ['brabo-api', ['src/application/use-cases/auth/login.ts', 'src/interfaces/http/sessions/c.ts', 'src/infrastructure/llm/x.ts'], ['autenticacao', 'sessao-e-canal', 'llm-e-gasto']],
    ['brabo-engine', ['lib/engine/harness/run.ex', 'lib/engine/actions/a.ex', 'lib/engine_web/channels/s.ex'], ['sessao-e-canal', 'turno-do-agente', 'aprovacoes']],
    ['brabo-web', ['src/routes/LoginPage.tsx', 'src/components/ApprovalCard.tsx', 'src/components/ContainersTable.tsx'], ['autenticacao', 'aprovacoes', 'container-e-broker']],
    ['brabo-broker', ['src/operacoes.ts'], ['container-e-broker']],
    ['brabo-runner', ['src/runner.ts'], ['runner']],
    ['brabo-infra', ['docker/backup/backup.sh'], ['instalacao']],
  ])('%s: caminhos reais caem nas funcionalidades certas', (repo, arquivos, esperado) => {
    const r = sel(repo, arquivos);
    expect(r.modo).toBe('funcionalidades');
    expect(r.semDono).toEqual([]);
    expect([...r.funcionalidades].sort()).toEqual([...esperado].sort());
  });
  it('arquivo em pasta oculta não casa glob do catálogo (como no matchesGlob)', () => {
    expect(sel('brabo-api', ['src/.hidden/auth/a.ts']).semDono).toEqual(['src/.hidden/auth/a.ts']);
  });
  it('caminho fora do mapa vira sem dono + smoke', () => {
    expect(sel('brabo-api', ['src/zzz/x.ts'])).toMatchObject({ semDono: ['src/zzz/x.ts'], funcionalidades: ['autenticacao', 'instalacao'] });
  });
});

// Prova cruzada (caminhos de ARQUIVO). Divergências medidas e resolvidas: com `dot: true` o picomatch casa
// `src/.hidden/auth/a.ts` e o matchesGlob não (por isso o catálogo usa picomatch sem `dot`); `x/**` casa o
// diretório `x` no picomatch e não no matchesGlob, o que não importa para a lista de arquivos de uma PR.
// Prova cruzada: a L1 valida o mapa com `path.matchesGlob` (Node 26); aqui se casa com picomatch.
const amostras = [
  'src/auth/a.ts', 'src/application/use-cases/auth/login.ts', 'src/iam/x.ts', 'src/authx/a.ts', 'src/a/b/c/sessions/d.ts', 
  'src/infrastructure/llm/a.ts', 'src/infrastructure/huggingface/a/b.ts', 'src/infrastructure/other/a.ts',
  'src/application/artifact-projection/a.ts', 'src/application/graph-projection/a/b.ts',
  'src/routes/LoginPage.tsx', 'src/LoginPage.tsx', 'src/components/LoginPageHelper.tsx', 'src/components/x/AcessoRapidoCard.tsx', 'src/routes/Other.tsx',
  'src/espelho.ts', 'src/espelho-x/a.ts', 'src/pasta-do-projeto/a.ts', 'src/main.ts', 'src/a/b.ts',
  'lib/engine/sessions/a.ex', 'lib/engine/session_events/a/b.ex', 'lib/engine/sessions_x/a.ex', 'lib/engine_web/channels/a.ex', 'lib/engine_web/other/a.ex',
  'lib/engine/harness/a.ex', 'lib/engine/psychologist/a.ex', 'lib/engine/dev/a.ex', 'lib/engine/infra/a/b.ex', 'lib/engine/runners/a.ex',
  'docker/backup/a.sh', 'docker/other/a.sh', '.github/x.yml', 'src/.hidden/auth/a.ts',
];
describe('picomatch x path.matchesGlob (globs do catálogo real)', () => {
  const globs = [...new Set(catalogo.flatMap((f) => Object.values(f.caminhos ?? {}).flat()))];
  it('o arquivo real tem globs', () => expect(globs.length).toBeGreaterThan(15));
  it.each(globs)('%s', (glob) => {
    const pm = picomatch(glob);
    const divergem = amostras.filter((a) => pm(a) !== matchesGlob(a, glob));
    expect(divergem).toEqual([]);
  });
});
