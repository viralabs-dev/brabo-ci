/**
 * pins-do-brabo-ci — confere, no repo que CHAMA, cada
 * `uses: viralabs-dev/brabo-ci/...@<sha>  # <comentário>` (AT-817, ADR 0280).
 *
 * Exige três coisas:
 *  1. o comentário tem forma de versão: `vX.Y.Z` ou `vX.Y.Z-dev.N` (é o que o
 *     Dependabot lê; `# dev` ou `# feature/x` congela o pin sem aviso);
 *  2. o SHA é o da tag citada (comentário mentiroso é pior que nenhum);
 *  3. pela branch alvo: na `main` só versão final; nas demais (`dev`) final ou `-dev.N`.
 *
 * O próprio brabo-ci é isento: ele roda o código dele de qualquer jeito e a final só nasce no merge da promoção (AT-788, adendo ao ADR 0280).
 *
 * Sintaxe apagável apenas (o Node executa este `.ts` por type stripping).
 */

import { fileURLToPath } from 'node:url';
import { lerWorkflows, type Workflow } from './actions-pinadas.ts';

export interface ViolacaoPin {
  arquivo: string;
  linha: number;
  mensagem: string;
}

const PIN = /^\s*(?:-\s+)?uses:\s*viralabs-dev\/brabo-ci\/\S+@([0-9a-f]{40})\s*(?:#\s*(\S.*?))?\s*$/;
const VERSAO = /^v\d+\.\d+\.\d+(-dev\.\d+)?$/;

/**
 * @param tags - resolve a tag para o SHA do commit (`undefined` se não existe)
 */
export async function verificarPinsDoCi(
  workflows: readonly Workflow[],
  branchAlvo: string,
  tags: (tag: string) => Promise<string | undefined>,
  repoChamador = '',
): Promise<ViolacaoPin[]> {
  const violacoes: ViolacaoPin[] = [];
  if (repoChamador === 'viralabs-dev/brabo-ci') return violacoes;
  for (const { nome, conteudo } of workflows) {
    const linhas = conteudo.split('\n');
    for (const [i, linha] of linhas.entries()) {
      if (/^\s*#/.test(linha)) continue;
      const achado = PIN.exec(linha);
      if (achado === null) continue;
      const sha = achado[1] ?? '';
      const versao = achado[2]?.split(/\s/)[0] ?? '';
      const erro = async (): Promise<string | undefined> => {
        const m = VERSAO.exec(versao);
        if (m === null) return `o comentário \`${achado[2] ?? ''}\` não tem forma de versão (\`vX.Y.Z\` ou \`vX.Y.Z-dev.N\`)`;
        if (m[1] !== undefined && branchAlvo === 'main') return `\`${versao}\` é pré-release e a branch alvo é a main: pine uma release final`;
        const doTag = await tags(versao);
        if (doTag === undefined) return `a tag \`${versao}\` não existe no brabo-ci`;
        if (doTag !== sha) return `o SHA não é o da tag \`${versao}\` (${doTag.slice(0, 7)})`;
        return undefined;
      };
      const mensagem = await erro();
      if (mensagem !== undefined) violacoes.push({ arquivo: nome, linha: i + 1, mensagem });
    }
  }
  return violacoes;
}

/** Tag -> SHA do commit pela API (segue tag anotada). Cada tag é buscada uma vez. */
export function resolverTagPelaApi(token: string, buscar: typeof fetch = fetch): (tag: string) => Promise<string | undefined> {
  const cache = new Map<string, Promise<string | undefined>>();
  const get = async (url: string): Promise<{ object: { type: string; sha: string; url: string } } | undefined> => {
    const r = await buscar(url, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' } });
    if (r.status === 404) return undefined;
    if (!r.ok) throw new Error(`GitHub API ${r.status} em ${url}`);
    return (await r.json()) as { object: { type: string; sha: string; url: string } };
  };
  return (tag) => {
    let p = cache.get(tag);
    if (p === undefined) {
      p = (async () => {
        let ref = await get(`https://api.github.com/repos/viralabs-dev/brabo-ci/git/ref/tags/${tag}`);
        if (ref?.object.type === 'tag') ref = await get(ref.object.url); // tag anotada: o objeto aponta o commit
        return ref?.object.sha;
      })();
      cache.set(tag, p);
    }
    return p;
  };
}

async function principal(): Promise<void> {
  const arg = (nome: string): string | undefined => {
    const i = process.argv.indexOf(nome);
    return i === -1 ? undefined : process.argv[i + 1];
  };
  const raiz = arg('--raiz') ?? '.';
  const branch = arg('--branch') ?? '';
  const token = process.env['GITHUB_TOKEN'] ?? '';
  if (branch === '' || token === '') {
    console.error('::error::pins-do-brabo-ci: --branch e GITHUB_TOKEN são obrigatórios.');
    process.exit(2);
  }
  const violacoes = await verificarPinsDoCi(lerWorkflows(raiz), branch, resolverTagPelaApi(token), process.env['GITHUB_REPOSITORY']);
  for (const v of violacoes) console.error(`::error file=${v.arquivo},line=${v.linha}::${v.mensagem} (branch alvo: ${branch}; ADR 0280)`);
  if (violacoes.length > 0) process.exit(1);
  console.log(`pins-do-brabo-ci: pins do brabo-ci conferidos para a branch ${branch}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await principal();
}
