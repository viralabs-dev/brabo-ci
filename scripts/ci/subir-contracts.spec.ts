import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * `subir-contracts.sh` num bash de VERDADE, com um `pnpm` falso que "regenera"
 * o lock copiando `LOCK_NOVO`. O que se prova (RN-1038): o lock só pode mudar
 * nas entradas `@viralabs-dev/brabo-*`; fora delas o script recusa e restaura.
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

function rodar(versao: string, lockNovo: string) {
  writeFileSync(path.join(repo, 'lock.novo'), lockNovo);
  return spawnSync('bash', [SCRIPT, versao], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, PNPM: path.join(repo, 'pnpm-falso') },
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
  writeFileSync(path.join(repo, 'pnpm-falso'), '#!/usr/bin/env bash\ncp "$(dirname "$0")/lock.novo" pnpm-lock.yaml\n');
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

  it('recusa e restaura tudo se o lock mexeu em outra entrada', () => {
    const r = rodar('1.3.0', LOCK('1.3.0', '4.1.0'));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('RECUSADO');
    expect(ler('pnpm-lock.yaml')).toBe(LOCK('1.2.0'));
    expect(ler('package.json')).toBe(PKG('1.2.0'));
    expect(ler('scripts/baixar-areas.mjs')).toContain("'v1.2.0'");
  });

  it('recusa versão mal formada sem tocar em nada', () => {
    const r = rodar('latest', LOCK('1.3.0'));
    expect(r.status).toBe(2);
    expect(ler('package.json')).toBe(PKG('1.2.0'));
  });
});
