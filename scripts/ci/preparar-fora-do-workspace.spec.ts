import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { expect, it } from 'vitest';

/**
 * AT-841: o chamador (runner, web) tem `pnpm-workspace.yaml` na raiz. Sem
 * `--ignore-workspace` o `pnpm install` do `preparar` instala lá, não em
 * `.brabo-ci/node_modules` (`Cannot find package 'yaml'`), e ainda lê as
 * dependências privadas do chamador (401 no GitHub Packages).
 */
it('o install do preparar ignora o workspace do chamador', () => {
  const action = parse(readFileSync(fileURLToPath(new URL('../../.github/actions/preparar/action.yml', import.meta.url)), 'utf8'));
  const installs = (action.runs.steps as { run?: string }[]).filter((p) => p.run?.includes('pnpm install'));
  expect(installs.length).toBeGreaterThan(0);
  for (const p of installs) expect(p.run).toContain('--ignore-workspace');
});
