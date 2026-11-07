// Guarda (AT-785): todo job que roda `node .brabo-ci/scripts/ci/X.ts` cujo grafo de imports
// relativos chega a um pacote npm precisa instalar as dependências do brabo-ci antes.
// O `disparar` do portão da main quebrou assim: importou a seleção (picomatch) sem instalar.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const WORKFLOWS = join(RAIZ, '.github', 'workflows');

export function importsDe(arquivo: string): string[] {
  const fonte = readFileSync(arquivo, 'utf8');
  return [...fonte.matchAll(/^\s*import\s+(?:type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/gm)]
    .filter((m) => !/^\s*import\s+type\b/.test(m[0]))
    .map((m) => m[1] ?? '');
}

/** Pacotes npm (não `node:` nem relativos) alcançados a partir de `arquivo`. */
export function pacotesAlcancados(arquivo: string, vistos = new Set<string>()): Set<string> {
  const pacotes = new Set<string>();
  if (vistos.has(arquivo)) return pacotes;
  vistos.add(arquivo);
  for (const alvo of importsDe(arquivo)) {
    if (alvo.startsWith('.')) {
      const caminho = resolve(dirname(arquivo), alvo);
      if (existsSync(caminho)) for (const p of pacotesAlcancados(caminho, vistos)) pacotes.add(p);
    } else if (!alvo.startsWith('node:')) {
      pacotes.add(alvo);
    }
  }
  return pacotes;
}

/** Quebra o YAML em blocos de job (`  nome:` sob `jobs:`), sem dependência de parser. */
export function jobsDe(yaml: string): { nome: string; corpo: string }[] {
  const depois = yaml.split(/^jobs:\s*$/m)[1] ?? '';
  const partes = depois.split(/^ {2}([A-Za-z0-9_-]+):\s*$/m);
  const jobs: { nome: string; corpo: string }[] = [];
  for (let i = 1; i < partes.length; i += 2) jobs.push({ nome: partes[i] ?? '', corpo: partes[i + 1] ?? '' });
  return jobs;
}

export function faltasDeInstalacao(yaml: string, raiz = RAIZ): string[] {
  const faltas: string[] = [];
  for (const { nome, corpo } of jobsDe(yaml)) {
    const instala = /install[^\n]*--dir \.brabo-ci/.test(corpo);
    for (const m of corpo.matchAll(/node \.brabo-ci\/(scripts\/ci\/[A-Za-z0-9_.-]+\.ts)/g)) {
      const rel = m[1];
      if (!rel) continue;
      const script = join(raiz, rel);
      if (!existsSync(script)) continue;
      const pacotes = pacotesAlcancados(script);
      if (pacotes.size > 0 && !instala) faltas.push(`${nome}: ${rel} precisa de ${[...pacotes].join(', ')}`);
    }
  }
  return faltas;
}

describe('workflows instalam o que os scripts importam (AT-785)', () => {
  for (const nome of readdirSync(WORKFLOWS).filter((f) => f.endsWith('.yml'))) {
    it(nome, () => {
      expect(faltasDeInstalacao(readFileSync(join(WORKFLOWS, nome), 'utf8'))).toEqual([]);
    });
  }

  it('acusa job que roda script com pacote npm sem instalar', () => {
    const yaml = 'jobs:\n  disparar:\n    steps:\n      - run: node .brabo-ci/scripts/ci/qa-e2e-disparar.ts\n';
    expect(faltasDeInstalacao(yaml)).toEqual([expect.stringContaining('disparar: scripts/ci/qa-e2e-disparar.ts precisa de')]);
  });

  it('aceita o mesmo job com a instalação', () => {
    const yaml =
      'jobs:\n  disparar:\n    steps:\n      - run: npx --yes pnpm@11.3.0 install --frozen-lockfile --prod --ignore-scripts --dir .brabo-ci\n      - run: node .brabo-ci/scripts/ci/qa-e2e-disparar.ts\n';
    expect(faltasDeInstalacao(yaml)).toEqual([]);
  });
});
