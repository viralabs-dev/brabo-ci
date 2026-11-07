import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// AT-769: `Regressivo do brabo-qa` atesta e nunca é exigido. Não há ruleset JSON neste repo (os
// rulesets moram na organização e em `brabo/.../rulesets.md`), então a guarda varre o que há aqui:
// JSON de ruleset e as linhas de doc que falam de "exigido".
const NOME = 'Regressivo do brabo-qa';
const raiz = join(import.meta.dirname, '..', '..');

function arquivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    if (['node_modules', '.git'].includes(d.name)) return [];
    const p = join(dir, d.name);
    return d.isDirectory() ? arquivos(p) : [p];
  });
}

/** Problemas num texto: contexto de ruleset com o nome, ou linha que o chama de exigido sem negar. */
export function exigencias(arquivo: string, texto: string): string[] {
  if (!texto.includes(NOME)) return [];
  if (arquivo.endsWith('.json')) return /required_status_checks|"context"/.test(texto) ? [`${arquivo}: contexto de ruleset`] : [];
  return texto
    .split('\n')
    .filter((l) => l.includes(NOME) && /exigid|obrigat[óo]ri|required/i.test(l) && !/nunca|n[ãa]o\s+(é|e|entra|ser|vira)|never|not\b/i.test(l))
    .map((l) => `${arquivo}: ${l.trim()}`);
}

describe('Regressivo do brabo-qa nunca é exigido', () => {
  it('nenhum arquivo do repo o cita como exigido', () => {
    const ruins = arquivos(raiz)
      .filter((a) => !/\.spec\.ts$/.test(a))
      .flatMap((a) => exigencias(relative(raiz, a), readFileSync(a, 'utf8')));
    expect(ruins).toEqual([]);
  });

  it('pega o JSON de ruleset e a doc que o chama de exigido', () => {
    expect(exigencias('r.json', `{"required_status_checks":[{"context":"${NOME}"}]}`)).toHaveLength(1);
    expect(exigencias('a.md', `O check \`${NOME}\` é exigido na dev.`)).toHaveLength(1);
    expect(exigencias('a.md', `The ${NOME} check is required.`)).toHaveLength(1);
  });

  it('deixa passar a negação e o JSON que não é de ruleset', () => {
    expect(exigencias('a.md', `O \`${NOME}\` nunca é exigido.`)).toEqual([]);
    expect(exigencias('a.md', `O \`${NOME}\` não é obrigatório.`)).toEqual([]);
    expect(exigencias('a.json', `{"nome":"${NOME}"}`)).toEqual([]);
  });
});
