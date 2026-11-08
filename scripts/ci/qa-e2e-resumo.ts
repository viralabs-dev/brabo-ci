/**
 * qa-e2e-resumo — monta o check (título, resumo e causa) (AT-765): `E2E do brabo-qa` na main (portão)
 * e `Regressivo do brabo-qa` na dev (AT-769), que nunca é exigido por ruleset.
 * Sintaxe apagável apenas (o Node executa este `.ts` por type stripping).
 */

import { TITULO_ACEITO, contraARecomendacao, extrairRecomendacao, type Causa } from './qa-e2e-aceite.ts';
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

export type StatusDaSpec = 'passou' | 'falhou' | 'flaky' | 'pulou';

export interface FuncionalidadeDoRelatorio {
  id: string;
  nome?: string;
  /** Por que entrou no conjunto (vem dos `motivos` do payload). */
  motivo: string[];
  specs: number;
  passou: number;
  falhou: number;
  flaky: number;
  pulou: number;
  duracao_ms: number;
  resultado: 'verde' | 'vermelho' | 'sem cobertura';
}

export interface SpecDoRelatorio {
  /** Vazio = spec sem `@f-*`: aparece no balde "sem funcionalidade" (RN-1053). */
  funcionalidades: string[];
  titulo: string;
  arquivo: string;
  linha: number;
  status: StatusDaSpec;
  tentativas: number;
  duracao_ms: number;
  erro?: string;
  anexos?: string[];
}

/**
 * `relatorio-regressivo.json` v1 (AT-791), escrito pelo brabo-qa. Causa, digests, run e vínculos vêm do `ResultadoE2e`.
 * Todo texto é escapado aqui de novo: o dado nasce do job que roda código de PR.
 */
export interface RelatorioRegressivo {
  versao: 1;
  origem: { repo: string; pr: number | string; sha: string };
  /** URL do artefato `relatorio-html-<run>`. */
  html?: string;
  /** Ids que o mapa liga à PR (`tocadas` do payload); ausente = todas as executadas (conservador: bloquear). */
  tocadas?: string[];
  funcionalidades: FuncionalidadeDoRelatorio[];
  specs: SpecDoRelatorio[];
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
  /** Markdown do helper `vinculos`; só a tabela entra no texto do check (o Mermaid não renderiza lá). AT-773. */
  vinculos?: string;
  aceite?: { justificativa: string; por: string; em: string; urlDoRunVermelho: string };
  /** Relatório de decisão (AT-791); sem ele o resumo é o de antes e não há `text`. */
  relatorio?: RelatorioRegressivo;
  /** Só com `aceite`: resumo e texto do check vermelho, preservados sob o bloco do aceite. */
  resumoAnterior?: string;
  textoAnterior?: string;
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

// ---------- Relatório de decisão (AT-791) ----------

/** Teto de `output.summary` e `output.text` do check é 65 535; fica folga para o aviso de corte. */
export const LIMITE_DO_CHECK = 60_000;
const MAX_FALHAS = 20;
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

const semAnsi = (t: string) => t.replace(ANSI, '');
/** Texto de PR numa célula ou linha: sem ANSI, quebra, `|`, crase nem `<`. */
const limpar = (t: string, max = 300) => semAnsi(t).replace(/[\r\n]+/g, ' ').replace(/\|/g, '\\|').replace(/`/g, "'").replace(/</g, '&lt;').slice(0, max);
const seg = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

export type Acao = 'aprovar' | 'bloquear' | 'aceitar com justificativa' | 'rodar de novo';

/** Regra da recomendação (RN-1051). */
export function recomendar(a: { causa: Causa | null; specs: SpecDoRelatorio[]; tocadas?: string[]; modo?: ModoDoCheck }): { acao: Acao; rotulo: string } {
  const flaky = a.specs.filter((s) => s.status === 'flaky');
  let acao: Acao;
  let porque: string;
  if (!a.causa) {
    acao = 'aprovar';
    porque = flaky.length > 0 ? `com aviso, ${flaky.length} spec(s) flaky` : 'sem falha';
  } else if (a.causa === 'digest' || a.causa === 'assinatura') {
    acao = 'bloquear';
    porque = `${a.causa} nunca se aceita; rode o E2E de novo`;
  } else if (a.causa === 'spec') {
    const tocadas = a.tocadas ? new Set(a.tocadas) : null;
    const dentro = a.specs.filter((s) => s.status === 'falhou').flatMap((s) => s.funcionalidades).filter((f) => !tocadas || tocadas.has(f));
    if (dentro.length > 0) {
      acao = 'bloquear';
      porque = `spec em funcionalidade que a PR toca (${[...new Set(dentro)].join(', ')}); corrigir antes`;
    } else {
      acao = 'aceitar com justificativa';
      porque = 'a falha está fora do que a PR muda';
    }
  } else {
    acao = 'rodar de novo';
    porque = 'se repetir, aceitar com justificativa';
  }
  return { acao, rotulo: `${a.modo === 'dev' ? 'atestado (não bloqueia): ' : ''}${acao}: ${porque}` };
}

export interface Secao {
  texto: string;
  /** 1 = nunca cai primeiro; maior = cai antes. A ordem de exibição é a do vetor. */
  prioridade: number;
}

/**
 * Junta as seções dentro do limite: tira as de maior `prioridade` (a igual, a do fim) e deixa o aviso.
 * Se nem uma seção cabe, corta o texto dela.
 */
export function caber(secoes: Secao[], limite = LIMITE_DO_CHECK, artefato = 'relatorio-regressivo'): { texto: string; truncado: boolean } {
  const juntar = (l: Secao[]) => l.map((x) => x.texto).join('\n\n');
  let ficam = [...secoes];
  if (juntar(ficam).length <= limite) return { texto: juntar(ficam), truncado: false };
  const aviso = (n: number) => `\n\n… ${n} itens a mais no artefato ${artefato}`;
  while (ficam.length > 1 && juntar(ficam).length + aviso(secoes.length - ficam.length + 1).length > limite) {
    let k = 0;
    ficam.forEach((x, i) => {
      if (x.prioridade >= ficam[k]!.prioridade) k = i;
    });
    ficam = ficam.filter((_, i) => i !== k);
  }
  const a = aviso(Math.max(secoes.length - ficam.length, 1));
  return { texto: juntar(ficam).slice(0, limite - a.length) + a, truncado: true };
}

/** "Por que estas funcionalidades": uma linha por funcionalidade com os caminhos que a puxaram. */
export function secaoMotivos(fs: { id: string; motivo: string[] }[], semDono: string[] = []): string {
  const linhas = fs.filter((f) => f.motivo.length > 0).map((f) => `- **${limpar(f.id, 80)}**: ${f.motivo.map((m) => `\`${limpar(m, 200)}\``).join(', ')}`);
  const sem = semDono.slice(0, 20).map((c) => `- sem dono no mapa: \`${limpar(c, 200)}\``);
  return linhas.length + sem.length === 0 ? '' : ['### Por que estas funcionalidades', ...linhas, ...sem].join('\n');
}

const ICONE: Record<StatusDaSpec, string> = { passou: '✅', falhou: '❌', flaky: '⚠️', pulou: '⏭️' };
// O qa manda o título limpo; se um dia vier com o sufixo, não duplica.
const preparacao = (s: SpecDoRelatorio) => (/\.setup\.[jt]s$/.test(s.arquivo) && !s.titulo.endsWith('(preparação)') ? ' (preparação)' : '');
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const linhaDeSpec = (s: SpecDoRelatorio) =>
  `- ${ICONE[s.status]} ${limpar(s.titulo, 200)}${preparacao(s)} · \`${limpar(s.arquivo, 200)}:${s.linha}\` · ${seg(s.duracao_ms)}${s.tentativas > 1 ? ` · ${s.tentativas} tentativas` : ''}`;

function digestTabela(linhas: LinhaDigest[]): string[] {
  return [
    '| serviço | digest esperado | digest em execução | assinatura |',
    '|---|---|---|---|',
    ...linhas.map((l) => {
      const ruim = l.encontrado !== l.esperado || l.assinatura === 'falhou';
      return `| ${l.servico} | \`${l.esperado}\` | ${l.encontrado ? `\`${l.encontrado}\`` : '-'} | ${l.assinatura}${ruim ? ' ❌' : ''} |`;
    }),
  ];
}

function secoesDoResumo(r: ResultadoE2e, rel: RelatorioRegressivo, rec: string, linhasDeErro: number, artefato: string): Secao[] {
  const modo: ModoDoCheck = r.modo ?? 'main';
  const conta = (st: StatusDaSpec) => rel.specs.filter((s) => s.status === st).length;
  const total = rel.specs.reduce((a, s) => a + s.duracao_ms, 0);
  const cabecalho = [
    `## ${NOME_DO_CHECK_POR_MODO[modo]}: ${r.causa ? 'VERMELHO' : 'VERDE'}${r.causa ? ` · causa ${r.causa}` : ''}`,
    `**Recomendação: ${rec.replace(/\*/g, '')}**`,
    `${modo === 'dev' ? 'Atestado da dev (não bloqueia)' : 'Portão da main'} · \`${limpar(rel.origem.repo, 80)}#${limpar(String(rel.origem.pr), 12)} @${limpar(rel.origem.sha, 12)}\` · ${seg(total)} de specs`,
    `${rel.specs.length} specs · ${plural(conta('passou'), 'passou', 'passaram')} · ${plural(conta('falhou'), 'falhou', 'falharam')} · ${conta('flaky')} flaky${conta('pulou') ? ` · ${conta('pulou')} puladas` : ''}`,
  ].join('\n\n');

  const cob = [...rel.funcionalidades.filter((f) => f.resultado !== 'sem cobertura'), ...rel.funcionalidades.filter((f) => f.resultado === 'sem cobertura')];
  const orfas = rel.specs.filter((s) => s.funcionalidades.length === 0);
  const n = (l: SpecDoRelatorio[], st: StatusDaSpec) => l.filter((s) => s.status === st).length;
  const tabela = [
    '| funcionalidade | specs | ✅ | ❌ | flaky | tempo | resultado |',
    '|---|---|---|---|---|---|---|',
    ...cob.map((f) => `| ${limpar(f.id, 80)} | ${f.specs} | ${f.passou} | ${f.falhou} | ${f.flaky} | ${seg(f.duracao_ms)} | ${f.resultado}${f.resultado === 'vermelho' ? ' ❌' : ''} |`),
    ...(orfas.length > 0
      ? [`| sem funcionalidade | ${orfas.length} | ${n(orfas, 'passou')} | ${n(orfas, 'falhou')} | ${n(orfas, 'flaky')} | ${seg(orfas.reduce((a, s) => a + s.duracao_ms, 0))} | ${n(orfas, 'falhou') ? 'vermelho ❌' : 'verde'} |`]
      : []),
  ].join('\n');

  const falhas = rel.specs.filter((s) => s.status === 'falhou');
  const secFalhas = falhas.slice(0, MAX_FALHAS).map((s) => {
    const ids = s.funcionalidades.length > 0 ? s.funcionalidades.map((f) => `f-${limpar(f, 60)}`).join(', ') : 'sem funcionalidade';
    const erro = semAnsi(s.erro ?? '').split('\n').slice(0, linhasDeErro).map((l) => l.slice(0, 300)).join('\n').replace(/```/g, "'''");
    return [
      `**[${ids}] ${limpar(s.titulo, 200)}**${preparacao(s)} · \`${limpar(s.arquivo, 200)}:${s.linha}\` · ${s.tentativas} tentativa(s)`,
      ...(erro ? ['```text', erro, '```'] : []),
      ...(s.anexos?.length ? [`Anexos (no artefato ${artefato}): ${s.anexos.slice(0, 5).map((a) => `\`${limpar(a, 120)}\``).join(', ')}`] : []),
    ].join('\n');
  });
  if (falhas.length > MAX_FALHAS) secFalhas.push(`… ${falhas.length - MAX_FALHAS} itens a mais no artefato ${artefato}`);
  const causaFora = r.causa && r.causa !== 'spec' ? `Causa: ${TITULOS[r.causa]}. Valem os digests e a assinatura abaixo, não as specs.` : '';

  const secFlaky = rel.specs.filter((s) => s.status === 'flaky').slice(0, MAX_FALHAS)
    .map((s) => `- ${limpar(s.titulo, 200)} · \`${limpar(s.arquivo, 200)}:${s.linha}\` · passou na tentativa ${s.tentativas} (${seg(s.duracao_ms)})`);
  const digests = r.linhas.length > 0 ? digestTabela(r.linhas).join('\n') : '';
  const v = r.vinculos ? r.vinculos.split('```mermaid')[0]!.trimEnd() : '';
  const links = [`Run: ${r.urlDoRun}`, rel.html ? `Relatório HTML do Playwright: ${rel.html}` : `Artefato: ${artefato}`].join('\n');
  const motivos = secaoMotivos(rel.funcionalidades, r.semDono);

  return [
    { texto: cabecalho, prioridade: 1 },
    ...(secFalhas.length || causaFora ? [{ texto: ['### Falhas', causaFora, ...secFalhas].filter(Boolean).join('\n\n'), prioridade: 2 }] : []),
    { texto: tabela, prioridade: 2 },
    ...(motivos ? [{ texto: motivos, prioridade: 4 }] : []),
    ...(secFlaky.length ? [{ texto: ['### Flaky / retry', ...secFlaky].join('\n'), prioridade: 3 }] : []),
    ...(digests ? [{ texto: ['### Digests e assinatura', digests].join('\n\n'), prioridade: 3 }] : []),
    { texto: links, prioridade: 1 },
    ...(v ? [{ texto: v, prioridade: 5 }] : []),
  ];
}

/** `output.text`: um `<details>` por funcionalidade com as specs; sem as verdes quando não cabe. */
function textoDoRelatorio(rel: RelatorioRegressivo, artefato: string): string {
  const grupos = [
    ...rel.funcionalidades.filter((f) => f.specs > 0).map((f) => ({ id: f.id, specs: rel.specs.filter((s) => s.funcionalidades.includes(f.id)) })),
    ...(rel.specs.some((s) => s.funcionalidades.length === 0) ? [{ id: 'sem funcionalidade', specs: rel.specs.filter((s) => s.funcionalidades.length === 0) }] : []),
  ];
  const montar = (soProblemas: boolean): Secao[] =>
    grupos.map((g) => {
      const ruins = g.specs.filter((s) => s.status !== 'passou');
      const puladas = g.specs.filter((s) => s.status === 'pulou').length;
      const problemas = ruins.length - puladas;
      const mostra = soProblemas ? ruins : g.specs;
      const omitidas = g.specs.length - mostra.length;
      return {
        texto: [
          `<details><summary>${limpar(g.id, 80)} · ${g.specs.length - ruins.length} ✅${problemas ? ` · ${problemas} ❌/⚠️` : ''}${puladas ? ` · ${plural(puladas, 'pulada', 'puladas')} ⏭️` : ''}</summary>`,
          '',
          ...mostra.map(linhaDeSpec),
          ...(omitidas > 0 ? [`- … ${omitidas} itens a mais no artefato ${artefato}`] : []),
          '',
          '</details>',
        ].join('\n'),
        prioridade: ruins.length > 0 ? 1 : 2,
      };
    });
  const cheio = caber(montar(false), LIMITE_DO_CHECK, artefato);
  return cheio.truncado ? caber(montar(true), LIMITE_DO_CHECK, artefato).texto : cheio.texto;
}

export function montarCheck(r: ResultadoE2e): { conclusion: 'success' | 'failure' | 'neutral'; title: string; summary: string; text?: string; external_id: string } {
  const dev = r.modo === 'dev';
  const nome = (t: string) => (dev ? t.replace(/^E2E/, 'Regressivo') : t);
  const v = r.vinculos ? `\n\n${r.vinculos.split('```mermaid')[0]!.trimEnd()}` : '';
  if (r.neutro) return { conclusion: 'neutral', title: nome('E2E neutro'), summary: `${r.neutro}\n\nRun: ${r.urlDoRun}${v}`, external_id: 'causa:' };
  const external_id = `causa:${r.causa ?? ''}`;

  // O aceite preserva o relatório do vermelho (AT-791): o bloco vai por cima, o resto fica como estava.
  if (r.aceite && r.resumoAnterior !== undefined) {
    const a = r.aceite;
    const rec = extrairRecomendacao(r.resumoAnterior);
    const bloco = [
      `Aceito por @${a.por} em ${a.em}.`,
      `Justificativa: ${a.justificativa}`,
      `Run vermelho: ${a.urlDoRunVermelho}`,
      ...(rec ? [`Recomendação do relatório: ${rec}${contraARecomendacao(rec) ? ' (aceito contra a recomendação)' : ''}`] : []),
    ].join('\n\n');
    const summary = caber([{ texto: bloco, prioridade: 1 }, { texto: r.resumoAnterior, prioridade: 2 }]).texto;
    return { conclusion: 'success', title: TITULO_ACEITO, summary, ...(r.textoAnterior ? { text: r.textoAnterior } : {}), external_id };
  }

  const rel = r.relatorio;
  if (rel && !r.aceite) {
    const artefato = `relatorio-regressivo-${/\/runs\/(\d+)/.exec(r.urlDoRun)?.[1] ?? '<run>'}`;
    const rec = recomendar({ causa: r.causa, specs: rel.specs, tocadas: rel.tocadas, modo: r.modo }).rotulo;
    let summary = '';
    for (const linhasDeErro of [15, 3]) {
      const c = caber(secoesDoResumo(r, rel, rec, linhasDeErro, artefato), LIMITE_DO_CHECK, artefato);
      summary = c.texto;
      if (!c.truncado) break;
    }
    return { conclusion: r.causa ? 'failure' : 'success', title: nome(r.causa ? TITULOS[r.causa] : 'E2E verde'), summary, text: textoDoRelatorio(rel, artefato), external_id };
  }

  const partes = [...(r.cobertura ? tabelaDeCobertura(r.cobertura) : []), ...(r.linhas.length > 0 || !r.cobertura ? digestTabela(r.linhas) : []), '', `Run: ${r.urlDoRun}`];
  if (r.semDono?.length) partes.push('', 'Sem dono no mapa:', ...r.semDono.map((c) => `- ${c}`));
  if (r.specsQueFalharam.length > 0) partes.push('', 'Specs que falharam:', ...r.specsQueFalharam.map((s) => `- ${s}`));
  if (r.aceite) {
    const a = r.aceite;
    partes.push('', `Aceito por @${a.por} em ${a.em}.`, `Justificativa: ${a.justificativa}`, `Run vermelho: ${a.urlDoRunVermelho}`);
    return { conclusion: 'success', title: TITULO_ACEITO, summary: partes.join('\n') + v, external_id };
  }
  return { conclusion: r.causa ? 'failure' : 'success', title: nome(r.causa ? TITULOS[r.causa] : 'E2E verde'), summary: partes.join('\n') + v, external_id };
}
