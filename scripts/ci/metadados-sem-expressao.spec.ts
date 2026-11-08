import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

/**
 * O runner AVALIA `${{ }}` nos metadados de uma action local (`description` da
 * action e dos inputs/outputs), onde só o contexto `github`/`inputs` de passos
 * existe: um `${{ inputs.x }}` citado em texto derruba o run inteiro com
 * "Unrecognized named-value" (ci#34, carimbo da `dev` quebrado). O actionlint
 * NÃO carrega a action local como o runner, então esta é a guarda.
 */

const raiz = fileURLToPath(new URL('../../.github/', import.meta.url));

type Meta = { description?: unknown; inputs?: Record<string, { description?: unknown }>; outputs?: Record<string, { description?: unknown }> };

/** Caminhos `arquivo: campo` das descrições que contêm `${{`. */
function descricoesComExpressao(arquivo: string, meta: Meta): string[] {
  const achados: string[] = [];
  const confere = (campo: string, v: unknown) => {
    if (typeof v === 'string' && v.includes('${{')) achados.push(`${arquivo}: ${campo}`);
  };
  confere('description', meta?.description);
  for (const [k, v] of Object.entries(meta?.inputs ?? {})) confere(`inputs.${k}.description`, v?.description);
  for (const [k, v] of Object.entries(meta?.outputs ?? {})) confere(`outputs.${k}.description`, v?.description);
  return achados;
}

const actions = readdirSync(join(raiz, 'actions')).map((d) => `actions/${d}/action.yml`);
const workflows = readdirSync(join(raiz, 'workflows')).filter((f) => /\.ya?ml$/.test(f)).map((f) => `workflows/${f}`);

describe('descricoesComExpressao', () => {
  it('reprova `${{` na description da action e dos inputs', () => {
    const meta = { description: 'cita ${{ inputs.ci_ref }}', inputs: { a: { description: 'ok' }, b: { description: '${{ x }}' } } };
    expect(descricoesComExpressao('x', meta)).toEqual(['x: description', 'x: inputs.b.description']);
  });
});

describe('metadados sem expressão', () => {
  it.each(actions)('%s', (rel) => {
    const meta = parse(readFileSync(join(raiz, rel), 'utf8')) as Meta;
    expect(descricoesComExpressao(rel, meta)).toEqual([]);
  });

  it.each(workflows)('%s (inputs/outputs do workflow_call)', (rel) => {
    const wf = parse(readFileSync(join(raiz, rel), 'utf8')) as { on?: { workflow_call?: Meta } };
    expect(descricoesComExpressao(rel, wf.on?.workflow_call ?? {})).toEqual([]);
  });
});
