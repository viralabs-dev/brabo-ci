/**
 * Quando o gatilho precisa achar as tags que apontam para o head da PR (AT-765/AT-789):
 * só no repo da própria PR e só no portão da `main`. Na base `dev` (AT-769) a imagem do
 * head é a `sha-<12>`, publicada pelo próprio CI da PR, e as tags não importam.
 */
export function buscaTagsDoHead(e: { repo: string; repoDaPr: string; baseDev: boolean }): boolean {
  return e.repo === e.repoDaPr && !e.baseDev;
}
