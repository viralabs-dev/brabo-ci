import { describe, expect, it } from 'vitest';
import { ehPaginaDeRn, linksRelativos, quebrados } from './links-das-rns.ts';

const DOC = 'docs/business-rules/api/parte-01.md';
const arquivos = new Set(['docs/adr/0001.md', 'docs/business-rules/api.md']);

describe('links-das-rns', () => {
  it('um link quebrado reprova', () => {
    expect(quebrados(DOC, 'veja [x](../../../brabo/docs/adr/0287.md#a)', arquivos)).toEqual([
      { linha: 1, href: '../../../brabo/docs/adr/0287.md#a' },
    ]);
  });
  it('um link para arquivo do próprio repo passa', () => {
    expect(quebrados(DOC, '[adr](../../adr/0001.md) e [pai](../api.md#rn-1)', arquivos)).toEqual([]);
  });
  it('URL do GitHub e âncora pura passam', () => {
    const md = '[a](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/1.md) [b](#x) [c](mailto:a@b.md)';
    expect(quebrados(DOC, md, arquivos)).toEqual([]);
  });
  it('link dentro de bloco de código ou código inline é ignorado', () => {
    const md = '```md\n[x](../nada.md)\n```\ntexto `[y](../nada.md)` fim\n~~~\n[z](../nada.md)\n~~~\n[real](../nada.md)';
    expect(linksRelativos(md)).toEqual([{ linha: 8, href: '../nada.md' }]);
  });
  it('só páginas de RN (inclui traduções)', () => {
    expect(ehPaginaDeRn('docs/business-rules/api.md')).toBe(true);
    expect(ehPaginaDeRn('docs/i18n/en/business-rules/api.md')).toBe(true);
    expect(ehPaginaDeRn('docs/adr/0001.md')).toBe(false);
  });
});
