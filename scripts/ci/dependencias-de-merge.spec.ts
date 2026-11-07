import { describe, expect, it } from 'vitest';
import { REPOS, avaliar, lerDeclaracoes, type PrRemota, type Ref } from './dependencias-de-merge.ts';

const EU: Ref = { repo: 'brabo-infra', n: 26 };
const pr = (state: PrRemota['state'], corpo = ''): PrRemota => ({ state, titulo: 'titulo | com barra', url: 'https://github.com/x', corpo });
const mundo = (m: Record<string, PrRemota>) => async (r: Ref) => m[`${r.repo}#${r.n}`] ?? null;
const API = 'Depende-de: viralabs-dev/brabo-api#56';

describe('lerDeclaracoes', () => {
  it('lê a linha pura, com "- " e várias, sem repetir', () => {
    const { deps, erros } = lerDeclaracoes(`${API}\n- Depende-de: viralabs-dev/brabo-web#3\n  ${API}\r\n`);
    expect(deps).toEqual([{ repo: 'brabo-api', n: 56 }, { repo: 'brabo-web', n: 3 }]);
    expect(erros).toEqual([]);
  });
  it('a lista fechada tem os 11 repos do mapa da pasta-mãe (REPOS do clonar-tudo.sh)', () => {
    expect([...REPOS].sort()).toEqual('brabo brabo-api brabo-broker brabo-ci brabo-contracts brabo-engine brabo-infra brabo-qa brabo-runner brabo-web brabo-workspace'.split(' '));
  });
  it.each([
    ['repo fora da lista', 'Depende-de: viralabs-dev/outro#1', 'fora da lista'],
    ['owner diferente', 'Depende-de: daneiel/brabo-api#1', 'owner diferente'],
    ['sem número', 'Depende-de: viralabs-dev/brabo-api', 'malformada'],
    ['minúscula', 'depende de viralabs-dev/brabo-api#1', 'malformada'],
    ['maiúscula no repo', 'Depende-de: viralabs-dev/Brabo-Api#1', 'malformada'],
    ['lixo no fim', 'Depende-de: viralabs-dev/brabo-api#1 ok', 'malformada'],
  ])('reprova: %s', (_n, linha, motivo) => {
    const { deps, erros } = lerDeclaracoes(`texto\n${linha}`);
    expect(deps).toEqual([]);
    expect(erros).toEqual([expect.stringContaining(motivo)]);
  });
  it('ignora o exemplo em comentário HTML e prosa que só contém a palavra', () => {
    expect(lerDeclaracoes(`<!-- Depende-de: viralabs-dev/brabo-api#1 -->\nisto depende de coisas`)).toEqual({ deps: [], erros: [] });
  });
});

describe('avaliar', () => {
  it('sem declaração: success', async () => {
    expect(await avaliar(EU, 'nada', mundo({}))).toMatchObject({ status: 'completed', conclusion: 'success' });
  });
  it('dependência OPEN: amarelo "esperando", sem conclusion', async () => {
    const v = await avaliar(EU, API, mundo({ 'brabo-api#56': pr('OPEN') }));
    expect(v).toMatchObject({ status: 'in_progress', title: 'esperando viralabs-dev/brabo-api#56' });
    expect(v.conclusion).toBeUndefined();
    expect(v.summary).toContain('titulo   com barra');
  });
  it('lista só as que faltam', async () => {
    const v = await avaliar(EU, `${API}\nDepende-de: viralabs-dev/brabo-web#3`, mundo({ 'brabo-api#56': pr('MERGED'), 'brabo-web#3': pr('OPEN') }));
    expect(v.title).toBe('esperando viralabs-dev/brabo-web#3');
  });
  it('todas MERGED: success', async () => {
    expect(await avaliar(EU, API, mundo({ 'brabo-api#56': pr('MERGED') }))).toMatchObject({ status: 'completed', conclusion: 'success', title: 'Dependências mergeadas' });
  });
  it('fechada sem merge: failure', async () => {
    const v = await avaliar(EU, API, mundo({ 'brabo-api#56': pr('CLOSED') }));
    expect(v).toMatchObject({ conclusion: 'failure' });
    expect(v.summary).toContain('fechada sem merge');
  });
  it('PR inexistente: failure', async () => {
    expect(await avaliar(EU, API, mundo({}))).toMatchObject({ conclusion: 'failure', summary: expect.stringContaining('não existe') });
  });
  it('autorreferência: failure', async () => {
    const v = await avaliar(EU, 'Depende-de: viralabs-dev/brabo-infra#26', mundo({}));
    expect(v).toMatchObject({ conclusion: 'failure', summary: expect.stringContaining('cita a si mesma') });
  });
  it('linha inválida: failure, sem consultar a rede', async () => {
    const v = await avaliar(EU, 'Depende-de: x/y#1', async () => {
      throw new Error('rede');
    });
    expect(v.conclusion).toBe('failure');
  });
  it('ciclo A → B → A: failure com o caminho', async () => {
    const v = await avaliar(EU, API, mundo({ 'brabo-api#56': pr('OPEN', 'Depende-de: viralabs-dev/brabo-infra#26') }));
    expect(v.conclusion).toBe('failure');
    expect(v.summary).toContain('viralabs-dev/brabo-infra#26 → viralabs-dev/brabo-api#56 → viralabs-dev/brabo-infra#26');
  });
  it('ciclo que não passa por esta PR também reprova', async () => {
    const v = await avaliar(EU, API, mundo({ 'brabo-api#56': pr('OPEN', 'Depende-de: viralabs-dev/brabo-web#1'), 'brabo-web#1': pr('OPEN', 'Depende-de: viralabs-dev/brabo-api#56') }));
    expect(v.summary).toContain('ciclo de dependências');
  });
  it('dependência da dependência já MERGED não vira ciclo', async () => {
    const v = await avaliar(EU, API, mundo({ 'brabo-api#56': pr('OPEN', 'Depende-de: viralabs-dev/brabo-web#1'), 'brabo-web#1': pr('MERGED', 'Depende-de: viralabs-dev/brabo-infra#26') }));
    expect(v.status).toBe('in_progress');
  });
  // cadeia linear: infra#26 -> p1 -> p2 -> ... ; n níveis abaixo da PR avaliada
  const cadeia = (n: number) => {
    const m: Record<string, PrRemota> = {};
    for (let i = 1; i <= n; i++) m[`brabo-api#${i}`] = pr('OPEN', i < n ? `Depende-de: viralabs-dev/brabo-api#${i + 1}` : '');
    return mundo(m);
  };
  it('cadeia de 5 arestas passa (espera); de 6 estoura a profundidade', async () => {
    expect((await avaliar(EU, 'Depende-de: viralabs-dev/brabo-api#1', cadeia(5))).status).toBe('in_progress');
    const v = await avaliar(EU, 'Depende-de: viralabs-dev/brabo-api#1', cadeia(6));
    expect(v).toMatchObject({ conclusion: 'failure', summary: expect.stringContaining('profundidade 5') });
  });
  it('nunca devolve neutral', async () => {
    for (const estado of ['OPEN', 'CLOSED', 'MERGED'] as const) {
      expect((await avaliar(EU, API, mundo({ 'brabo-api#56': pr(estado) }))).conclusion).not.toBe('neutral');
    }
  });
});
