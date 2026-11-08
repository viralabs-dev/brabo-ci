import { describe, expect, it } from 'vitest';
import { MARCA, acaoDoLembrete, corpoDoLembrete, faltando, lembrar, tagsDe, type Api } from './qa-regressivo-lembrete.ts';

const base = { repo: 'brabo-api', modo: 'funcionalidades' as const, tocadas: ['autenticacao'], comSpecMudada: [] as string[] };

describe('faltando (AT-852)', () => {
  it('tocada sem spec mudada: lembra', () => expect(faltando(base)).toEqual(['autenticacao']));
  it('spec @f-X mudada: não lembra', () => expect(faltando({ ...base, comSpecMudada: ['autenticacao'] })).toEqual([]));
  it('modo completo: não lembra', () => expect(faltando({ ...base, modo: 'completo' })).toEqual([]));
  it('PR do qa e do contracts: não lembra', () => {
    expect(faltando({ ...base, repo: 'brabo-qa' })).toEqual([]);
    expect(faltando({ ...base, repo: 'brabo-contracts' })).toEqual([]);
  });
});

describe('acaoDoLembrete', () => {
  it('sem comentário e lista vazia: nada', () => expect(acaoDoLembrete([], null)).toBeNull());
  it('sem comentário e com lista: cria com a marca', () => {
    const a = acaoDoLembrete(['autenticacao'], null);
    expect(a?.tipo).toBe('criar');
    expect(a?.corpo.startsWith(MARCA)).toBe(true);
  });
  it('comentário existente: edita, não cria', () => expect(acaoDoLembrete(['x'], { id: 1, corpo: 'velho' })?.tipo).toBe('editar'));
  it('mesmo corpo: nada', () => expect(acaoDoLembrete(['x'], { id: 1, corpo: corpoDoLembrete(['x']) })).toBeNull());
  it('resolvido com comentário: edita', () => expect(acaoDoLembrete([], { id: 1, corpo: corpoDoLembrete(['x']) })?.tipo).toBe('editar'));
});

describe('tagsDe', () => {
  it('extrai ids', () => expect(tagsDe("test('a @f-autenticacao @f-chat-sessao', ...)")).toEqual(['autenticacao', 'chat-sessao']));
});

function fake(comentarios: object[], specNoQa = 'test("@f-outra")') {
  const chamadas: string[] = [];
  const api: Api = {
    texto: async () => specNoQa,
    gh: async (c, init) => {
      chamadas.push(`${init?.method ?? 'GET'} ${c}`);
      if (/\/pulls\/7$/.test(c)) return { base: { sha: 'b' }, body: '' };
      if (/commits\/b$/.test(c)) return { commit: { committer: { date: '2026-01-01T00:00:00Z' } } };
      if (c.includes('/commits?sha=dev')) return [{ sha: 'q1' }];
      if (/commits\/q1$/.test(c)) return { files: [{ filename: 'e2e/testes/a.spec.ts' }] };
      if (c.includes('/comments?')) return comentarios;
      return null;
    },
  };
  return { api, chamadas };
}
const ent = { dono: 'viralabs-dev', nome: 'brabo-api', pr: '7', modo: 'funcionalidades' as const, tocadas: ['autenticacao'], aviso: () => {} };

describe('lembrar', () => {
  it('sem comentário: POST', async () => {
    const { api, chamadas } = fake([]);
    await lembrar(api, ent);
    expect(chamadas.filter((c) => c.startsWith('POST'))).toHaveLength(1);
  });
  it('comentário existente: PATCH, nunca POST', async () => {
    const { api, chamadas } = fake([{ id: 9, body: `${MARCA}\nvelho`, user: { type: 'Bot' } }]);
    await lembrar(api, ent);
    expect(chamadas.some((c) => c.startsWith('PATCH') && c.endsWith('/comments/9'))).toBe(true);
    expect(chamadas.some((c) => c.startsWith('POST'))).toBe(false);
  });
  it('spec do X mudada no qa: não comenta', async () => {
    const { api, chamadas } = fake([], 'test("@f-autenticacao")');
    await lembrar(api, ent);
    expect(chamadas.some((c) => c.startsWith('POST'))).toBe(false);
  });
  it('erro vira aviso e não lança', async () => {
    const avisos: string[] = [];
    await lembrar({ gh: async () => { throw new Error('boom'); }, texto: async () => '' }, { ...ent, aviso: (m) => avisos.push(m) });
    expect(avisos[0]).toContain('boom');
  });
  it('repo qa: não chama a API', async () => {
    const { api, chamadas } = fake([]);
    await lembrar(api, { ...ent, nome: 'brabo-qa' });
    expect(chamadas).toEqual([]);
  });
});
