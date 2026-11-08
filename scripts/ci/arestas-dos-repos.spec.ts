import { describe, expect, it } from 'vitest';
import { conferirListas, provarArestas, type Leitor } from './arestas-dos-repos.ts';
import { lerMapa, MARCA_FIM, MARCA_INICIO } from './mapa-dos-repos.ts';

const mapa = lerMapa(`repos:
  brabo: { papel: x, proposito: P, como_e_usado: u, depende_de: [{ repo: brabo-api, tipo: imagem, prova: "componentes.json:2" }, { repo: brabo-api, tipo: doc, prova: "irmaos.lock:3" }] }
  brabo-api: { papel: x, proposito: P, como_e_usado: u, depende_de: [{ repo: brabo-contracts, tipo: contrato, prova: "package.json:2" }] }
  brabo-contracts: { papel: x, proposito: P, como_e_usado: u, depende_de: [] }
  brabo-workspace: { papel: x, proposito: P, como_e_usado: u, depende_de: [{ repo: brabo, tipo: codigo, prova: "clonar-tudo.sh:2" }, { repo: brabo-api, tipo: codigo, prova: "clonar-tudo.sh:2" }, { repo: brabo-contracts, tipo: codigo, prova: "clonar-tudo.sh:2" }] }`);

const arquivos: Record<string, string> = {
  'brabo/componentes.json': '{\n"api": { "repo": "viralabs-dev/brabo-api" },\n"c": { "repo": "viralabs-dev/brabo-contracts" }\n}',
  'brabo/irmaos.lock': '# c\n# c\nbrabo-api abc\n',
  'brabo-api/package.json': '{\n"@brabo/shared": "npm:@viralabs-dev/brabo-shared@1.2.0"\n}',
  'brabo-workspace/clonar-tudo.sh': '#!/bin/bash\nREPOS="brabo brabo-api brabo-contracts brabo-old=brabo-legacy"\n',
};
const ler = (a = arquivos): Leitor => async (r, f) => a[`${r}/${f}`] ?? null;

const mapaNovo = lerMapa(`repos:
  brabo: { papel: x, proposito: P, como_e_usado: u, depende_de: [{ repo: brabo-api, tipo: imagem, prova: { arquivo: componentes.json, trecho: '"repo": "viralabs-dev/brabo-api"' } }] }
  brabo-api: { papel: x, proposito: P, como_e_usado: u, depende_de: [] }`);
const comp = '{\n"api": { "repo": "viralabs-dev/brabo-api" }\n}';
const antigo = lerMapa(`repos:
  brabo: { papel: x, proposito: P, como_e_usado: u, depende_de: [{ repo: brabo-api, tipo: imagem, prova: "componentes.json:2" }] }
  brabo-api: { papel: x, proposito: P, como_e_usado: u, depende_de: [] }`);

describe('prova por trecho (AT-848)', () => {
  it('formato novo: acha o trecho e continua verde com linha inserida no topo; o antigo fica vermelho', async () => {
    const topo = `// novo\n${comp}`;
    expect((await provarArestas(mapaNovo, ler({ 'brabo/componentes.json': comp }))).ok).toBe(1);
    expect((await provarArestas(mapaNovo, ler({ 'brabo/componentes.json': topo }))).falhas).toEqual([]);
    expect((await provarArestas(antigo, ler({ 'brabo/componentes.json': comp }))).falhas).toEqual([]);
    expect((await provarArestas(antigo, ler({ 'brabo/componentes.json': topo }))).falhas.join()).toMatch(/não menciona/);
  });
  it('reprova trecho ausente, arquivo ausente e trecho que não cita o destino', async () => {
    expect((await provarArestas(mapaNovo, ler({ 'brabo/componentes.json': '{}' }))).falhas.join()).toMatch(/trecho não está/);
    expect((await provarArestas(mapaNovo, ler({}))).falhas.join()).toMatch(/arquivo não existe/);
    const m = lerMapa(`repos:
  brabo: { papel: x, proposito: P, como_e_usado: u, depende_de: [{ repo: brabo-api, tipo: imagem, prova: { arquivo: a.txt, trecho: 'outra coisa' } }] }
  brabo-api: { papel: x, proposito: P, como_e_usado: u, depende_de: [] }`);
    expect((await provarArestas(m, ler({ 'brabo/a.txt': 'x outra coisa y' }))).falhas.join()).toMatch(/não menciona brabo-api/);
  });
  it('o trecho só dentro do bloco mapa: reprova (os dois formatos); fora dele vale', async () => {
    const bloco = `${MARCA_INICIO}\n"repo": "viralabs-dev/brabo-api"\n${MARCA_FIM}`;
    expect((await provarArestas(mapaNovo, ler({ 'brabo/componentes.json': bloco }))).falhas.join()).toMatch(/trecho não está/);
    expect((await provarArestas(antigo, ler({ 'brabo/componentes.json': `x\n${bloco}` }))).falhas.join()).toMatch(/bloco mapa:/);
    expect((await provarArestas(mapaNovo, ler({ 'brabo/componentes.json': `${bloco}\n${comp}` }))).falhas).toEqual([]);
  });
});

describe('arestas-dos-repos (AT-825b)', () => {
  it('prova a aresta quando o arquivo existe e a linha menciona o destino (alias do contracts)', async () => {
    const r = await provarArestas(mapa, ler());
    expect(r.falhas).toEqual([]);
    expect(r.ok).toBe(6);
  });
  it('reprova arquivo ausente, linha fora do arquivo e linha que não menciona o destino', async () => {
    const a = { ...arquivos };
    delete a['brabo-api/package.json'];
    a['brabo/irmaos.lock'] = '# c\nbrabo-api abc\n';
    a['brabo/componentes.json'] = '{\n"api": {}\n}';
    a['brabo-workspace/clonar-tudo.sh'] = '#!/bin/bash\nREPOS="brabo brabo-api"\n';
    const f = (await provarArestas(mapa, ler(a))).falhas.join('\n');
    expect(f).toMatch(/package\.json:2: arquivo não existe/);
    expect(f).toMatch(/irmaos\.lock:3: linha fora do arquivo/);
    expect(f).toMatch(/componentes\.json:2: a linha não menciona brabo-api/);
    expect(f).toMatch(/clonar-tudo\.sh:2: a linha não menciona brabo-contracts/);
  });
  it('nome contido em outro (brabo em brabo-api) não conta como menção', async () => {
    const a = { ...arquivos, 'brabo-workspace/clonar-tudo.sh': '#!/bin/bash\nREPOS="brabo-api brabo-contracts"\n' };
    const f = (await provarArestas(mapa, ler(a))).falhas.join('\n');
    expect(f).toMatch(/brabo-workspace → brabo \(codigo\)/);
  });
  it('listas batem: REPOS, irmaos.lock e componentes.json', async () => {
    // o componentes.json cita o contracts e o mapa do brabo só tem aresta doc para ele
    const f = await conferirListas(mapa, ler());
    expect(f).toEqual(['componentes.json: `brabo-contracts` sem aresta imagem/código/contrato no repos.yml']);
  });
  it('lista divergente reprova nos dois sentidos', async () => {
    const a = {
      ...arquivos,
      'brabo-workspace/clonar-tudo.sh': 'REPOS="brabo brabo-api brabo-novo"\n',
      'brabo/irmaos.lock': 'brabo-api abc\nbrabo-extra x\n',
    };
    const f = (await conferirListas(mapa, ler(a))).join('\n');
    expect(f).toContain('clonar-tudo.sh REPOS: `brabo-novo` está lá e não no repos.yml');
    expect(f).toContain('clonar-tudo.sh REPOS: `brabo-contracts` está no repos.yml e não lá');
    expect(f).toContain('irmaos.lock: `brabo-extra` está lá e não no repos.yml');
  });
});
