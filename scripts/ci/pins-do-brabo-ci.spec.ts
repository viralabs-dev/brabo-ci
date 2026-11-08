import { describe, expect, it } from 'vitest';
import { resolverTagPelaApi, verificarPinsDoCi } from './pins-do-brabo-ci.ts';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const TAGS: Record<string, string> = { 'v1.3.0': A, 'v1.3.0-dev.3': B };
const tags = (t: string): Promise<string | undefined> => Promise.resolve(TAGS[t]);
const wf = (sha: string, comentario: string) => [
  { nome: 'x.yml', conteudo: `jobs:\n  a:\n    uses: viralabs-dev/brabo-ci/.github/workflows/cadeia.yml@${sha}${comentario}\n` },
];

describe('pins-do-brabo-ci', () => {
  it.each(['  # dev', '  # feature/x', '', '  # v1.3'])('reprova comentário fora do formato %j', async (c) => {
    const v = await verificarPinsDoCi(wf(A, c), 'dev', tags);
    expect(v).toHaveLength(1);
    expect(v[0]?.mensagem).toContain('forma de versão');
  });

  it('reprova SHA que não bate com a tag', async () => {
    const v = await verificarPinsDoCi(wf(B, '  # v1.3.0'), 'dev', tags);
    expect(v[0]?.mensagem).toContain('não é o da tag');
  });

  it('reprova tag inexistente', async () => {
    expect(await verificarPinsDoCi(wf(A, '  # v9.9.9'), 'dev', tags)).toHaveLength(1);
  });

  it('reprova -dev na main', async () => {
    const v = await verificarPinsDoCi(wf(B, '  # v1.3.0-dev.3'), 'main', tags);
    expect(v[0]?.mensagem).toContain('pré-release');
  });

  it('aceita -dev na dev', async () => {
    expect(await verificarPinsDoCi(wf(B, '  # v1.3.0-dev.3'), 'dev', tags)).toEqual([]);
  });

  it.each(['main', 'dev'])('aceita release final na %s', async (b) => {
    expect(await verificarPinsDoCi(wf(A, '  # v1.3.0'), b, tags)).toEqual([]);
  });

  it('isenta o próprio brabo-ci (AT-788, adendo ao ADR 0280): pre-release na main não reprova', async () => {
    expect(await verificarPinsDoCi(wf(B, '  # v1.3.0-dev.3'), 'main', tags, 'viralabs-dev/brabo-ci')).toEqual([]);
    expect(await verificarPinsDoCi(wf(B, '  # v1.3.0-dev.3'), 'main', tags, 'viralabs-dev/brabo-api')).toHaveLength(1);
  });

  it('ignora uses de outros repos e linhas comentadas', async () => {
    const conteudo = `    uses: actions/checkout@${A}  # v7\n    # uses: viralabs-dev/brabo-ci/x@${A}  # dev\n`;
    expect(await verificarPinsDoCi([{ nome: 'x.yml', conteudo }], 'main', tags)).toEqual([]);
  });
});

describe('resolverTagPelaApi', () => {
  it('segue tag anotada até o commit, 404 vira undefined e há cache', async () => {
    let chamadas = 0;
    const fake = ((url: string) => {
      chamadas++;
      if (url.endsWith('/v1.0.0')) return Promise.resolve(Response.json({ object: { type: 'tag', sha: 't', url: 'https://x/tag' } }));
      if (url === 'https://x/tag') return Promise.resolve(Response.json({ object: { type: 'commit', sha: A, url: '' } }));
      return Promise.resolve(new Response('', { status: 404 }));
    }) as unknown as typeof fetch;
    const r = resolverTagPelaApi('t', fake);
    expect(await r('v1.0.0')).toBe(A);
    expect(await r('v1.0.0')).toBe(A);
    expect(chamadas).toBe(2);
    expect(await r('v0.0.1')).toBeUndefined();
  });
});
