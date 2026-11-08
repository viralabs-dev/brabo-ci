import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * `subir-contracts.sh` num bash de VERDADE, com um `pnpm` falso que "regenera"
 * o lock copiando `LOCK_NOVO`. O que se prova (RN-1038): o lock só muda nas
 * entradas `@viralabs-dev/brabo-*` (fora delas, enxerta); se o enxerto não passa, recusa e restaura.
 */
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = path.join(RAIZ, 'scripts/ci/subir-contracts.sh');

let repo: string;

const LOCK = (v: string, zod = '4.0.0') => `lockfileVersion: '9.0'

importers:

  .:
    dependencies:
      '@brabo/shared':
        specifier: npm:@viralabs-dev/brabo-shared@${v}
        version: '@viralabs-dev/brabo-shared@${v}'
      zod:
        specifier: ^4.0.0
        version: ${zod}

packages:

  '@viralabs-dev/brabo-shared@${v}':
    resolution: {integrity: sha512-${v}}

  zod@${zod}:
    resolution: {integrity: sha512-zod${zod}}

snapshots:

  '@viralabs-dev/brabo-shared@${v}': {}

  zod@${zod}: {}
`;

const PKG = (v: string) =>
  JSON.stringify({ dependencies: { '@brabo/shared': `npm:@viralabs-dev/brabo-shared@${v}`, zod: '^4.0.0' } }, null, 2) + '\n';

function rodar(versao: string, lockNovo: string, env: Record<string, string> = {}) {
  writeFileSync(path.join(repo, 'lock.novo'), lockNovo);
  return spawnSync('bash', [SCRIPT, versao], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, PNPM: path.join(repo, 'pnpm-falso'), ...env },
  });
}
const ler = (f: string) => readFileSync(path.join(repo, f), 'utf8');

beforeEach(() => {
  repo = mkdtempSync(path.join(tmpdir(), 'subir-'));
  writeFileSync(path.join(repo, 'package.json'), PKG('1.2.0'));
  writeFileSync(path.join(repo, 'pnpm-lock.yaml'), LOCK('1.2.0'));
  mkdirSync(path.join(repo, 'scripts'));
  writeFileSync(path.join(repo, 'scripts/baixar-areas.mjs'), "const TAG = 'v1.2.0';\n");
  writeFileSync(path.join(repo, 'scripts/baixar-contratos.sh'), 'tag="${1:-v1.2.0}"\n');
  // `--frozen-lockfile` só valida (FROZEN_FALHA=1 simula lock inconsistente); o resto "regenera".
  writeFileSync(
    path.join(repo, 'pnpm-falso'),
    '#!/usr/bin/env bash\nif [[ "$*" == *--frozen-lockfile* ]]; then exit "${FROZEN_FALHA:-0}"; fi\ncp "$(dirname "$0")/lock.novo" pnpm-lock.yaml\n',
  );
  chmodSync(path.join(repo, 'pnpm-falso'), 0o755);
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe('subir-contracts.sh (RN-1038)', () => {
  it('aceita o lock que muda só as entradas do contracts e troca alias e constantes', () => {
    const r = rodar('v1.3.0-dev.1', LOCK('1.3.0-dev.1'));
    expect(r.status).toBe(0);
    expect(ler('package.json')).toContain('brabo-shared@1.3.0-dev.1');
    expect(ler('pnpm-lock.yaml')).toBe(LOCK('1.3.0-dev.1'));
    expect(ler('scripts/baixar-areas.mjs')).toContain("'v1.3.0-dev.1'");
    expect(ler('scripts/baixar-contratos.sh')).toContain('${1:-v1.3.0-dev.1}');
  });

  it('lock semeado: o pnpm mexeu em outra entrada, mas só as do contracts são trocadas', () => {
    const r = rodar('1.3.0', LOCK('1.3.0', '4.1.0'));
    expect(r.status).toBe(0);
    expect(ler('pnpm-lock.yaml')).toBe(LOCK('1.3.0', '4.0.0'));
  });

  it('recusa e restaura tudo (inclusive o workspace) se o enxerto não passa no frozen', () => {
    const r = rodar('1.3.0', LOCK('1.3.0', '4.1.0'), { FROZEN_FALHA: '1' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('RECUSADO');
    expect(ler('pnpm-lock.yaml')).toBe(LOCK('1.2.0'));
    expect(ler('package.json')).toBe(PKG('1.2.0'));
    expect(ler('scripts/baixar-areas.mjs')).toContain("'v1.2.0'");
    expect(existsSync(path.join(repo, 'pnpm-workspace.yaml'))).toBe(false);
  });

  it('aplica o minimumReleaseAgeExclude (cria ou completa o workspace, sem duplicar)', () => {
    rodar('1.3.0', LOCK('1.3.0'));
    expect(ler('pnpm-workspace.yaml')).toBe("minimumReleaseAgeExclude:\n  - '@viralabs-dev/*'\n");
    writeFileSync(path.join(repo, 'pnpm-workspace.yaml'), "packages: []\nminimumReleaseAgeExclude:\n  - 'x'\n");
    rodar('1.3.0', LOCK('1.3.0'));
    rodar('1.3.0', LOCK('1.3.0'));
    expect(ler('pnpm-workspace.yaml')).toBe("packages: []\nminimumReleaseAgeExclude:\n  - '@viralabs-dev/*'\n  - 'x'\n");
  });

  it('recusa versão mal formada sem tocar em nada', () => {
    const r = rodar('latest', LOCK('1.3.0'));
    expect(r.status).toBe(2);
    expect(ler('package.json')).toBe(PKG('1.2.0'));
  });
});
