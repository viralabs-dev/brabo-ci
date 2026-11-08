/**
 * URL publicada da doc da política, a que as mensagens de bloqueio imprimem.
 * O arquivo-fonte mora em `scripts/ci/docs/<pagina>.md` deste repo e o site
 * do `brabo` o publica em `/prd/<pagina>.html`. Caminho relativo (`docs/...`)
 * não abre em lugar nenhum para quem foi bloqueado: sempre use esta URL.
 */
export const BASE_DA_DOC = 'https://viralabs-dev.github.io/brabo/prd';

/** `pagina` sem extensão, ex.: `explanation/branching-policy`. */
export function urlDaDoc(pagina: string, ancora: string): string {
  return `${BASE_DA_DOC}/${pagina}.html#${ancora}`;
}

/** Seção do catálogo de códigos: a âncora é o código em minúsculas. */
export function urlDoCodigo(codigo: string): string {
  return urlDaDoc('reference/codigos-de-violacao', codigo.toLowerCase());
}

const POLITICA = 'explanation/branching-policy';

/** Âncoras do `branching-policy.md` que as mensagens usam. */
export const LINKS_DA_POLITICA = {
  taxonomia: urlDaDoc(POLITICA, 'taxonomy'),
  escada: urlDaDoc(POLITICA, 'who-approves'),
  gate: urlDaDoc(POLITICA, 'the-back-merge-gate'),
  checkDePromocao: urlDaDoc(POLITICA, 'the-promotion-check'),
  correcaoNascidaNoAlto: urlDaDoc(POLITICA, 'a-fix-born-high-goes-back-down'),
  promocao: urlDaDoc(POLITICA, 'promotion'),
  papeis: urlDaDoc(POLITICA, 'roles'),
  cadeiaDeSuprimentos: urlDaDoc(
    'explanation/cadeia-de-suprimentos-do-ci',
    'actions-commit-sha-with-the-version-alongside',
  ),
} as const;
