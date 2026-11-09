import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MARCA_FIM, MARCA_INICIO } from './mapa-dos-repos.ts';
import { MARCA_VITRINE, TITULOS, conferir } from './readme-esqueleto.ts';

const mapa = `${MARCA_INICIO}\nx\n${MARCA_FIM}`;
const bom = (titulos = TITULOS) =>
  `# r\n\nfrase\n\n${titulos.map((t) => `## ${t}\n\n${t === 'Onde se encaixa' ? mapa : 'texto'}\n`).join('\n')}`;

describe('readme-esqueleto (AT-826)', () => {
  it('o README.modelo.md e o README do brabo-ci passam', () => {
    expect(conferir(readFileSync('README.modelo.md', 'utf8'))).toEqual([]);
    expect(conferir(readFileSync('README.md', 'utf8'))).toEqual([]);
  });
  it('aceita o esqueleto completo', () => expect(conferir(bom())).toEqual([]));
  it('reprova seção faltando', () => {
    expect(conferir(bom(TITULOS.filter((t) => t !== 'Como é usado')))).toEqual(['falta a seção "## Como é usado"']);
  });
  it('reprova seção fora de ordem', () => {
    const t = [...TITULOS];
    [t[2], t[3]] = [t[3]!, t[2]!];
    expect(conferir(bom(t))[0]).toContain('fora da ordem');
  });
  it('reprova id de AT, ADR e RN no título, mas não no corpo', () => {
    for (const id of ['AT-826', 'ADR 0281', 'RN-1075']) {
      expect(conferir(bom().replace('## Documentação', `## Documentação (${id})`)).some((e) => e.includes('cita AT, ADR ou RN'))).toBe(true);
    }
    expect(conferir(bom().replace('texto', 'veja AT-826 e ADR 0281'))).toEqual([]);
  });
  it('ignora título dentro de cerca de código', () => {
    expect(conferir(bom().replace('texto', '```\n## Extra AT-1\n```'))).toEqual([]);
  });
  it('reprova sem o bloco do mapa ou com o bloco fora da seção', () => {
    expect(conferir(bom().replace(mapa, ''))[0]).toContain('falta o bloco do mapa');
    expect(conferir(bom().replace(mapa, 'x').replace('Como é usado\n\ntexto', `Como é usado\n\n${mapa}`))[0]).toContain('dentro de');
  });
  it('só aceita seção antes da 1 se houver o marcador da vitrine', () => {
    const vitrine = '# r\n\n## Vitrine\n\nlogo\n';
    const sem = bom().replace('# r\n', vitrine);
    expect(conferir(sem)[0]).toContain('há seção antes');
    expect(conferir(sem.replace('## Para que existe', `${MARCA_VITRINE}\n\n## Para que existe`))).toEqual([]);
  });
});
