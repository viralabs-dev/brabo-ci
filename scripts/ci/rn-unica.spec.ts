import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acrescentadas, colisoes, definicoesDe, mensagens, proximoLivre } from './rn-unica.ts';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'rn-unica.ts');
const d = (numero: number, arquivo = 'a.md', linha = 1) => ({ numero, arquivo, linha });

describe('definicoesDe: cabeçalho define, citação não', () => {
  const saida = [
    'HEAD:docs/p.md:3:### RN-1507 — Regra nova {#rn-1507}',
    'HEAD:docs/p.md:9:Veja a RN-1508 e o `### RN-1509` no texto',
    'HEAD:docs/p.md:12:#### RN-1510',
    'HEAD:docs/p.md:20:# RN-1511 título nível 1',
    'HEAD:docs/p.md:30:### RN-1512x',
  ].join('\n');
  it('aceita ## a ####; ignora citação, nível 1 e sufixo colado', () => {
    expect(definicoesDe(saida, 'HEAD').map((x) => x.numero)).toEqual([1507, 1510]);
  });
  it('guarda arquivo e linha, mesmo com ":" no nome da ref', () => {
    expect(definicoesDe('origin/dev:a/b.md:7:### RN-5 — x', 'origin/dev')).toEqual([d(5, 'a/b.md', 7)]);
  });
});

describe('o que a PR acrescenta e as colisões', () => {
  it('só o número que a base não tinha conta (duplicata herdada passa)', () => {
    expect(acrescentadas([d(1), d(2)], [d(1), d(2), d(3)]).map((x) => x.numero)).toEqual([3]);
  });
  it('colide com o vizinho e a mensagem traz repo, arquivo e o próximo livre distinto', () => {
    const cs = colisoes([d(1507, 'e.md', 5), d(1508, 'e.md', 9)], { 'brabo-api': [d(1507, 'docs/api.md', 40), d(1600)] });
    expect(cs).toHaveLength(1);
    const livre = proximoLivre([[d(1507), d(1508)], [d(1507), d(1600)]]);
    expect(livre).toBe(1601);
    expect(mensagens(cs, livre)[0]).toMatch(/RN-1507 .*e\.md:5.*brabo-api: docs\/api\.md:40.*RN-1601/);
  });
  it('sem colisão, sem mensagem', () => {
    expect(colisoes([d(2000)], { 'brabo-api': [d(1)] })).toEqual([]);
  });
});

describe('rn-unica.ts num git de verdade', () => {
  let tmp: string;
  const git = (cwd: string, ...a: string[]) => execFileSync('git', ['-C', cwd, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8' });
  const escreve = (repo: string, arq: string, txt: string) => {
    mkdirSync(path.dirname(path.join(tmp, repo, arq)), { recursive: true });
    writeFileSync(path.join(tmp, repo, arq), txt);
  };
  const commit = (repo: string, msg: string) => {
    git(path.join(tmp, repo), 'add', '-A');
    git(path.join(tmp, repo), 'commit', '-qm', msg);
  };
  const rodar = () =>
    spawnSync('node', [SCRIPT, '--repo', 'brabo-engine', '--base', 'base', '--vizinhos', tmp, '--vizinhos-ref', 'HEAD'], {
      cwd: path.join(tmp, 'brabo-engine'),
      encoding: 'utf8',
    });

  beforeEach(() => {
    tmp = mkdtempSync(path.join(tmpdir(), 'rn-unica-spec-'));
    for (const r of ['brabo-engine', 'brabo-api', 'brabo']) {
      mkdirSync(path.join(tmp, r));
      git(path.join(tmp, r), 'init', '-q');
    }
    escreve('brabo-engine', 'docs/business-rules/engine/parte-01.md', '### RN-10 — velha {#rn-10}\n');
    commit('brabo-engine', 'base');
    git(path.join(tmp, 'brabo-engine'), 'branch', 'base');
    escreve('brabo-api', 'docs/business-rules/api/parte-01.md', '### RN-1507 — da api {#rn-1507}\n### RN-1600 — outra\n');
    // espelho das RNs do engine no agregador, e uma tradução: nenhum dos dois é "outro repo"
    escreve('brabo', 'docs/business-rules/engine/parte-01.md', '### RN-1700 — espelho\n');
    escreve('brabo', 'docs/i18n/en/business-rules/produto.md', '### RN-1701 — traduzida\n');
    commit('brabo-api', 'api');
    commit('brabo', 'brabo');
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('reprova a RN nova que a api já define, com repo, arquivo e próximo livre', () => {
    escreve('brabo-engine', 'docs/business-rules/engine/parte-02.md', '### RN-1507 — do engine\n');
    commit('brabo-engine', 'rn');
    const r = rodar();
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('RN-1507');
    expect(r.stdout).toContain('brabo-api: docs/business-rules/api/parte-01.md:1');
    expect(r.stdout).toContain('Renumere esta para RN-1601');
  });

  it('passa quando o número é livre, quando só cita, e ignora o espelho e a tradução do brabo', () => {
    escreve('brabo-engine', 'docs/business-rules/engine/parte-02.md', '### RN-1800 — nova\nVeja a RN-1507 da api.\n### RN-1700 — espelho no brabo não conta\n### RN-1701 — tradução não conta\n');
    commit('brabo-engine', 'rn');
    const r = rodar();
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
  });

  it('duplicata herdada (já na base) não reprova; sem RN nova, nem lê os vizinhos', () => {
    escreve('brabo-engine', 'docs/outro.md', 'sem RN\n');
    commit('brabo-engine', 'nada');
    const r = spawnSync('node', [SCRIPT, '--repo', 'brabo-engine', '--base', 'base', '--vizinhos', '/nao/existe'], {
      cwd: path.join(tmp, 'brabo-engine'),
      encoding: 'utf8',
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('nada a cruzar');
  });
});
