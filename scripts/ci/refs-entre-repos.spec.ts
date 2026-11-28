import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPOS, donoDe, executar, type Fonte, sentidoA, sentidoB } from './refs-entre-repos.ts';

const mem = (arquivos: Record<string, string>): Fonte => ({ arquivos: Object.keys(arquivos), ler: (c) => arquivos[c] ?? null });

const codigo = (linhas: string[]) => linhas.join('\n');
const ELIXIR_ANTES = codigo(['a', 'b', 'def subir_no_aceite do', 'c', 'd']);
// o símbolo andou 30 linhas
const ELIXIR_DEPOIS = codigo([...Array(30).fill('x'), 'a', 'b', 'def subir_no_aceite do', 'c']);

const doc = (linha: number) => `# RN\n\n- Sobe no aceite: \`apps/engine/lib/lead.ex:${linha}\` (\`subir_no_aceite\`).\n`;
const DOC = 'docs/business-rules/api.md';

describe('donoDe', () => {
  it('mapeia apps/<x> e packages; o resto é de ninguém', () => {
    expect(donoDe('apps/engine/lib/a.ex')).toEqual({ repo: 'engine', noRepo: 'lib/a.ex' });
    expect(donoDe('packages/shared/src/a.ts')).toEqual({ repo: 'contracts', noRepo: 'packages/shared/src/a.ts' });
    expect(donoDe('src/a.ts')).toBeNull();
    expect(donoDe('apps/ci/a')).toBeNull();
  });
});

describe('infra', () => {
  it('é um repo conhecido, mas nenhum caminho é dela (docker/ existe também no web)', () => {
    expect(REPOS).toContain('infra');
    expect(donoDe('docker/compose.yml')).toBeNull();
    expect(donoDe('deploy/k8s/a.yaml')).toBeNull();
  });
});

describe('sentido (a): doc dona da ref', () => {
  const engine = mem({ 'lib/lead.ex': ELIXIR_ANTES });
  const viz = (r: string) => (r === 'engine' ? engine : mem({ 'docs/business-rules/web.md': '# RN\n' }));

  it('ref que bate: nada', () => {
    const r = sentidoA('api', mem({ [DOC]: doc(3) }), mem({}), viz);
    expect(r).toMatchObject({ total: 1, novas: [], antigas: [] });
  });

  it('ref NOVA errada reprova (exit 1) e sugere a linha', () => {
    const o = executar({ repo: 'api', head: mem({ [DOC]: doc(843) }), base: mem({ [DOC]: doc(3) }), vizinho: viz });
    expect(o.codigo).toBe(1);
    expect(o.linhas[0]).toContain('::error');
  });

  it('ref JÁ quebrada (mesma tupla na base) só avisa (exit 0)', () => {
    const o = executar({ repo: 'api', head: mem({ [DOC]: doc(843) }), base: mem({ [DOC]: doc(843) }), vizinho: viz });
    expect(o.codigo).toBe(0);
    expect(o.linhas.some((l) => l.startsWith('::warning') && l.includes('já quebrada'))).toBe(true);
  });

  it('mutação: sem a base, a antiga viraria nova', () => {
    const r = sentidoA('api', mem({ [DOC]: doc(843) }), mem({}), viz);
    expect(r.novas).toHaveLength(1);
  });

  it('--escrever reancora a externa errada', () => {
    const escritos: Record<string, string> = {};
    const o = executar({ repo: 'api', head: mem({ [DOC]: doc(40) }), base: mem({ [DOC]: doc(40) }), vizinho: viz, escrever: (d, t) => (escritos[d] = t) });
    expect(o.codigo).toBe(0);
    expect(escritos[DOC]).toContain('lib/lead.ex:3`');
  });
});

describe('sentido (b): quem moveu o código', () => {
  const api = mem({ [DOC]: doc(3) });
  const base = mem({ 'lib/lead.ex': ELIXIR_ANTES });
  const head = mem({ 'lib/lead.ex': ELIXIR_DEPOIS });

  it('símbolo andou: aviso, exit 0 e patch com a linha nova', () => {
    const saida = mkdtempSync(join(tmpdir(), 'saida-'));
    const o = executar({ repo: 'engine', head, base, vizinho: (r) => (r === 'api' ? api : mem({})), saida });
    expect(o.codigo).toBe(0);
    expect(o.linhas.some((l) => l.startsWith('::warning') && l.includes('esta PR quebra'))).toBe(true);
    const patch = readFileSync(join(saida, 'brabo-api.patch'), 'utf8');
    expect(patch).toContain('--- a/docs/business-rules/api.md');
    expect(patch).toContain('+- Sobe no aceite: `apps/engine/lib/lead.ex:33`');
  });

  it('ref que já estava quebrada na base não é culpa da PR', () => {
    const quebrada = mem({ [DOC]: doc(900) });
    const r = sentidoB('engine', base, head, { api: quebrada });
    expect(r.quebras).toHaveLength(0);
  });

  it('arquivo removido no head: quebra sem patch', () => {
    const r = sentidoB('engine', base, mem({}), { api });
    expect(r.quebras).toHaveLength(1);
    expect(r.quebras[0]!.novaLinha).toBeNull();
  });

  it('nenhum vizinho com RN: CEGO', () => {
    expect(executar({ repo: 'engine', head, base, vizinho: () => mem({}) }).codigo).toBe(1);
  });
});
