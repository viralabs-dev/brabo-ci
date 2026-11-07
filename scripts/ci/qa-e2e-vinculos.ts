/**
 * qa-e2e-vinculos — acha o run do `e2e-pr` disparado pelo gatilho (pela correlação no `display_title`)
 * e escreve o Vínculos no Summary do run de origem (AT-773).
 *
 * O `repository_dispatch` responde 204 sem id: o `run-name` do e2e-pr leva `c=<run_id>-<attempt>`.
 * Nunca reprova o job. Sintaxe apagável apenas (o Node executa este `.ts` por type stripping).
 */

import { appendFileSync } from 'node:fs';
import { montar, type Origem } from './vinculos.ts';

export interface RunDoQa {
  display_title: string;
  html_url: string;
}

/** `c=123-1` não casa `c=123-12` nem `c=1234-1`. */
export function acharRun(runs: RunDoQa[], correlacao: string): RunDoQa | undefined {
  const re = new RegExp(`(^|[^0-9A-Za-z-])c=${correlacao.replace(/[^0-9-]/g, '')}(?![0-9])`);
  return runs.find((r) => re.test(r.display_title));
}

export async function procurarRun(
  listar: () => Promise<RunDoQa[]>,
  correlacao: string,
  opc: { limiteMs?: number; intervaloMs?: number; dormir?: (ms: number) => Promise<void> } = {},
): Promise<RunDoQa | undefined> {
  const { limiteMs = 60_000, intervaloMs = 5_000, dormir = (ms) => new Promise((r) => setTimeout(r, ms)) } = opc;
  for (let gasto = 0; ; gasto += intervaloMs) {
    try {
      const achou = acharRun(await listar(), correlacao);
      if (achou) return achou;
    } catch {
      // erro de rede conta como "ainda não": a próxima volta tenta de novo
    }
    if (gasto + intervaloMs > limiteMs) return undefined;
    await dormir(intervaloMs);
  }
}

/** Markdown do Vínculos do gatilho; sem o run achado, o disparado é o link do check. */
export function vinculosDoGatilho(a: {
  origem: Origem;
  este: { repo: string; sha: string; run_url: string };
  runDoQa?: string;
  urlDoCheck: string;
  aviso?: (m: string) => void;
}): string {
  const disparados = a.runDoQa
    ? [{ rotulo: 'E2E no brabo-qa', url: a.runDoQa }]
    : [{ rotulo: 'Check na PR', url: a.urlDoCheck }];
  return montar({ origem: a.origem, este: a.este, irmaos: [], destino: [], disparados }, a.aviso);
}

export function escreverNoSummary(md: string, env: NodeJS.ProcessEnv = process.env): void {
  try {
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${md}\n`);
  } catch (e) {
    console.log(`::warning::vinculos: Summary ilegível (${(e as Error).name}), job segue`);
  }
}
