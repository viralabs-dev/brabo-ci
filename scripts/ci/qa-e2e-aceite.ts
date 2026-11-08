/**
 * qa-e2e-aceite — decide se um `/qa-aceitar <justificativa>` vale (AT-765).
 * Sintaxe apagável apenas (o Node executa este `.ts` por type stripping).
 */

export type Causa = 'spec' | 'ambiente' | 'digest' | 'assinatura' | 'sem-resposta';
export const MINIMO_DA_JUSTIFICATIVA = 20;
export const TITULO_ACEITO = 'Aceito com justificativa';

export interface EntradaAceite {
  acao: 'created' | 'edited' | 'deleted';
  autor: string;
  owner: string;
  corpo: string;
  baseRef: string;
  check: { conclusao: 'success' | 'failure' | 'cancelled' | null; externalId: string | null; titulo: string } | null;
}

export type VereditoAceite = { aceito: true; justificativa: string } | { aceito: false; motivo: string } | { ignorar: true };

export function avaliarAceite(e: EntradaAceite): VereditoAceite {
  // Só o comentário recém-criado vale: editar depois de postado não reabre o aceite.
  if (e.acao !== 'created') return { ignorar: true };
  const m = /^\/qa-aceitar\s+(.+)$/s.exec(e.corpo.trim());
  if (!m) return { ignorar: true };
  const justificativa = (m[1] ?? '').trim();

  const recusa = (motivo: string): VereditoAceite => ({ aceito: false, motivo });
  if (e.autor.toLowerCase() !== e.owner.toLowerCase()) return recusa('só o OWNER_HANDLE pode aceitar.');
  if (e.baseRef !== 'main') return recusa('o aceite vale só para PR com base em `main`.');
  if (justificativa.length < MINIMO_DA_JUSTIFICATIVA) {
    return recusa(`a justificativa precisa ter pelo menos ${MINIMO_DA_JUSTIFICATIVA} caracteres.`);
  }
  if (!e.check) return recusa('não há check "E2E do brabo-qa" no head atual.');
  if (e.check.conclusao === 'success') {
    return recusa(e.check.titulo === TITULO_ACEITO ? 'já aceito.' : 'o check está verde, não há o que aceitar.');
  }
  if (e.check.conclusao !== 'failure') return recusa('o check ainda não terminou vermelho.');
  const causa = (e.check.externalId ?? '').replace(/^causa:/, '');
  if (causa === 'digest') return recusa('falha de digest nunca é aceita: rode o E2E de novo.');
  if (causa === 'assinatura') return recusa('falha de assinatura nunca é aceita: rode o E2E de novo.');
  if (causa !== 'spec' && causa !== 'ambiente' && causa !== 'sem-resposta') {
    return recusa('o check ainda não terminou ou não tem causa conhecida.');
  }
  return { aceito: true, justificativa };
}

/** A linha `**Recomendação: …**` que o relatório do regressivo põe no resumo do check (AT-791). */
export function extrairRecomendacao(resumo: string): string | null {
  return /\*\*Recomendação:\s*([^*\n]+?)\s*\*\*/.exec(resumo)?.[1] ?? null;
}

/** Aceitar vale mesmo contra `bloquear` (a decisão é do dono), mas fica registrado. */
export const contraARecomendacao = (rec: string | null): boolean => /^(atestado[^:]*:\s*)?bloquear/i.test(rec ?? '');

/** Resposta ao `/qa-aceitar`: cita a recomendação que o relatório dava (AT-791). */
export function comentarioDoAceite(por: string, justificativa: string, resumoAnterior: string): string {
  const rec = extrairRecomendacao(resumoAnterior);
  return [
    `Aceito com justificativa por @${por}: ${justificativa}`,
    ...(rec ? [`Recomendação do relatório: ${rec}`] : []),
    ...(contraARecomendacao(rec) ? ['Aceito contra a recomendação.'] : []),
  ].join('\n\n');
}
