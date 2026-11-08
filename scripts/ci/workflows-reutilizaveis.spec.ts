import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

/**
 * Contrato dos workflows reutilizáveis (AT-816):
 * - `ci_ref` obrigatório e sem `default` (tag ou ausência rodaria scripts de outra versão);
 */

type Passo = { uses?: string; run?: string; with?: Record<string, unknown> };
type Doc = { on?: Record<string, { inputs?: Record<string, { required?: boolean; default?: unknown }> }>; jobs?: Record<string, { steps?: Passo[] }> };

export function violacoes(nome: string, conteudo: string): string[] {
  const doc = parse(conteudo) as Doc;
  const chamada = doc.on?.workflow_call;
  if (!chamada) return [];
  const v: string[] = [];
  const ci = chamada.inputs?.ci_ref;
  if ((ci || conteudo.includes('.brabo-ci')) && (!ci || ci.required !== true || 'default' in ci)) v.push(`${nome}: ci_ref precisa existir, com required: true e sem default`);
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
    expect(violacoes('x', base('      outro:\n        type: string', '      - run: ls .brabo-ci/'))).toHaveLength(1);
  });
  it('aceita ci_ref obrigatório; ignora workflow sem workflow_call', () => {
    expect(violacoes('x', base(ok, ''))).toEqual([]);
    expect(violacoes('x', 'on: push\njobs: {}\n')).toEqual([]);
  });
});
