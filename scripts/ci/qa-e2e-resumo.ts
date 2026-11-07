/**
 * qa-e2e-resumo — monta o check (título, resumo e causa) (AT-765): `E2E do brabo-qa` na main (portão)
 * e `Regressivo do brabo-qa` na dev (AT-769), que nunca é exigido por ruleset.
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

export type ModoDoCheck = 'main' | 'dev';

/** O nome do check por modo. O da dev NUNCA entra em ruleset (decisão do dono, 06/11/2026). */
export const NOME_DO_CHECK_POR_MODO: Record<ModoDoCheck, string> = {
  main: 'E2E do brabo-qa',
  dev: 'Regressivo do brabo-qa',
};

export interface LinhaFuncionalidade {
  funcionalidade: string;
  specs: number;
  resultado: 'verde' | 'vermelho' | 'sem cobertura';
}

export interface ResultadoE2e {
  /** Padrão `main`. */
  modo?: ModoDoCheck;
  /** Tabela por funcionalidade; funcionalidade sem spec entra como "sem cobertura" e não reprova. */
  cobertura?: LinhaFuncionalidade[];
  /** Caminhos que o mapa não cobre (regra 3 da AT-769), para o mapa ser corrigido. */
  semDono?: string[];
  /** Motivo de nada rodar (só docs, fork, repo sem spec): check `neutral`. */
  neutro?: string;
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

function tabelaDeCobertura(c: LinhaFuncionalidade[]): string[] {
  return [
    '| funcionalidade | specs | resultado |',
    '|---|---|---|',
    ...c.map((l) => `| ${l.funcionalidade} | ${l.specs} | ${l.resultado}${l.resultado === 'vermelho' ? ' ❌' : ''} |`),
    '',
  ];
}

export function montarCheck(r: ResultadoE2e): { conclusion: 'success' | 'failure' | 'neutral'; title: string; summary: string; external_id: string } {
  const dev = r.modo === 'dev';
  const nome = (t: string) => (dev ? t.replace(/^E2E/, 'Regressivo') : t);
  if (r.neutro) return { conclusion: 'neutral', title: nome('E2E neutro'), summary: `${r.neutro}\n\nRun: ${r.urlDoRun}`, external_id: 'causa:' };
  const tabela = [
    '| serviço | digest esperado | digest em execução | assinatura |',
    '|---|---|---|---|',
    ...r.linhas.map((l) => {
      const ruim = l.encontrado !== l.esperado || l.assinatura === 'falhou';
      return `| ${l.servico} | \`${l.esperado}\` | ${l.encontrado ? `\`${l.encontrado}\`` : '-'} | ${l.assinatura}${ruim ? ' ❌' : ''} |`;
    }),
  ];
  const partes = [...(r.cobertura ? tabelaDeCobertura(r.cobertura) : []), ...(r.linhas.length > 0 || !r.cobertura ? tabela : []), '', `Run: ${r.urlDoRun}`];
  if (r.semDono?.length) partes.push('', 'Sem dono no mapa:', ...r.semDono.map((c) => `- ${c}`));
  if (r.specsQueFalharam.length > 0) partes.push('', 'Specs que falharam:', ...r.specsQueFalharam.map((s) => `- ${s}`));

  const external_id = `causa:${r.causa ?? ''}`;
  if (r.aceite) {
    const a = r.aceite;
    partes.push('', `Aceito por @${a.por} em ${a.em}.`, `Justificativa: ${a.justificativa}`, `Run vermelho: ${a.urlDoRunVermelho}`);
    return { conclusion: 'success', title: TITULO_ACEITO, summary: partes.join('\n'), external_id };
  }
  return {
    conclusion: r.causa ? 'failure' : 'success',
    title: nome(r.causa ? TITULOS[r.causa] : 'E2E verde'),
    summary: partes.join('\n'),
    external_id,
  };
}
