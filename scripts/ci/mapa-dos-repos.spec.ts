import { describe, expect, it } from 'vitest';
import { MARCA_FIM, MARCA_INICIO, gerarBloco, lerMapa, trocarBloco } from './mapa-dos-repos.ts';

const base = (extra = '') => `repos:
  a: { papel: x, proposito: "Faz A | com pipe", como_e_usado: por tag, depende_de: [{ repo: b, tipo: contrato, prova: "p.json:3" }, { repo: b, tipo: codigo, prova: "q.yml:9" }] }
  b: { papel: x, proposito: Faz B, como_e_usado: por clone, depende_de: [] }${extra}`;

describe('mapa-dos-repos (AT-825)', () => {
  it('gera tabela e Mermaid com a aresta rotulada e o repo atual destacado', () => {
    const b = gerarBloco(lerMapa(base()), 'a');
    expect(b.startsWith(MARCA_INICIO) && b.endsWith(MARCA_FIM)).toBe(true);
    expect(b).toContain('| **a** | Faz A \\| com pipe | por tag | b (contrato, código) | — |');
    expect(b).toContain('| [b](https://github.com/viralabs-dev/b) | Faz B | por clone | — | a (contrato, código) |');
    expect(b).toContain('a -->|contrato| b');
    expect(b).toContain('class a atual');
  });
  it('linka cada repo, menos o atual, para o DONO', () => {
    const b = gerarBloco(lerMapa(base()), 'b');
    expect(b).toContain('| [a](https://github.com/viralabs-dev/a) |');
    expect(b).toContain('| **b** |');
    expect(b).not.toContain('[b](');
  });
  it('o diagrama traz só as arestas do repo atual', () => {
    const m = lerMapa(base('\n  c: { papel: x, proposito: C, como_e_usado: y, depende_de: [{ repo: b, tipo: doc, prova: "r:1" }] }'));
    const b = gerarBloco(m, 'a');
    expect(b).toContain('a -->|contrato| b');
    expect(b).not.toContain('c -->|doc| b');
    expect(b).not.toContain('  c["c"]');
  });
  it('é determinístico e muda com o repo atual', () => {
    const m = lerMapa(base());
    expect(gerarBloco(m, 'a')).toBe(gerarBloco(m, 'a'));
    expect(gerarBloco(m, 'b')).not.toBe(gerarBloco(m, 'a'));
  });
  it('rejeita aresta para repo desconhecido, tipo inválido e prova sem linha', () => {
    expect(() => lerMapa(base().replace('repo: b,', 'repo: z,'))).toThrow(/desconhecido/);
    expect(() => lerMapa(base().replace('contrato', 'magia'))).toThrow(/inválido/);
    expect(() => lerMapa(base().replace('p.json:3', 'p.json'))).toThrow(/arquivo:linha/);
    expect(() => lerMapa(base().replace('"p.json:3"', '{ arquivo: p.json }'))).toThrow(/trecho/);
    expect(() => lerMapa(base().replace('"p.json:3"', '{ arquivo: p.json, trecho: "a\\nb" }'))).toThrow(/trecho/);
    expect(lerMapa(base().replace('"p.json:3"', '{ arquivo: p.json, trecho: "a b" }')).a!.depende_de[0]!.prova).toEqual({ arquivo: 'p.json', trecho: 'a b' });
    expect(() => gerarBloco(lerMapa(base()), 'z')).toThrow(/não está/);
  });
  it('troca só o bloco; sem marcadores devolve null', () => {
    const r = `# T\n${MARCA_INICIO}\nvelho\n${MARCA_FIM}\nresto\n`;
    expect(trocarBloco(r, 'NOVO')).toBe('# T\nNOVO\nresto\n');
    expect(trocarBloco('# T\n', 'NOVO')).toBeNull();
  });
});
