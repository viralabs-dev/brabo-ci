import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  divergencias,
  exemploDeChamada,
  gerarTudo,
  lerAction,
  lerMarcadores,
  lerTodos,
  lerWorkflow,
  trocarTabela,
} from './referencia-dos-workflows.ts';

const RAIZ = join(import.meta.dirname, '..', '..');
const temporarios: string[] = [];
afterEach(() => {
  for (const d of temporarios.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Uma cópia do que o gerador lê e escreve, para mutar sem tocar o repo. */
function copiaDoRepo(): string {
  const d = mkdtempSync(join(tmpdir(), 'ref-wf-'));
  temporarios.push(d);
  for (const p of ['.github', 'README.md', 'scripts/ci/docs/reference/workflows']) {
    mkdirSync(join(d, p, '..'), { recursive: true });
    cpSync(join(RAIZ, p), join(d, p), { recursive: true });
  }
  return d;
}

const MINIMO = `name: x
# propósito: Faz x.
# chamador:
#   pull_request:
#     types: [opened]
on:
  workflow_call:
    inputs:
      ci_ref:
        type: string
        required: true
      n:
        type: number
        default: 3
        description: 'um | outro'
    secrets:
      TOKEN:
        required: true
permissions:
  contents: read
jobs:
  a:
    name: Job A
    permissions:
      contents: write
    runs-on: ubuntu-26.04
    steps: []
`;

describe('o repo está em dia com o próprio YAML', () => {
  it('cada reutilizável tem propósito e chamador, e a referência commitada confere', () => {
    const rs = lerTodos(RAIZ);
    expect(rs.filter((r) => r.especie === 'workflow').length).toBeGreaterThanOrEqual(14);
    expect(rs.filter((r) => r.especie === 'action').map((r) => r.nome)).toEqual(['preparar', 'vinculos']);
    for (const r of rs) expect(r.proposito.length, r.nome).toBeLessThanOrEqual(220);
    expect(divergencias(RAIZ, gerarTudo(RAIZ))).toEqual([]);
  });

  it('o README tem até 150 linhas (o esqueleto de 8 seções mais o mapa gerado)', () => {
    expect(readFileSync(join(RAIZ, 'README.md'), 'utf8').trimEnd().split('\n').length).toBeLessThanOrEqual(150);
  });

  it('o --check do CLI sai com 0 no repo', () => {
    const r = spawnSync('node', ['scripts/ci/referencia-dos-workflows.ts', '--check'], { cwd: RAIZ, encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
  });
});

describe('o --check reprova a referência desatualizada', () => {
  it('mudar um input, um secret ou uma permissão no YAML aparece como divergência', () => {
    const d = copiaDoRepo();
    expect(divergencias(d, gerarTudo(d))).toEqual([]);
    const arq = join(d, '.github/workflows/pr-police.yml');
    writeFileSync(arq, readFileSync(arq, 'utf8').replace('inputs:\n      ci_ref:', 'inputs:\n      novo_input:\n        type: string\n        required: false\n      ci_ref:'));
    expect(divergencias(d, gerarTudo(d))).toContain('scripts/ci/docs/reference/workflows/pr-police.md');
  });

  it('o CLI com --check sai com 1 e diz como consertar', () => {
    const d = copiaDoRepo();
    const pagina = join(d, 'scripts/ci/docs/reference/workflows/pr-police.md');
    writeFileSync(pagina, readFileSync(pagina, 'utf8') + '\nmão\n');
    const r = spawnSync('node', [join(RAIZ, 'scripts/ci/referencia-dos-workflows.ts'), '--check', '--raiz', d], { encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('referencia-dos-workflows.ts');
  });

  it('página de um workflow que saiu sobra e reprova; o gerador sem --check a escreve de volta', () => {
    const d = copiaDoRepo();
    writeFileSync(join(d, 'scripts/ci/docs/reference/workflows/fantasma.md'), 'x');
    expect(divergencias(d, gerarTudo(d))).toEqual(['scripts/ci/docs/reference/workflows/fantasma.md (sobra: o YAML não existe mais)']);
    rmSync(join(d, 'scripts/ci/docs/reference/workflows/pr-police.md'));
    const r = spawnSync('node', [join(RAIZ, 'scripts/ci/referencia-dos-workflows.ts'), '--raiz', d], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(existsSync(join(d, 'scripts/ci/docs/reference/workflows/pr-police.md'))).toBe(true);
  });
});

describe('leitura do YAML', () => {
  it('extrai inputs, secrets, a união das permissões e os jobs', () => {
    const r = lerWorkflow(MINIMO, '.github/workflows/x.yml')!;
    expect(r.inputs.map((c) => [c.nome, c.tipo, c.obrigatorio, c.padrao])).toEqual([
      ['ci_ref', 'string', true, ''],
      ['n', 'number', false, '3'],
    ]);
    expect(r.secrets.map((c) => c.nome)).toEqual(['TOKEN']);
    expect(r.permissoes).toEqual({ contents: 'write' });
    expect(r.jobs).toEqual([{ id: 'a', nome: 'Job A' }]);
    expect(r.chamador).toBe('pull_request:\n  types: [opened]');
  });

  it('arquivo sem workflow_call não é reutilizável', () => {
    expect(lerWorkflow('on: push\njobs: {}\n', 'a.yml')).toBeNull();
  });

  it('falta de marcador é erro que diz qual', () => {
    expect(() => lerMarcadores('# chamador:\n#   push:\n', 'a.yml')).toThrow('# propósito:');
    expect(() => lerMarcadores('# propósito: x\n', 'a.yml')).toThrow('# chamador:');
  });

  it('a action composta lê os inputs e usa o bloco como exemplo', () => {
    const a = lerAction('# propósito: P\n# chamador:\n#   - uses: a/b@c\nname: A\ninputs:\n  i:\n    description: d\n', '.github/actions/foo/action.yml');
    expect(a.nome).toBe('foo');
    expect(exemploDeChamada(a)).toBe('- uses: a/b@c');
  });

  it('a tabela do README exige os marcadores', () => {
    expect(() => trocarTabela('sem marcador', 'x')).toThrow('marcadores');
  });
});

describe('o exemplo de chamada', () => {
  it('traz o on, as permissões, os inputs obrigatórios e os secrets obrigatórios', () => {
    const ex = exemploDeChamada(lerWorkflow(MINIMO, '.github/workflows/x.yml')!);
    expect(ex).toContain('on:\n  pull_request:\n    types: [opened]');
    expect(ex).toContain('      contents: write');
    expect(ex).toContain('uses: <org>/brabo-ci/.github/workflows/x.yml@<sha>  # vX.Y.Z');
    expect(ex).toContain('ci_ref: <sha>');
    expect(ex).not.toContain('novo');
    expect(ex).toContain('TOKEN: ${{ secrets.TOKEN }}');
  });

  const actionlint = process.env['ACTIONLINT'] ?? '/tmp/actionlint';
  it.skipIf(!existsSync(actionlint))('todo exemplo passa no actionlint', () => {
    const d = mkdtempSync(join(tmpdir(), 'ref-ex-'));
    temporarios.push(d);
    const alvos = lerTodos(RAIZ)
      .filter((r) => r.especie === 'workflow')
      .map((r) => {
        const arq = join(d, `${r.nome}.yml`);
        writeFileSync(arq, exemploDeChamada(r) + '\n');
        return arq;
      });
    const r = spawnSync(actionlint, ['-config-file', join(RAIZ, '.github/actionlint.yaml'), ...alvos], { encoding: 'utf8' });
    expect(r.stdout + r.stderr).toBe('');
    expect(r.status).toBe(0);
  });
});
