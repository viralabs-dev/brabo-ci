/**
 * qa-e2e-resumo — monta o check "E2E do brabo-qa" (título, resumo e causa) (AT-765).
 * Sintaxe apagável apenas (o Node executa este `.ts` por type stripping).
 */

import { TITULO_ACEITO, type Causa } from './qa-e2e-aceite.ts';
import type { Servico } from './qa-e2e-imagens.ts';

export interface LinhaDigest {
  servico: Servico;
  esperado: string;
  encontrado: string | null;
  assinatura: 'ok' | 'falhou' | 'não conferida';
}

export interface ResultadoE2e {
  causa: Causa | null;
  linhas: LinhaDigest[];
  specsQueFalharam: string[];
  urlDoRun: string;
  aceite?: { justificativa: string; por: string; em: string; urlDoRunVermelho: string };
}

const TITULOS: Record<Causa, string> = {
  spec: 'E2E vermelho: spec falhou',
  ambiente: 'E2E vermelho: ambiente',
  digest: 'E2E vermelho: digest divergente',
  assinatura: 'E2E vermelho: assinatura inválida',
  'sem-resposta': 'E2E vermelho: sem resposta do brabo-qa',
};

export function montarCheck(r: ResultadoE2e): { conclusion: 'success' | 'failure'; title: string; summary: string; external_id: string } {
  const tabela = [
    '| serviço | digest esperado | digest em execução | assinatura |',
    '|---|---|---|---|',
    ...r.linhas.map((l) => {
      const ruim = l.encontrado !== l.esperado || l.assinatura === 'falhou';
      return `| ${l.servico} | \`${l.esperado}\` | ${l.encontrado ? `\`${l.encontrado}\`` : '-'} | ${l.assinatura}${ruim ? ' ❌' : ''} |`;
    }),
  ];
  const partes = [...tabela, '', `Run: ${r.urlDoRun}`];
  if (r.specsQueFalharam.length > 0) partes.push('', 'Specs que falharam:', ...r.specsQueFalharam.map((s) => `- ${s}`));

  const external_id = `causa:${r.causa ?? ''}`;
  if (r.aceite) {
    const a = r.aceite;
    partes.push('', `Aceito por @${a.por} em ${a.em}.`, `Justificativa: ${a.justificativa}`, `Run vermelho: ${a.urlDoRunVermelho}`);
    return { conclusion: 'success', title: TITULO_ACEITO, summary: partes.join('\n'), external_id };
  }
  return {
    conclusion: r.causa ? 'failure' : 'success',
    title: r.causa ? TITULOS[r.causa] : 'E2E verde',
    summary: partes.join('\n'),
    external_id,
  };
}
