/**
 * publish-npm — da tag do chamador tira a versão do pacote e o dist-tag do
 * npm (AT-770, RN-1037). A tag `vX.Y.Z-dev.N` (dev) publica com `dev`; a final
 * `vX.Y.Z` (main) publica com `latest`. Qualquer outra forma reprova: um
 * pré-release avulso não pode tomar o `latest` por engano.
 *
 * Sintaxe apagável apenas (o Node executa este `.ts` por type stripping).
 */

import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DEV = /^\d+\.\d+\.\d+-dev\.\d+$/;
const FINAL = /^\d+\.\d+\.\d+$/;

/** `v1.3.0-dev.2` vira `1.3.0-dev.2`; forma inválida lança. */
export function versaoDaTag(tag: string): string {
  const versao = tag.replace(/^v/, '');
  if (!DEV.test(versao) && !FINAL.test(versao)) {
    throw new Error(`tag '${tag}' não é vX.Y.Z nem vX.Y.Z-dev.N`);
  }
  return versao;
}

export function distTag(versao: string): 'dev' | 'latest' {
  return DEV.test(versao) ? 'dev' : 'latest';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const versao = versaoDaTag(process.argv[2] ?? '');
    const saida = `versao=${versao}\ndist_tag=${distTag(versao)}\n`;
    console.log(saida);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, saida);
  } catch (e) {
    console.log(`::error title=publish-npm::${(e as Error).message}`);
    process.exit(1);
  }
}
