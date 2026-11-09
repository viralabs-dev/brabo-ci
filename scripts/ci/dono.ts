/**
 * O dono (org ou usuário) de quem chama o kit: o runner exporta `GITHUB_REPOSITORY_OWNER`.
 * Fora do Actions (ou valor fora do formato de login do GitHub) vale o padrão do Brabo (AT-831).
 * O formato `[A-Za-z0-9-]` dispensa escapar o valor em RegExp.
 */
const LOGIN = /^[A-Za-z0-9-]{1,39}$/;
const PADRAO = 'viralabs-dev';

export function donoDe(env: NodeJS.ProcessEnv = process.env): string {
  const v = env.GITHUB_REPOSITORY_OWNER?.trim() ?? '';
  return LOGIN.test(v) ? v : PADRAO;
}

export const DONO = donoDe();
