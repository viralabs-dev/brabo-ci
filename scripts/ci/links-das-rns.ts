/**
 * links-das-rns — num irmão, todo link relativo `.md` das páginas de RN
 * (docs/**\/business-rules*) tem de resolver num arquivo do PRÓPRIO checkout
 * (AT-868). Link para outro repo vira URL do GitHub do dono; relativo que sai do
 * repo dá 404 no GitHub. Ignora URL com esquema, âncora pura e código (bloco e
 * inline). Sintaxe apagável apenas (o Node executa este `.ts` por type stripping).
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ehPaginaDeRn = (f: string) => /^docs\/.*business-rules.*\.md$/.test(f);

export interface Quebrado {
  linha: number;
  href: string;
}

/** Hrefs relativos `.md` de um texto, sem código (bloco cercado e inline), com a linha. */
export function linksRelativos(md: string): Quebrado[] {
  const achados: Quebrado[] = [];
  let cerca: string | null = null;
  md.split('\n').forEach((l, i) => {
    const m = /^\s*(`{3,}|~{3,})/.exec(l);
    if (cerca) {
      if (m && m[1]!.startsWith(cerca[0]!) && m[1]!.length >= cerca.length) cerca = null;
      return;
    }
    if (m) {
      cerca = m[1]!;
      return;
    }
    for (const x of l.replace(/`+[^`]*`+/g, '').matchAll(/\]\(\s*<?([^)\s>]+)/g)) {
      const href = x[1]!;
      const alvo = href.replace(/[#?].*$/, '');
      if (!alvo.endsWith('.md') || /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(alvo)) continue;
      achados.push({ linha: i + 1, href });
    }
  });
  return achados;
}

/** Os links relativos de `doc` cujo alvo não está entre os arquivos versionados. */
export function quebrados(doc: string, md: string, versionados: Set<string>): Quebrado[] {
  return linksRelativos(md).filter(({ href }) => {
    const alvo = href.replace(/[#?].*$/, '');
    const abs = alvo.startsWith('/') ? alvo.slice(1) : posix.normalize(posix.join(posix.dirname(doc), alvo));
    return !versionados.has(abs);
  });
}

export function principal(cwd: string): number {
  const lista = execFileSync('git', ['-C', cwd, 'ls-files'], { encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n').filter(Boolean);
  const versionados = new Set(lista);
  let n = 0;
  for (const doc of lista.filter(ehPaginaDeRn)) {
    for (const q of quebrados(doc, readFileSync(join(cwd, doc), 'utf8'), versionados)) {
      n++;
      console.log(`::error file=${doc},line=${q.linha},title=links-das-rns::link relativo \`${q.href}\` não existe neste repo (daria 404 no GitHub). Use a URL https://github.com/viralabs-dev/<repo>/blob/dev/<caminho>: rode \`node scripts/docs/links-para-repo-dono.mjs --repo <x> --escrever\` a partir do brabo.`);
    }
  }
  console.log(n === 0 ? 'links-das-rns: 0 links relativos quebrados.' : `links-das-rns: ${n} link(s) relativo(s) quebrado(s).`);
  return n === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(principal(process.cwd()));
}
