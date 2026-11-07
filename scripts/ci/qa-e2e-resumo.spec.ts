import { describe, expect, it } from 'vitest';
import { NOME_DO_CHECK_POR_MODO, montarCheck, type LinhaDigest, type ResultadoE2e } from './qa-e2e-resumo.ts';

const linhas: LinhaDigest[] = (['api', 'engine', 'web', 'broker', 'backup'] as const).map((s) => ({
  servico: s,
  esperado: `sha256:${s}`,
  encontrado: `sha256:${s}`,
  assinatura: 'ok',
}));
const base: ResultadoE2e = { causa: null, linhas, specsQueFalharam: [], urlDoRun: 'https://run/1' };

describe('montarCheck', () => {
  it('verde', () => {
    const c = montarCheck(base);
    expect(c.conclusion).toBe('success');
    expect(c.title).toBe('E2E verde');
    expect(c.external_id).toBe('causa:');
    expect(c.summary).toContain('| serviço | digest esperado | digest em execução | assinatura |');
    expect(c.summary.split('\n').filter((l) => /^\| (api|engine|web|broker|backup) /.test(l))).toHaveLength(5);
    expect(c.summary).toContain('https://run/1');
  });
  it('digest divergente marca a linha com ❌', () => {
    const l = [...linhas];
    l[0] = { ...l[0]!, encontrado: 'sha256:outro' };
    const c = montarCheck({ ...base, causa: 'digest', linhas: l });
    expect(c.conclusion).toBe('failure');
    expect(c.title).toContain('digest divergente');
    expect(c.external_id).toBe('causa:digest');
    expect(c.summary).toMatch(/\| api .*❌/);
  });
  it('lista as specs que falharam', () => {
    const c = montarCheck({ ...base, causa: 'spec', specsQueFalharam: ['login.spec.ts', 'pop.spec.ts'] });
    expect(c.summary).toContain('login.spec.ts');
    expect(c.summary).toContain('pop.spec.ts');
  });
  it('aceite vira success com a justificativa', () => {
    const c = montarCheck({
      ...base,
      causa: 'spec',
      aceite: { justificativa: 'flaky conhecido', por: 'dono', em: '2026-11-06', urlDoRunVermelho: 'https://run/0' },
    });
    expect(c.conclusion).toBe('success');
    expect(c.title).toBe('Aceito com justificativa');
    for (const t of ['flaky conhecido', 'dono', '2026-11-06', 'https://run/0']) expect(c.summary).toContain(t);
  });
});

describe('modo dev (AT-769)', () => {
  const cobertura = [
    { funcionalidade: 'autenticacao', specs: 3, resultado: 'verde' as const },
    { funcionalidade: 'backlog', specs: 0, resultado: 'sem cobertura' as const },
    { funcionalidade: 'aprovacoes', specs: 1, resultado: 'vermelho' as const },
  ];
  it('o nome do check muda por modo e o da dev não é o do portão', () => {
    expect(NOME_DO_CHECK_POR_MODO.main).toBe('E2E do brabo-qa');
    expect(NOME_DO_CHECK_POR_MODO.dev).toBe('Regressivo do brabo-qa');
  });
  it('tabela por funcionalidade; "sem cobertura" não reprova e vermelho marca ❌', () => {
    const verde = montarCheck({ ...base, modo: 'dev', cobertura: cobertura.slice(0, 2) });
    expect(verde.conclusion).toBe('success');
    expect(verde.title).toBe('Regressivo verde');
    expect(verde.summary).toContain('| funcionalidade | specs | resultado |');
    expect(verde.summary).toContain('| backlog | 0 | sem cobertura |');
    const verm = montarCheck({ ...base, modo: 'dev', causa: 'spec', cobertura });
    expect(verm.conclusion).toBe('failure');
    expect(verm.title).toBe('Regressivo vermelho: spec falhou');
    expect(verm.summary).toContain('| aprovacoes | 1 | vermelho ❌ |');
  });
  it('sem linhas de digest, a tabela de digest não aparece', () => {
    const c = montarCheck({ ...base, modo: 'dev', linhas: [], cobertura });
    expect(c.summary).not.toContain('digest esperado');
  });
  it('neutro e sem dono', () => {
    const n = montarCheck({ ...base, modo: 'dev', neutro: 'sem funcionalidade tocada' });
    expect(n).toMatchObject({ conclusion: 'neutral', title: 'Regressivo neutro' });
    const s = montarCheck({ ...base, modo: 'dev', cobertura, semDono: ['src/zzz/x.ts'] });
    expect(s.summary).toContain('Sem dono no mapa:\n- src/zzz/x.ts');
  });
  it('o modo main segue igual: título E2E e sem tabela de funcionalidade', () => {
    const c = montarCheck(base);
    expect(c.title).toBe('E2E verde');
    expect(c.summary).not.toContain('funcionalidade');
  });
});
