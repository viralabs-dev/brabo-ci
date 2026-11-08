import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

/** Regra do CLAUDE.md (AT-822): linguagem só por segurança; actions e docker semanais; tudo pela `dev`. */
type Entrada = { 'package-ecosystem': string; 'target-branch'?: string; 'open-pull-requests-limit'?: number; schedule?: { interval?: string } };

const LINGUAGEM = ['npm', 'mix', 'pip', 'cargo', 'gomod'];
const SEMANAL = ['github-actions', 'docker'];

export function violacoes(conteudo: string): string[] {
  const v: string[] = [];
  for (const e of ((parse(conteudo) as { updates?: Entrada[] }).updates ?? [])) {
    const eco = e['package-ecosystem'];
    if (LINGUAGEM.includes(eco) && e['open-pull-requests-limit'] !== 0) v.push(`${eco}: open-pull-requests-limit precisa ser 0`);
    if (SEMANAL.includes(eco) && e.schedule?.interval !== 'weekly') v.push(`${eco}: interval precisa ser weekly`);
    if (e['target-branch'] !== 'dev') v.push(`${eco}: target-branch precisa ser dev`);
  }
  return v;
}

describe('dependabot.yml', () => {
  it('o arquivo real segue a regra', () => {
    const arq = fileURLToPath(new URL('../../.github/dependabot.yml', import.meta.url));
    expect(violacoes(readFileSync(arq, 'utf8'))).toEqual([]);
  });
  it('reprova npm com limite 3, actions mensal e target-branch errado', () => {
    const y = (eco: string, extra: string) => `updates:\n  - package-ecosystem: ${eco}\n    target-branch: dev\n    schedule:\n      interval: weekly\n${extra}`;
    expect(violacoes(y('npm', '    open-pull-requests-limit: 3\n'))).toHaveLength(1);
    expect(violacoes(y('npm', '    open-pull-requests-limit: 0\n'))).toEqual([]);
    expect(violacoes(y('github-actions', '').replace('weekly', 'monthly'))).toHaveLength(1);
    expect(violacoes(y('docker', '').replace('dev', 'main'))).toHaveLength(1);
  });
});
