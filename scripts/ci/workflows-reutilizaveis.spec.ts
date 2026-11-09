import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

/**
 * Contrato dos workflows reutilizáveis (AT-816, AT-818):
 * - `ci_ref` obrigatório e sem `default` (tag ou ausência rodaria scripts de outra versão);
 * - todo job que roda `.brabo-ci/...` prepara o ambiente pela action local `preparar`,
 *   depois do checkout, e nenhum reutilizável fixa `node-version:` (o Node vem do `.node-version`).
 */

type Passo = { uses?: string; run?: string; with?: Record<string, unknown> };
type Doc = { on?: Record<string, { inputs?: Record<string, { required?: boolean; default?: unknown }> }>; jobs?: Record<string, { steps?: Passo[] }> };

const PREPARAR = './.brabo-ci/.github/actions/preparar';

export function violacoes(nome: string, conteudo: string): string[] {
  const doc = parse(conteudo) as Doc;
  const chamada = doc.on?.workflow_call;
  if (!chamada) return [];
  const v: string[] = [];
  const ci = chamada.inputs?.ci_ref;
  if ((ci || conteudo.includes('.brabo-ci')) && (!ci || ci.required !== true || 'default' in ci)) v.push(`${nome}: ci_ref precisa existir, com required: true e sem default`);
  if (/^\s*node-version:/m.test(conteudo)) v.push(`${nome}: node-version: literal (use .brabo-ci/.node-version pela action preparar)`);
  for (const [job, def] of Object.entries(doc.jobs ?? {})) {
    const passos = def.steps ?? [];
    const usa = passos.findIndex((p) => p.run?.includes('.brabo-ci/'));
    if (usa < 0) continue;
    const prep = passos.findIndex((p) => p.uses === PREPARAR);
    if (prep < 0 || prep > usa) v.push(`${nome}: job ${job} roda .brabo-ci/ sem passar antes por ${PREPARAR}`);
  }
  return v;
}

const dir = fileURLToPath(new URL('../../.github/workflows/', import.meta.url));

describe('workflows reutilizáveis', () => {
  for (const arq of readdirSync(dir).filter((f) => f.endsWith('.yml'))) {
    it(`${arq} segue o contrato`, () => {
      expect(violacoes(arq, readFileSync(dir + arq, 'utf8'))).toEqual([]);
    });
  }
});

describe('violacoes', () => {
  const base = (ci: string, passos: string) => `on:\n  workflow_call:\n    inputs:\n${ci}\njobs:\n  j:\n    steps:\n${passos}\n`;
  const ok = '      ci_ref:\n        required: true\n        type: string';
  it('reprova ci_ref com default, opcional ou ausente', () => {
    expect(violacoes('x', base(`${ok}\n        default: 'v1.0.0'`, ''))).toHaveLength(1);
    expect(violacoes('x', base('      ci_ref:\n        required: false\n        type: string', ''))).toHaveLength(1);
    expect(violacoes('x', base('      outro:\n        type: string', '      - run: ls .brabo-ci/')).filter((m) => m.includes('ci_ref'))).toHaveLength(1);
  });
  it('aceita ci_ref obrigatório; ignora workflow sem workflow_call', () => {
    expect(violacoes('x', base(ok, ''))).toEqual([]);
    expect(violacoes('x', 'on: push\njobs: {}\n')).toEqual([]);
  });
  it('reprova node .brabo-ci sem preparar, preparar depois do uso e node-version literal', () => {
    const run = '      - run: node .brabo-ci/scripts/ci/x.ts';
    const prep = `      - uses: ${PREPARAR}`;
    expect(violacoes('x', base(ok, run))).toHaveLength(1);
    expect(violacoes('x', base(ok, `${run}\n${prep}`))).toHaveLength(1);
    expect(violacoes('x', base(ok, `${prep}\n${run}`))).toEqual([]);
    expect(violacoes('x', base(ok, `${prep}\n      - uses: a/b@c\n        with:\n          node-version: 26`))).toHaveLength(1);
  });
});
