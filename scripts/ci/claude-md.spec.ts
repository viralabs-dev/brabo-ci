import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(import.meta.dirname, '..', '..');
const texto = readFileSync(join(RAIZ, 'CLAUDE.md'), 'utf8');

// Caminhos que só existem em tempo de execução ou que o texto cita como proibidos.
const DE_EXECUCAO = ['.brabo-ci/', '.release/gate.json', 'refs/archive/', '.claude/rules/', 'website/docs/'];

describe('CLAUDE.md descreve só o brabo-ci', () => {
  it('cabe no teto de 12 mil caracteres', () => {
    expect([...texto].length).toBeLessThan(12000);
  });

  it('não repete bloco (linha longa duplicada)', () => {
    const longas = texto.split('\n').filter((l) => l.length > 40);
    expect(longas.filter((l, i) => longas.indexOf(l) !== i)).toEqual([]);
  });

  it('todo caminho entre crases existe aqui ou leva o prefixo brabo-<x>:', () => {
    const candidatos = [...texto.matchAll(/`([^`\s]+)`/g)]
      .map((m) => m[1]!)
      .filter((c) => /\/|\.(ts|yml|md|sh|json)$/.test(c))
      .filter((c) => !/[<*~:]|^https?|^\^/.test(c) && !DE_EXECUCAO.some((d) => c.startsWith(d)))
      .filter((c) => !c.includes('{') && !/^[a-z]+\/$|^\w+\/\w+\/$/.test(c) && !/^(breaking|feature|bugfix|perf|refactor|chore|docs|test|hotfix|dependabot)\//.test(c));
    const faltam = candidatos.filter(
      (c) => ![c, `scripts/ci/${c}`, `.github/workflows/${c}`].some((p) => existsSync(join(RAIZ, p))),
    );
    expect(faltam).toEqual([]);
  });
});
