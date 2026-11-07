import { describe, expect, it } from 'vitest';
import {
  avisoDeComponentes,
  daConstante,
  divergencias,
  doLock,
  doPackageJson,
} from './contracts-alinhado.ts';

const pkg = (v: string) =>
  JSON.stringify({
    dependencies: { '@brabo/shared': `npm:@viralabs-dev/brabo-shared@${v}`, zod: '^4.0.0' },
    devDependencies: { '@brabo/docker-port': `npm:@viralabs-dev/brabo-docker-port@${v}` },
  });
const lock = (v: string) =>
  `'@viralabs-dev/brabo-shared@${v}':\n  resolution: {integrity: sha512-x}\n'@viralabs-dev/brabo-docker-port@${v}(typescript@5):\n`;

describe('contracts-alinhado (RN-1038)', () => {
  it('lê os dois aliases do package.json e ignora o resto', () => {
    expect(doPackageJson(pkg('1.3.0')).map((f) => f.versao)).toEqual(['1.3.0', '1.3.0']);
  });
  it('lê a versão no lock, sem o sufixo de peer', () => {
    expect(doLock(lock('1.3.0-dev.2')).map((f) => f.versao)).toEqual(['1.3.0-dev.2', '1.3.0-dev.2']);
  });
  it('lê a constante de cada script, sem o v', () => {
    expect(daConstante('scripts/baixar-contratos.sh', 'tag="${1:-v1.3.0}"')[0]!.versao).toBe('1.3.0');
    expect(daConstante('scripts/baixar-areas.mjs', "const TAG = 'v1.3.0';")[0]!.versao).toBe('1.3.0');
    expect(
      daConstante('.github/actions/irmaos/action.yml', 'with: { repository: viralabs-dev/brabo-contracts, ref: v1.3.0, path: x }')[0]!.versao,
    ).toBe('1.3.0');
  });
  it('alinhado: sem divergência', () => {
    expect(divergencias([...doPackageJson(pkg('1.3.0')), ...doLock(lock('1.3.0'))])).toEqual([]);
  });
  it('lock atrás do package.json: diverge', () => {
    expect(divergencias([...doPackageJson(pkg('1.3.1')), ...doLock(lock('1.3.0'))])).toHaveLength(1);
  });
  it('constante atrás do alias: diverge', () => {
    const f = [...doPackageJson(pkg('1.3.0')), ...daConstante('scripts/baixar-areas.mjs', "const TAG = 'v1.2.0';")];
    expect(divergencias(f)[0]).toContain('scripts/baixar-areas.mjs=1.2.0');
  });
  it('componentes.json diferente só avisa; igual ou ausente fica quieto', () => {
    const c = (tag: string) => JSON.stringify({ contracts: { tag } });
    expect(avisoDeComponentes('1.3.0', c('v1.4.0'))).toContain('1.4.0');
    expect(avisoDeComponentes('1.3.0', c('v1.3.0'))).toBeNull();
    expect(avisoDeComponentes('1.3.0', '{}')).toBeNull();
  });
});
