import { describe, expect, it } from 'vitest';
import { montarCheck, type LinhaDigest, type ResultadoE2e } from './qa-e2e-resumo.ts';

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
