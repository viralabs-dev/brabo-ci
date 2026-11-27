import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { descobrir, gerarIndice, lerParte, pesar, principal, TETO_KB } from './indice-de-rn.ts';

const INDICE = [
  '---',
  'id: rn-api',
  '---',
  '',
  '# API',
  '',
  'Abertura que fica.',
  '',
  '| Parte | Desde | RNs | Seções |',
  '|---|---|---|---|',
  '| [parte 1](api/parte-01.md) | RN-001 | 1 | — |',
  '',
  'A grade abaixo preserva as âncoras antigas.',
  '',
  '<a id="rn-001"></a>[001](api/parte-01.md#rn-001)',
  '',
].join('\n');
const P1 = '## Sessão {#sessao}\n### RN-001 — a {#rn-001}\nVeja a RN-777 no texto.\n### RN-003 — c\n';
const P2 = '## Sessão {#sessao-2}\n## Outra\n#### RN-1500 — nova\n### RN-1500 — repetida na mesma parte\n';

describe('lerParte', () => {
  it('cabeçalho define, citação não; seções sem o {#id} e sem repetir', () => {
    expect(lerParte(P1)).toEqual({ rns: [1, 3], secoes: ['Sessão'] });
    expect(lerParte(P2)).toEqual({ rns: [1500], secoes: ['Sessão', 'Outra'] });
  });
});

describe('gerarIndice', () => {
  it('gera tabela e grade completas e preserva a abertura e a frase', () => {
    const r = gerarIndice(INDICE, 'api', [{ arquivo: 'a/parte-01.md', texto: P1 }, { arquivo: 'a/parte-02.md', texto: P2 }]);
    expect(r).toContain('Abertura que fica.');
    expect(r).toContain('A grade abaixo preserva as âncoras antigas.');
    expect(r).toContain('| [parte 1](api/parte-01.md) | RN-001 | 2 | Sessão |');
    expect(r).toContain('| [parte 2](api/parte-02.md) | RN-1500 | 1 | Sessão; Outra |');
    expect(r).toContain('<a id="rn-003"></a>[003](api/parte-01.md#rn-003)');
    expect(r).toContain('<a id="rn-1500"></a>[1500](api/parte-02.md#rn-1500)');
    expect(r.match(/<a id="rn-/g)).toHaveLength(3);
  });
  it('é idempotente', () => {
    const partes = [{ arquivo: 'a/parte-01.md', texto: P1 }];
    const um = gerarIndice(INDICE, 'api', partes);
    expect(gerarIndice(um, 'api', partes)).toBe(um);
  });
  it('dez entradas por linha', () => {
    const texto = Array.from({ length: 25 }, (_, i) => `### RN-${100 + i}\n`).join('');
    const grade = gerarIndice(INDICE, 'api', [{ arquivo: 'a/parte-01.md', texto }]).split('\n').filter((l) => l.startsWith('<a id'));
    expect(grade.map((l) => l.match(/<a id/g)!.length)).toEqual([10, 10, 5]);
  });
});

describe('pesar', () => {
  const kb = (n: number) => n * 1024;
  it('95 KB avisa e passa; a parte que não é a última diz que está cheia', () => {
    const r = pesar([{ arquivo: 'p1.md', bytes: kb(95), ultima: false }, { arquivo: 'p2.md', bytes: kb(95), ultima: true }, { arquivo: 'p0.md', bytes: kb(50), ultima: true }]);
    expect(r.erros).toEqual([]);
    expect(r.avisos).toHaveLength(2);
    expect(r.avisos[0]).toContain('já está cheia');
    expect(r.avisos[1]).toContain('parte-NN+1.md');
  });
  it('99,5 KB avisa e passa; 100 KB reprova (teto calibrado: 150 KB de HTML / 1,502)', () => {
    expect(pesar([{ arquivo: 'p.md', bytes: kb(99.5), ultima: true }])).toMatchObject({ erros: [], avisos: [expect.any(String)] });
    expect(pesar([{ arquivo: 'p.md', bytes: kb(100), ultima: true }]).erros).toHaveLength(1);
    expect(TETO_KB).toBe(99.8);
  });
  it('acima do teto reprova (112 KB, o caso da api#162)', () => {
    expect(pesar([{ arquivo: 'p.md', bytes: kb(112), ultima: true }]).erros).toHaveLength(1);
    expect(pesar([{ arquivo: 'p.md', bytes: kb(TETO_KB), ultima: true }]).erros).toEqual([]);
  });
});

describe('parte vazia', () => {
  it('sai "—" na coluna Desde', () => {
    const atual = '| Parte | Desde | RNs | Seções |\n|---|---|---|---|\n| x | y | 0 | — |\n\nfrase\n';
    expect(gerarIndice(atual, 'api', [{ arquivo: 'p.md', texto: '# nada\n' }])).toContain('| — | 0 |');
  });
});

describe('descobrir', () => {
  it('acha áreas partidas e ignora i18n, fixtures e área sem índice', () => {
    const r = descobrir([
      'docs/business-rules/api.md',
      'docs/business-rules/api/parte-02.md',
      'docs/business-rules/api/parte-01.md',
      'docs/i18n/en/business-rules/api.md',
      'docs/i18n/en/business-rules/api/parte-01.md',
      'docs/business-rules/solta/parte-01.md',
      'scripts/__fixtures__/x/docs/business-rules/web.md',
    ]);
    expect(r.areas).toHaveLength(1);
    expect(r.areas[0]!.partes.map((p) => p.n)).toEqual([1, 2]);
    expect(r.paginas).toContain('docs/business-rules/solta/parte-01.md');
    expect(r.paginas.some((f) => f.includes('i18n') || f.includes('fixtures'))).toBe(false);
  });
});

describe('principal num git de verdade', () => {
  let tmp: string;
  const escreve = (arq: string, txt: string) => {
    mkdirSync(path.dirname(path.join(tmp, arq)), { recursive: true });
    writeFileSync(path.join(tmp, arq), txt);
  };
  const git = (...a: string[]) => execFileSync('git', ['-C', tmp, ...a]);
  let log: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    tmp = mkdtempSync(path.join(tmpdir(), 'indice-de-rn-spec-'));
    git('init', '-q');
    escreve('docs/business-rules/api/parte-01.md', P1);
    escreve('docs/business-rules/api.md', gerarIndice(INDICE, 'api', [{ arquivo: 'x', texto: P1 }]));
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    log.mockRestore();
    rmSync(tmp, { recursive: true, force: true });
  });
  const saida = () => log.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');

  it('índice completo passa', () => {
    git('add', '-A');
    expect(principal(tmp, false)).toBe(0);
  });
  it('RN nova na última parte sem regenerar o índice reprova (grade só da divisão); --escrever conserta e o código segue o veredito de antes', () => {
    escreve('docs/business-rules/api/parte-01.md', `${P1}### RN-004 — nova\n`);
    git('add', '-A');
    expect(principal(tmp, false)).toBe(1);
    expect(saida()).toContain('1 RN(s) fora da grade');
    expect(principal(tmp, true)).toBe(1);
    expect(readFileSync(path.join(tmp, 'docs/business-rules/api.md'), 'utf8')).toContain('rn-004');
    expect(principal(tmp, false)).toBe(0);
  });
  it('página de 112 KB reprova; de 95 KB só avisa', () => {
    escreve('docs/business-rules/api/parte-01.md', `${P1}${'x'.repeat(95 * 1024)}\n`);
    git('add', '-A');
    expect(principal(tmp, false)).toBe(0);
    expect(saida()).toContain('::warning');
    escreve('docs/business-rules/api/parte-01.md', `${P1}${'x'.repeat(112 * 1024)}\n`);
    expect(principal(tmp, false)).toBe(1);
    expect(saida()).toContain('::error');
  });
});
