import { describe, expect, it } from 'vitest';
import { avaliarAceite, type EntradaAceite } from './qa-e2e-aceite.ts';

const J = 'a justificativa tem 25 chr';
const base: EntradaAceite = {
  acao: 'created',
  autor: 'dono',
  owner: 'dono',
  corpo: `/qa-aceitar ${J}`,
  baseRef: 'main',
  check: { conclusao: 'failure', externalId: 'causa:spec', titulo: 'E2E vermelho' },
};
const com = (p: Partial<EntradaAceite>): EntradaAceite => ({ ...base, ...p });
const check = (c: Partial<NonNullable<EntradaAceite['check']>>) => com({ check: { ...base.check!, ...c } });
const motivo = (e: EntradaAceite) => {
  const v = avaliarAceite(e);
  return 'motivo' in v ? v.motivo : '';
};

describe('avaliarAceite', () => {
  it('ignora corpo sem o comando e comentário editado', () => {
    expect(avaliarAceite(com({ corpo: 'oi' }))).toEqual({ ignorar: true });
    expect(avaliarAceite(com({ acao: 'edited' }))).toEqual({ ignorar: true });
    expect(avaliarAceite(com({ acao: 'deleted' }))).toEqual({ ignorar: true });
  });
  it('recusas', () => {
    expect(motivo(com({ autor: 'outro' }))).toContain('OWNER_HANDLE');
    expect(motivo(com({ baseRef: 'dev' }))).toContain('main');
    expect(motivo(com({ corpo: '/qa-aceitar 1234567890123456789' }))).toContain('20');
    expect(motivo(check({ conclusao: 'success', titulo: 'Aceito com justificativa' }))).toContain('já aceito');
    expect(motivo(check({ conclusao: 'success', titulo: 'E2E verde' }))).toContain('verde');
    expect(motivo(check({ externalId: 'causa:digest' }))).toContain('digest');
    expect(motivo(check({ externalId: 'causa:assinatura' }))).toContain('assinatura');
    expect(motivo(com({ check: null }))).toContain('não há check');
  });
  it('aceita spec, ambiente e sem-resposta, com a justificativa aparada', () => {
    expect(avaliarAceite(com({ corpo: `  /qa-aceitar   ${J}  \n` }))).toEqual({ aceito: true, justificativa: J });
    expect(avaliarAceite(check({ externalId: 'causa:ambiente' }))).toMatchObject({ aceito: true });
    expect(avaliarAceite(check({ externalId: 'causa:sem-resposta' }))).toMatchObject({ aceito: true });
  });
});
