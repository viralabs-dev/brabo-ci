/**
 * qa-e2e-imagens — escolhe as tags das imagens que o E2E do brabo-qa vai exercitar
 * e resolve cada uma para `imagem@sha256` (AT-765).
 *
 * Sintaxe apagável apenas (o Node executa este `.ts` por type stripping).
 */

export type Servico = 'api' | 'engine' | 'web' | 'broker' | 'backup';
export type RepoGatilho = 'brabo-api' | 'brabo-engine' | 'brabo-web' | 'brabo-broker' | 'brabo-infra' | 'brabo-qa';
type Chave = 'api' | 'engine' | 'web' | 'broker' | 'infra';

export interface EntradaTags {
  repo: RepoGatilho;
  headSha: string;
  headRef: string;
  /** Base da PR; `dev` (AT-769) usa a imagem `sha-<12>` do head. Ausente = `main`. */
  baseRef?: 'dev' | 'main';
  /** Tags `v*` que apontam para o head da PR. */
  tagsDoHead: string[];
  ultimaDev: Record<Chave, string>;
  ultimaFinal: Record<Chave, string>;
}

export interface EscolhaDeTags {
  tags: Record<Servico, string>;
  /** Ref do brabo-infra de onde vem o compose. */
  composeRef: string;
}

export class SemTagParaOHead extends Error {}
export class ImagemNaoPublicada extends Error {}
export class RespostaDoGhcrSemDigest extends Error {}

/** URL do `rel="next"` de um header `Link`, ou null na última página. */
export function proximaPagina(link: string | null): string | null {
  return /<([^>]+)>;\s*rel="next"/.exec(link ?? '')?.[1] ?? null;
}

/** Junta as páginas seguindo o `Link` até o fim. */
export async function paginar<T>(
  url: string,
  buscar: (url: string) => Promise<{ itens: T[]; link: string | null }>,
): Promise<T[]> {
  const todos: T[] = [];
  for (let u: string | null = url; u; ) {
    const { itens, link } = await buscar(u);
    todos.push(...itens);
    u = proximaPagina(link);
  }
  return todos;
}

const SEMVER = /^v(\d+)\.(\d+)\.(\d+)(?:-dev\.(\d+))?$/;

/** A tag mais nova por semver (`-dev.N` vale menos que a final do mesmo X.Y.Z). */
export function maisNova(tags: string[]): string | undefined {
  const chave = (t: string) => {
    const m = SEMVER.exec(t);
    return m ? [+m[1]!, +m[2]!, +m[3]!, m[4] === undefined ? Infinity : +m[4]] : null;
  };
  const validas = tags.filter((t) => chave(t));
  return validas.sort((a, b) => {
    const ka = chave(a)!;
    const kb = chave(b)!;
    for (let i = 0; i < 4; i++) if (ka[i] !== kb[i]) return ka[i]! < kb[i]! ? 1 : -1;
    return 0;
  })[0];
}

export function escolherTags(e: EntradaTags): EscolhaDeTags {
  const dev = e.baseRef === 'dev';
  const hotfix = !dev && e.headRef.startsWith('hotfix/');
  const ehQa = e.repo === 'brabo-qa';
  const base = hotfix && !ehQa ? e.ultimaFinal : e.ultimaDev;
  const tags = { ...base, backup: e.ultimaFinal.infra } as Record<Chave, string> & { backup: string };
  let composeRef = base.infra;

  const dono = e.repo.replace('brabo-', '') as Chave;
  if (e.repo === 'brabo-infra') {
    composeRef = e.headSha;
  } else if (!ehQa) {
    if (hotfix || dev) {
      tags[dono] = `sha-${e.headSha.slice(0, 12)}`;
    } else {
      const devDoHead = maisNova(e.tagsDoHead.filter((t) => t.includes('-dev.')));
      // Sem a -dev do head não há o que testar: usar a mais nova de outro commit testaria outra coisa.
      if (!devDoHead) throw new SemTagParaOHead(`nenhuma tag -dev aponta para o head ${e.headSha.slice(0, 12)} de ${e.repo}; o carimbo ainda não rodou`);
      tags[dono] = devDoHead;
    }
  }
  const { infra: _infra, ...servicos } = tags;
  return { tags: servicos as Record<Servico, string>, composeRef };
}

/** Payload do `e2e-pr`: imagens por TAG; o brabo-qa espera a publicação e resolve tag->digest. */
export function montarPayload(
  escolha: EscolhaDeTags,
  ctx: {
    repo: string;
    pr: number;
    headSha: string;
    checkRunId: number;
    /** Run de origem (AT-773): vira `origem` no payload; ausente = payload como antes. */
    origem?: { ator: string; runId: string; runAttempt: string; runUrl: string };
  },
  /** Modo dev (AT-769): `{modo: 'funcionalidades', funcionalidades}` segue no payload. */
  extra: object = {},
) {
  const imagens = Object.fromEntries(
    Object.entries(escolha.tags).map(([s, t]) => [s, `ghcr.io/viralabs-dev/brabo-${s}:${t}`]),
  ) as Record<Servico, string>;
  const o = ctx.origem;
  // `correlacao` entra no `run-name` do e2e-pr (`c=<run_id>-<attempt>`) para o gatilho achar o run disparado.
  const origem = o && {
    repo: ctx.repo,
    pr: ctx.pr,
    sha: ctx.headSha,
    sha_curto: ctx.headSha.slice(0, 7),
    ator: o.ator,
    run_id: o.runId,
    run_attempt: o.runAttempt,
    run_url: o.runUrl,
    correlacao: `${o.runId}-${o.runAttempt}`,
  };
  return { repo: ctx.repo, pr: ctx.pr, head_sha: ctx.headSha, check_run_id: ctx.checkRunId, compose_ref: escolha.composeRef, imagens, ...(origem ? { origem } : {}), ...extra };
}

export async function paraDigest(
  imagem: string,
  tag: string,
  consultar: (imagem: string, tag: string) => Promise<string | null>,
): Promise<string> {
  const digest = await consultar(imagem, tag);
  if (!digest) throw new ImagemNaoPublicada(`ghcr.io/viralabs-dev/${imagem}:${tag} não está publicada`);
  return `ghcr.io/viralabs-dev/${imagem}@${digest}`;
}

const ACCEPT = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.v2+json',
].join(', ');

export async function consultarGhcr(imagem: string, tag: string): Promise<string | null> {
  const t = await fetch(`https://ghcr.io/token?scope=repository:viralabs-dev/${imagem}:pull`);
  if (!t.ok) throw new Error(`token anônimo do ghcr falhou: ${t.status}`);
  const { token } = (await t.json()) as { token: string };
  const r = await fetch(`https://ghcr.io/v2/viralabs-dev/${imagem}/manifests/${tag}`, {
    method: 'HEAD',
    headers: { Authorization: `Bearer ${token}`, Accept: ACCEPT },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`ghcr ${imagem}:${tag} respondeu ${r.status}`);
  const digest = r.headers.get('docker-content-digest');
  if (!digest) throw new RespostaDoGhcrSemDigest(`ghcr respondeu ${imagem}:${tag} sem docker-content-digest`);
  return digest;
}
