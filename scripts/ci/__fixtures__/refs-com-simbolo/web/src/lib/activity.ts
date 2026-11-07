import type { ComponentType } from 'react';
import type { DelegationEventPayload, SessionEvent } from './api-types';
import { AGENTS } from './agents';
import { linhaDoEventoDePolitica } from './decisao-da-politica';
import {
  BranchIcon,
  CommitIcon,
  DiffIcon,
  HypothesisIcon,
  PermissionIcon,
  PrIcon,
  SessionIcon,
  StackIcon,
  TerminalIcon,
} from '../components/ui/icons';

export type ActivityKind =
  | 'commit'
  | 'pr'
  | 'hypothesis'
  | 'session'
  | 'permission'
  | 'terminal'
  | 'delegation'
  | 'generic';

export interface ActivityDisplay {
  kind: ActivityKind;
  icon: ComponentType<{ size?: number; className?: string }>;
  color: string;
  bad: boolean;
  text: string;
}

/**
 * Eventos de MÁQUINA — existem pro sistema derivar estado, não pro humano ler.
 *
 * `agent.status` passou a ser persistido no ADR 0021 (o painel precisa dele pra
 * saber quem está trabalhando), e sem esta lista ele vira ruído no feed: dois
 * "infra · agent.status" por turno, sem informação nenhuma. `tool.call`/
 * `tool.result`/`agent.response` são o mesmo caso — internos do ciclo do
 * agente, já visíveis na tela da sessão.
 *
 * Achado rodando o feed contra o event log REAL: 116 de 193 eventos caíam no
 * fallback genérico, quase todos destes tipos.
 */
const EVENTOS_DE_MAQUINA = new Set([
  'agent.status',
  'agent.response',
  'agent.delta',
  'tool.call',
  'tool.result',
  'context.compacted',
]);

/** Se o feed deve ESCONDER o evento (ruído de máquina, não narrativa). */
export function isMachineEvent(event: SessionEvent): boolean {
  return EVENTOS_DE_MAQUINA.has(event.type);
}

/**
 * A ORIGEM de um evento (RN-177) — quem o produziu, no sentido de qual CAMADA,
 * não de qual agente.
 *
 * É uma classificação NOVA e independente do `ActivityKind`, que responde
 * outra pergunta: `kind` diz DE QUE ASSUNTO o evento fala (commit, PR,
 * permissão) e decide ícone e cor; `origem` diz DE ONDE ele veio, e é o que
 * permite recolher o histórico em punhados legíveis em vez de uma lista
 * infinita. Um `tool.call` e um `git.push` podem ser os dois do mesmo agente e
 * do mesmo turno, e ainda assim quem lê quer separá-los.
 *
 * As seis saem do dado que EXISTE — `actor.kind` (`user | agent | system`) e o
 * prefixo do `type` —, nunca de suposição sobre quem emitiu:
 *
 * - `harness` — a maquinaria do laço: `tool.*`, `toolloop.*`, `agent.status`,
 *   `context.compacted`. É quase tudo que `isMachineEvent` esconde, e é por
 *   isso que o toggle e o agrupamento nasceram juntos.
 * - `llm` — o turno do modelo em si: `agent.response`, `agent.delta`, `llm.*`.
 * - `usuario` / `sistema` — decididos pelo ATOR, porque é o ator que os define.
 * - `agente` — o que o agente fez enquanto agente e não enquanto domínio:
 *   entrar na sessão, falhar, passar o bastão, delegar, perguntar.
 * - `eventos` — o event log de DOMÍNIO propriamente dito (backlog, git, PR,
 *   artefato, bootstrap, permissão…), que é o resto.
 *
 * A precedência importa e está escrita na ordem dos `if`: `harness` e `llm`
 * vêm ANTES do ator porque são categorias de MECANISMO — um `tool.call` é do
 * harness qualquer que seja o ator —, e `usuario`/`sistema` vêm antes dos
 * prefixos de agente porque `chat.message` do humano não é fala de agente.
 *
 * Aceita a forma ESTRUTURAL (`{ type, actor: { kind } }`) em vez de
 * `SessionEvent` inteiro de propósito: o fio da sessão precisa classificar
 * também o card de uma `ProposedAction`, que não é evento e nunca terá `seq`
 * nem `payload`.
 */
export type OrigemDeEvento =
  | 'eventos'
  | 'sistema'
  | 'llm'
  | 'harness'
  | 'agente'
  | 'usuario';

/** A ordem em que os grupos aparecem — a MESMA em que o pedido os nomeou. */
export const ORDEM_DAS_ORIGENS: OrigemDeEvento[] = [
  'eventos',
  'sistema',
  'llm',
  'harness',
  'agente',
  'usuario',
];

export const ROTULO_DA_ORIGEM: Record<OrigemDeEvento, string> = {
  eventos: 'Log de eventos',
  sistema: 'Sistema',
  llm: 'LLM',
  harness: 'Harness',
  agente: 'Agente',
  usuario: 'Usuário',
};

const TIPOS_DO_HARNESS = new Set(['agent.status', 'context.compacted']);
const TIPOS_DO_LLM = new Set(['agent.response', 'agent.delta']);
const PREFIXOS_DE_AGENTE = ['agent.', 'handoff.', 'delegation.', 'chat.'];

export function origemDoEvento(event: {
  type: string;
  actor: { kind: string };
}): OrigemDeEvento {
  const { type } = event;
  if (
    TIPOS_DO_HARNESS.has(type) ||
    type.startsWith('tool.') ||
    type.startsWith('toolloop.')
  ) {
    return 'harness';
  }
  if (TIPOS_DO_LLM.has(type) || type.startsWith('llm.')) return 'llm';
  if (event.actor.kind === 'user') return 'usuario';
  if (event.actor.kind === 'system') return 'sistema';
  if (PREFIXOS_DE_AGENTE.some((p) => type.startsWith(p))) return 'agente';
  return 'eventos';
}

/**
 * Agrupa por origem PRESERVANDO a ordem de `ORDEM_DAS_ORIGENS` e descartando
 * grupo vazio — um cabeçalho "Harness · 0" seria ruído com outro nome.
 *
 * Genérico no item, e não fixo em `SessionEvent`, porque os dois consumidores
 * agrupam coisas diferentes: o painel agrupa EVENTOS, e o fio da sessão agrupa
 * ENTRADAS já renderizadas (que podem ser um colapso por agente inteiro).
 */
export function agruparPorOrigem<T>(
  itens: T[],
  origemDe: (item: T) => OrigemDeEvento,
): { origem: OrigemDeEvento; itens: T[] }[] {
  const porOrigem = new Map<OrigemDeEvento, T[]>();
  for (const item of itens) {
    const origem = origemDe(item);
    const grupo = porOrigem.get(origem);
