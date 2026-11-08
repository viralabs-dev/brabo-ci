import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BASE_DA_DOC, LINKS_DA_POLITICA } from './doc-da-politica.ts';

const RAIZ = join(import.meta.dirname, '..', '..');
const DOCS = join(RAIZ, 'scripts', 'ci', 'docs');

/** Caminho do .md no repo e âncora de uma URL `/prd/<pagina>.html#<ancora>`. */
function destino(url: string): { arquivo: string; ancora: string } {
  const m = url.match(/^(.+)\/prd\/(.+)\.html#(.+)$/);
  if (!m || m[1] !== BASE_DA_DOC.replace(/\/prd$/, '')) throw new Error(`URL fora do padrão: ${url}`);
  return { arquivo: join(DOCS, `${m[2]}.md`), ancora: m[3]! };
}

describe('links que as mensagens de bloqueio imprimem', () => {
  for (const [nome, url] of Object.entries(LINKS_DA_POLITICA)) {
    it(`${nome} abre uma página e uma âncora que existem`, () => {
      const { arquivo, ancora } = destino(url);
      expect(existsSync(arquivo), arquivo).toBe(true);
      expect(readFileSync(arquivo, 'utf8')).toContain(`{#${ancora}}`);
    });
  }
});

describe('mensagens não citam caminho relativo da doc', () => {
  // String impressa = linha que não é comentário e cita `docs/explanation|reference/...`.
  const RELATIVO = /docs\/(explanation|reference)\//;
  const ehComentario = (l: string) => /^\s*(\*|\/\/|\/\*|#)/.test(l);
  const arquivos = [
    ...readdirSync(join(RAIZ, 'scripts', 'ci'))
      .filter((f) => /\.(ts|sh)$/.test(f) && !f.endsWith('.spec.ts'))
      .map((f) => join(RAIZ, 'scripts', 'ci', f)),
    ...readdirSync(join(RAIZ, '.github', 'workflows')).map((f) => join(RAIZ, '.github', 'workflows', f)),
  ];

  it.each(arquivos)('%s', (arquivo) => {
    const ruins = readFileSync(arquivo, 'utf8')
      .split('\n')
      .filter((l) => RELATIVO.test(l) && !ehComentario(l));
    expect(ruins).toEqual([]);
  });
});
