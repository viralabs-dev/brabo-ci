import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { classificar, conferir, extrairRefs, novaLinha, reancorar, resolver, veredito } from './refs-com-simbolo.ts';

const aqui = fileURLToPath(new URL('.', import.meta.url));
const SCRIPT = join(aqui, 'refs-com-simbolo.ts');
// Pedaço REAL de docs/business-rules/web.md do brabo-web (af956cb) e os 2 arquivos que ele cita.
const FIXTURE = join(aqui, '__fixtures__/refs-com-simbolo/web');

const arquivo = (n: number, linhas: Record<number, string>) => Array.from({ length: n }, (_, i) => linhas[i + 1] ?? `x${i + 1}`);

describe('núcleo (cópia do brabo)', () => {
  it('extrai explícita e continuação; ignora ambígua e não-símbolo', () => {
    const rn = '- `a/b.ts:10` (`foo`), `:20` (`bar`), `:30` (MARCADOR=3), `:40`/`:50` (`x`/`y`)';
    expect(extrairRefs(rn).map((r) => `${r.caminho}:${r.linha}=${r.simbolo}`)).toEqual(['a/b.ts:10=foo', 'a/b.ts:20=bar']);
  });
  it('conferir respeita a janela de 3 linhas', () => {
    const a = arquivo(30, { 10: 'function foo() {}' });
    expect(conferir(a, 13, 'foo').bate).toBe(true);
    expect(conferir(a, 14, 'foo')).toEqual({ bate: false, achadoEm: 10 });
  });
  it('novaLinha: única e a ≤ 40 linhas; empate ou longe é null', () => {
    expect(novaLinha(arquivo(100, { 50: 'foo' }), 20, 'foo')).toBe(50);
    expect(novaLinha(arquivo(100, { 50: 'foo' }), 5, 'foo')).toBeNull();
    expect(novaLinha(arquivo(100, { 8: 'foo', 12: 'foo' }), 10, 'foo')).toBeNull();
  });
  it('reancorar troca só os dígitos, de trás para a frente', () => {
    const t = '`a.ts:9` (`f`) e `a.ts:100` (`g`)';
    const refs = extrairRefs(t).map((r, i) => ({ ...r, novaLinha: [12, 7][i]! }));
    expect(reancorar(t, refs)).toBe('`a.ts:12` (`f`) e `a.ts:7` (`g`)');
  });
  it('veredito: CEGO sem refs, reprova com quebrada, ok no resto', () => {
    expect(veredito({ total: 0, naoBatem: [], naoResolvidas: [] })).toBe('CEGO');
    expect(veredito({ total: 3, naoBatem: [{}], naoResolvidas: [] })).toBe('reprova');
    expect(veredito({ total: 3, naoBatem: [], naoResolvidas: [{}] })).toBe('reprova');
    expect(veredito({ total: 3, naoBatem: [], naoResolvidas: [] })).toBe('ok');
  });
});

describe('classificar e resolver', () => {
  const raiz = new Set(['src', 'test', 'docs']);
  it('apps/<eu>/ é interna, sem o prefixo', () => {
    expect(classificar('apps/web/src/a.ts', 'web', raiz)).toEqual({ tipo: 'interna', noRepo: 'src/a.ts' });
  });
  it('apps/<outro>/ e packages/ são externas', () => {
    expect(classificar('apps/api/src/a.ts', 'web', raiz).tipo).toBe('externa');
    expect(classificar('packages/shared/a.ts', 'web', raiz).tipo).toBe('externa');
  });
  it('sem prefixo: interna se o 1º segmento é da raiz do repo (api), senão externa (install.sh)', () => {
    expect(classificar('src/a.ts', 'api', raiz)).toEqual({ tipo: 'interna', noRepo: 'src/a.ts' });
    expect(classificar('install.sh', 'api', raiz).tipo).toBe('externa');
  });
  it('resolver: exato, sufixo único; ambíguo ou ausente é null', () => {
    const v = ['src/a/x.ts', 'src/b/x.ts', 'src/y.ts'];
    expect(resolver('src/y.ts', v)).toBe('src/y.ts');
    expect(resolver('a/x.ts', v)).toBe('src/a/x.ts');
    expect(resolver('x.ts', v)).toBeNull();
    expect(resolver('z.ts', v)).toBeNull();
  });
});

describe('ponta a ponta no fixture real do brabo-web', () => {
  const montar = () => {
    const d = mkdtempSync(join(tmpdir(), 'refs-'));
    cpSync(FIXTURE, d, { recursive: true });
    execFileSync('git', ['-C', d, 'init', '-q']);
    execFileSync('git', ['-C', d, 'add', '-A']);
    return d;
  };
  const rodar = (d: string, ...args: string[]) =>
    spawnSync('node', [SCRIPT, '--repo', 'web', ...args], { cwd: d, encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: '' } });

  it('verde: 4 internas batem e 1 externa só é listada, sem anotação', () => {
    const r = rodar(montar());
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('4 internas conferidas, 4 batem');
    expect(r.stdout).toContain('1 externas');
    expect(r.stdout).not.toContain('::');
  });

  it('mutação: deslocar o símbolo 10 linhas reprova e --escrever reancora', () => {
    const d = montar();
    const f = join(d, 'src/lib/activity.ts');
    writeFileSync(f, '// a\n'.repeat(10) + readFileSync(f, 'utf8'));
    const r = rodar(d);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('reancora para :105');
    expect(r.stdout).toContain('::error file=docs/business-rules/web.md');

    // --escrever sai 1 (o veredito é de antes), mas deixa o doc certo
    expect(rodar(d, '--escrever').status).toBe(1);
    expect(readFileSync(join(d, 'docs/business-rules/web.md'), 'utf8')).toContain('activity.ts:105');
    expect(rodar(d).status).toBe(0);
  });

  it('mutação: arquivo interno citado que sumiu reprova', () => {
    const d = montar();
    execFileSync('git', ['-C', d, 'rm', '-qf', 'src/lib/session-label.ts']);
    const r = rodar(d);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('arquivo não existe ou é ambíguo');
  });

  it('mutação: ref externa quebrada NÃO reprova', () => {
    const d = montar();
    const doc = join(d, 'docs/business-rules/web.md');
    writeFileSync(doc, readFileSync(doc, 'utf8').replace('port.ts:52', 'port.ts:9999'));
    expect(rodar(d).status).toBe(0);
  });

  it('CEGO: sem nenhuma ref interna reprova', () => {
    const d = montar();
    writeFileSync(join(d, 'docs/business-rules/web.md'), 'nada aqui\n');
    execFileSync('git', ['-C', d, 'add', '-A']);
    const r = rodar(d);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('CEGO');
  });
});
