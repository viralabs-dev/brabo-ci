import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { avaliarPr, formatarVeredito } from './pr-police.ts';
import { BASE_DA_DOC, LINKS_DA_POLITICA, urlDoCodigo } from './doc-da-politica.ts';

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
  const RELATIVO = /(?<![\w./-])docs\/(explanation|reference)\//;
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

describe('todo código que a pessoa bloqueada vê tem a seção que o link abre', () => {
  const pagina = readFileSync(join(DOCS, 'reference', 'codigos-de-violacao.md'), 'utf8');
  const uniao = (arquivo: string, tipo: string): string[] => {
    const fonte = readFileSync(join(RAIZ, 'scripts', 'ci', arquivo), 'utf8');
    const bloco = fonte.match(new RegExp(`export type ${tipo}\\s*=([^;]+);`))?.[1] ?? '';
    return [...bloco.matchAll(/'([A-Z-]+)'/g)].map((m) => m[1]!);
  };
  const codigos = [...uniao('pr-police.ts', 'CodigoDeViolacao'), ...uniao('gate.ts', 'MotivoDoGate')];

  it('lê os 8 códigos do pr-police e os 5 motivos do gate', () => {
    expect(codigos).toHaveLength(13);
  });

  it.each(codigos)('%s', (codigo) => {
    const ancora = urlDoCodigo(codigo).split('#')[1]!;
    expect(pagina).toContain(`### ${codigo} {#${ancora}}`);
  });
});

describe('as páginas de ensino citam o que existe', () => {
  it('a política em 10 minutos cabe em 2 000 palavras', () => {
    const t = readFileSync(join(DOCS, 'explanation', 'politica-em-10-minutos.md'), 'utf8');
    expect(t.split(/\s+/).length).toBeLessThanOrEqual(2000);
  });

  it('as páginas novas existem e o glossário não usa o slug do brabo', () => {
    for (const p of ['explanation/politica-em-10-minutos', 'explanation/licoes-do-ci', 'reference/glossario-da-politica']) {
      expect(existsSync(join(DOCS, `${p}.md`)), p).toBe(true);
    }
    expect(existsSync(join(DOCS, 'reference', 'glossary.md'))).toBe(false);
  });
});

describe('o pr-police linka a seção do código de cada violação', () => {
  it('imprime ver: <URL>#<codigo>', () => {
    const entrada = { head: 'login', base: 'dev' };
    const texto = formatarVeredito(entrada, avaliarPr(entrada));
    expect(texto).toContain('ver:      https://viralabs-dev.github.io/brabo/prd/reference/codigos-de-violacao.html#nome-fora-do-formato');
  });
});
