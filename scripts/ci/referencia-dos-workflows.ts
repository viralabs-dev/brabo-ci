/**
 * referencia-dos-workflows — gera a referência de cada reutilizável do YAML dele.
 *
 * Lê cada `.github/workflows/*.yml` com `workflow_call` e cada
 * `.github/actions/<nome>/action.yml`, e escreve
 * `scripts/ci/docs/reference/workflows/<nome>.md` (inputs, secrets, permissões,
 * jobs, gatilhos e um exemplo de chamada) mais a tabela do README entre os
 * marcadores `<!-- workflows:inicio -->` e `<!-- workflows:fim -->`.
 *
 * Marcadores que o autor do YAML escreve (comentários no topo do arquivo):
 *   # propósito: <uma linha>
 *   # chamador:
 *   #   <YAML: o `on:` recomendado, ou o passo `uses:` da action>
 *
 * Uso: `node scripts/ci/referencia-dos-workflows.ts [--check] [--raiz <dir>]`.
 * `--check` não escreve: sai com 1 se o que está commitado diverge do YAML.
 *
 * Sintaxe apagável apenas (o Node executa este `.ts` por type stripping).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const PASTA_DAS_PAGINAS = 'scripts/ci/docs/reference/workflows';
export const MARCA_INICIO = '<!-- workflows:inicio -->';
export const MARCA_FIM = '<!-- workflows:fim -->';

const NIVEL: Record<string, number> = { none: 0, read: 1, write: 2 };

export interface Campo {
  nome: string;
  tipo: string;
  obrigatorio: boolean;
  padrao: string;
  descricao: string;
}

export interface Reutilizavel {
  /** `workflow` ou `action`. */
  especie: 'workflow' | 'action';
  nome: string;
  /** Caminho no repo, ex.: `.github/workflows/pr-police.yml`. */
  arquivo: string;
  proposito: string;
  /** O bloco `# chamador:`, já sem o `# `. */
  chamador: string;
  inputs: Campo[];
  secrets: Campo[];
  outputs: Campo[];
  /** recurso -> nível, a união das `permissions` do workflow e dos jobs. */
  permissoes: Record<string, string>;
  jobs: { id: string; nome: string }[];
}

type Mapa = Record<string, Record<string, unknown> | null | undefined>;

function texto(v: unknown): string {
  return v === undefined || v === null ? '' : String(v).replace(/\s+/g, ' ').trim();
}

function campos(mapa: Mapa | undefined): Campo[] {
  return Object.entries(mapa ?? {}).map(([nome, c]) => ({
    nome,
    tipo: texto(c?.['type']) || 'string',
    obrigatorio: c?.['required'] === true,
    padrao: c?.['default'] === undefined ? '' : texto(c['default']),
    descricao: texto(c?.['description']),
  }));
}

/** Extrai `# propósito:` e o bloco `# chamador:` dos comentários do arquivo. */
export function lerMarcadores(conteudo: string, arquivo: string): { proposito: string; chamador: string } {
  const linhas = conteudo.split('\n');
  const p = linhas.find((l) => l.startsWith('# propósito:'));
  const proposito = p ? p.slice('# propósito:'.length).trim() : '';
  const i = linhas.findIndex((l) => l.startsWith('# chamador:'));
  const bloco: string[] = [];
  if (i !== -1) {
    const resto = linhas[i]!.slice('# chamador:'.length).trim();
    if (resto !== '') bloco.push(resto);
    for (const l of linhas.slice(i + 1)) {
      if (!/^#  +\S/.test(l)) break;
      bloco.push(l.slice(1));
    }
  }
  if (proposito === '') throw new Error(`${arquivo}: falta o marcador "# propósito: <uma linha>" no topo.`);
  if (bloco.length === 0) throw new Error(`${arquivo}: falta o bloco "# chamador:" (YAML indentado com 2 espaços após "#").`);
  const recuo = Math.min(...bloco.map((l) => l.length - l.trimStart().length));
  return { proposito, chamador: bloco.map((l) => l.slice(recuo)).join('\n') };
}

function unirPermissoes(destino: Record<string, string>, perm: unknown): void {
  if (perm === 'read-all' || perm === 'write-all') {
    destino['todas'] = perm === 'write-all' ? 'write' : 'read';
    return;
  }
  if (perm === null || typeof perm !== 'object') return;
  for (const [recurso, nivel] of Object.entries(perm as Record<string, string>)) {
    if ((NIVEL[nivel] ?? 0) >= (NIVEL[destino[recurso] ?? 'none'] ?? 0)) destino[recurso] = nivel;
  }
}

/** `null` quando o arquivo não é reutilizável (sem `workflow_call`). */
export function lerWorkflow(conteudo: string, arquivo: string): Reutilizavel | null {
  const doc = parse(conteudo) as Record<string, unknown>;
  const on = (doc['on'] ?? doc['true']) as Record<string, unknown> | undefined;
  const wc = on && typeof on === 'object' ? (on['workflow_call'] as Record<string, unknown> | null | undefined) : undefined;
  if (wc === undefined) return null;
  const { proposito, chamador } = lerMarcadores(conteudo, arquivo);
  const jobs = (doc['jobs'] ?? {}) as Record<string, Record<string, unknown>>;
  const permissoes: Record<string, string> = {};
  unirPermissoes(permissoes, doc['permissions']);
  for (const j of Object.values(jobs)) unirPermissoes(permissoes, j['permissions']);
  return {
    especie: 'workflow',
    nome: arquivo.replace(/^.*\//, '').replace(/\.ya?ml$/, ''),
    arquivo,
    proposito,
    chamador,
    inputs: campos(wc?.['inputs'] as Mapa | undefined),
    secrets: campos(wc?.['secrets'] as Mapa | undefined),
    outputs: campos(wc?.['outputs'] as Mapa | undefined),
    permissoes,
    jobs: Object.entries(jobs).map(([id, j]) => ({ id, nome: texto(j['name']) || id })),
  };
}

export function lerAction(conteudo: string, arquivo: string): Reutilizavel {
  const doc = parse(conteudo) as Record<string, unknown>;
  const { proposito, chamador } = lerMarcadores(conteudo, arquivo);
  return {
    especie: 'action',
    nome: arquivo.split('/').slice(-2, -1)[0]!,
    arquivo,
    proposito,
    chamador,
    inputs: campos(doc['inputs'] as Mapa | undefined),
    secrets: [],
    outputs: campos(doc['outputs'] as Mapa | undefined),
    permissoes: {},
    jobs: [],
  };
}

// ------------------------------------------------------------------ escrita

function celula(s: string): string {
  return (s === '' ? '-' : s).replace(/\|/g, '\\|');
}

function tabela(titulos: string[], linhas: string[][]): string {
  return [
    `| ${titulos.join(' | ')} |`,
    `|${titulos.map(() => '---').join('|')}|`,
    ...linhas.map((l) => `| ${l.map(celula).join(' | ')} |`),
  ].join('\n');
}

function valorDeExemplo(c: Campo): string {
  if (c.nome === 'ci_ref') return '<sha>';
  if (c.padrao !== '') return `'${c.padrao}'`;
  if (c.tipo === 'boolean') return 'false';
  if (c.tipo === 'number') return '0';
  return "'<valor>'";
}

function recuar(bloco: string, n: number): string {
  return bloco
    .split('\n')
    .map((l) => (l === '' ? l : ' '.repeat(n) + l))
    .join('\n');
}

export function exemploDeChamada(r: Reutilizavel): string {
  if (r.especie === 'action') return r.chamador;
  const permissoes = Object.entries(r.permissoes).sort(([a], [b]) => a.localeCompare(b));
  const obrigatorios = r.inputs.filter((c) => c.obrigatorio);
  const segredos = r.secrets.filter((c) => c.obrigatorio);
  const l = [
    '# .github/workflows/exemplo.yml no repositório que chama',
    'name: exemplo',
    'on:',
    recuar(r.chamador, 2),
    'jobs:',
    `  ${r.nome}:`,
  ];
  if (permissoes.length > 0) {
    l.push('    permissions:', ...permissoes.map(([k, v]) => `      ${k}: ${v}`));
  }
  l.push(`    uses: <org>/brabo-ci/.github/workflows/${r.nome}.yml@<sha>  # vX.Y.Z`);
  if (obrigatorios.length > 0) {
    l.push('    with:', ...obrigatorios.map((c) => `      ${c.nome}: ${valorDeExemplo(c)}`));
  }
  if (segredos.length > 0) {
    l.push('    secrets:', ...segredos.map((c) => `      ${c.nome}: \${{ secrets.${c.nome} }}`));
  }
  return l.join('\n');
}

const AVISO = '<!-- GERADO por scripts/ci/referencia-dos-workflows.ts a partir do YAML. Não edite à mão: rode o gerador. -->';

export function gerarPagina(r: Reutilizavel): string {
  const campo = (cs: Campo[]): string =>
    tabela(
      ['nome', 'tipo', 'obrigatório', 'padrão', 'descrição'],
      cs.map((c) => [`\`${c.nome}\``, c.tipo, c.obrigatorio ? 'sim' : 'não', c.padrao, c.descricao]),
    );
  const s: string[] = [
    '---',
    `id: workflow-${r.nome}`,
    `title: ${r.especie === 'workflow' ? 'Reutilizável' : 'Action'} ${r.nome}`,
    `sidebar_label: ${r.nome}`,
    `description: ${JSON.stringify(r.proposito)}`,
    `keywords: [brabo-ci, ${r.especie === 'workflow' ? 'workflow_call' : 'action composta'}, ${r.nome}]`,
    '---',
    '',
    AVISO,
    '',
    `# \`${r.nome}\` {#${r.nome}}`,
    '',
    `**Para quem é:** quem vai ${r.especie === 'workflow' ? 'chamar este reutilizável' : 'usar esta action'} num repositório seu. **Depois de ler**, você escreve o \`uses:\` com ${
      r.especie === 'workflow' ? 'os inputs, os secrets, as permissões e os gatilhos certos' : 'os inputs certos'
    }, sem abrir o YAML. Fonte: \`${r.arquivo}\`.`,
    '',
    '## O que faz',
    '',
    r.proposito,
    '',
  ];
  if (r.especie === 'workflow') {
    s.push('## Gatilhos recomendados', '', 'O reutilizável não declara gatilhos: quem chama declara. Os recomendados são:', '', '```yaml', r.chamador, '```', '');
  }
  s.push('## Inputs', '', r.inputs.length > 0 ? campo(r.inputs) : 'Nenhum.', '');
  if (r.especie === 'workflow') {
    s.push(
      '## Secrets',
      '',
      r.secrets.length > 0
        ? tabela(['nome', 'obrigatório', 'descrição'], r.secrets.map((c) => [`\`${c.nome}\``, c.obrigatorio ? 'sim' : 'não', c.descricao]))
        : 'Nenhum.',
      '',
    );
    s.push(
      '## Permissões que o chamador precisa conceder',
      '',
      Object.keys(r.permissoes).length > 0
        ? 'A união do que o workflow e os jobs dele declaram. O job que chama precisa conceder pelo menos isto.\n\n' +
            tabela(
              ['permissão', 'nível'],
              Object.entries(r.permissoes)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => [`\`${k}\``, v]),
            )
        : 'Nenhuma além do padrão.',
      '',
    );
    s.push(
      '## Jobs',
      '',
      'Os nomes dos jobs são os nomes dos checks que a PR mostra (o prefixo do job que chama vem antes).',
      '',
      tabela(['job', 'nome do check'], r.jobs.map((j) => [`\`${j.id}\``, j.nome])),
      '',
    );
  }
  if (r.outputs.length > 0) s.push('## Outputs', '', campo(r.outputs), '');
  s.push('## Exemplo de chamada', '', '`<org>` é a organização onde o brabo-ci mora, e `<sha>`, o commit que você fixa (o `ci_ref` repete o SHA do `uses:`).', '', '```yaml', exemploDeChamada(r), '```', '');
  return s.join('\n');
}

export function gerarTabelaDoReadme(rs: Reutilizavel[]): string {
  return [
    MARCA_INICIO,
    tabela(
      ['Reutilizável', 'Propósito', 'Referência'],
      rs.map((r) => [`\`${r.nome}\``, r.proposito, `[${r.nome}](${PASTA_DAS_PAGINAS}/${r.nome}.md)`]),
    ),
    MARCA_FIM,
  ].join('\n');
}

// ------------------------------------------------------------------ entrada

export function lerTodos(raiz: string): Reutilizavel[] {
  const rs: Reutilizavel[] = [];
  const wf = join(raiz, '.github/workflows');
  for (const f of readdirSync(wf).filter((x) => /\.ya?ml$/.test(x)).sort()) {
    const r = lerWorkflow(readFileSync(join(wf, f), 'utf8'), `.github/workflows/${f}`);
    if (r) rs.push(r);
  }
  const ac = join(raiz, '.github/actions');
  if (existsSync(ac)) {
    for (const d of readdirSync(ac).sort()) {
      const arq = join(ac, d, 'action.yml');
      if (existsSync(arq)) rs.push(lerAction(readFileSync(arq, 'utf8'), `.github/actions/${d}/action.yml`));
    }
  }
  return rs;
}

/** Substitui o bloco entre os marcadores do README; erra se eles não existem. */
export function trocarTabela(readme: string, tabelaNova: string): string {
  const i = readme.indexOf(MARCA_INICIO);
  const f = readme.indexOf(MARCA_FIM);
  if (i === -1 || f === -1 || f < i) throw new Error(`README.md: faltam os marcadores ${MARCA_INICIO} e ${MARCA_FIM}.`);
  return readme.slice(0, i) + tabelaNova + readme.slice(f + MARCA_FIM.length);
}

/** O que deveria estar commitado: caminho relativo -> conteúdo. */
export function gerarTudo(raiz: string): Map<string, string> {
  const rs = lerTodos(raiz);
  const saida = new Map<string, string>();
  for (const r of rs) saida.set(`${PASTA_DAS_PAGINAS}/${r.nome}.md`, gerarPagina(r));
  saida.set('README.md', trocarTabela(readFileSync(join(raiz, 'README.md'), 'utf8'), gerarTabelaDoReadme(rs)));
  return saida;
}

/** Caminhos que divergem do commitado (inclui página sobrando). */
export function divergencias(raiz: string, esperado: Map<string, string>): string[] {
  const ruins: string[] = [];
  for (const [caminho, conteudo] of esperado) {
    const abs = join(raiz, caminho);
    if (!existsSync(abs) || readFileSync(abs, 'utf8') !== conteudo) ruins.push(caminho);
  }
  const pasta = join(raiz, PASTA_DAS_PAGINAS);
  if (existsSync(pasta)) {
    for (const f of readdirSync(pasta)) {
      if (!esperado.has(`${PASTA_DAS_PAGINAS}/${f}`)) ruins.push(`${PASTA_DAS_PAGINAS}/${f} (sobra: o YAML não existe mais)`);
    }
  }
  return ruins;
}

function principal(): void {
  const i = process.argv.indexOf('--raiz');
  const raiz = i === -1 ? fileURLToPath(new URL('../..', import.meta.url)) : (process.argv[i + 1] ?? '');
  const e = process.argv.indexOf('--exemplos');
  if (e !== -1) {
    // Para o CI passar o actionlint nos exemplos: um workflow por reutilizável.
    const dir = process.argv[e + 1] ?? '';
    mkdirSync(dir, { recursive: true });
    for (const r of lerTodos(raiz).filter((x) => x.especie === 'workflow')) {
      writeFileSync(join(dir, `${r.nome}.yml`), exemploDeChamada(r) + '\n');
    }
    console.log(`referencia-dos-workflows: exemplos em ${dir}.`);
    return;
  }
  const esperado = gerarTudo(raiz);
  if (process.argv.includes('--check')) {
    const ruins = divergencias(raiz, esperado);
    if (ruins.length > 0) {
      for (const c of ruins) console.error(`::error file=${c}::referência dos workflows desatualizada`);
      console.error('::error::Rode `node scripts/ci/referencia-dos-workflows.ts` e commite o resultado.');
      process.exit(1);
    }
    console.log(`referencia-dos-workflows: ${esperado.size} arquivos em dia.`);
    return;
  }
  for (const [caminho, conteudo] of esperado) {
    mkdirSync(dirname(join(raiz, caminho)), { recursive: true });
    writeFileSync(join(raiz, caminho), conteudo);
  }
  console.log(`referencia-dos-workflows: ${esperado.size} arquivos escritos.`);
}

if (process.argv[1]?.endsWith('referencia-dos-workflows.ts')) {
  principal();
}
