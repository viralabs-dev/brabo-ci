/**
 * dependencias-de-merge — a PR declara `Depende-de: viralabs-dev/<repo>#<n>` no corpo e o check
 * "Dependências de merge" (check-run do App) fica amarelo até cada PR citada estar MERGED (AT-787).
 *
 * Modos (argv[2]):
 *   avaliar             avalia a PR do evento e publica o check.     Env: GITHUB_REPOSITORY, PR_NUMERO
 *   avisar-dependentes  a PR foi mergeada: reavalia as abertas que a citam.  Env: idem
 *   varrer              rede de segurança (cron): reavalia toda PR aberta com `Depende-de` na org e as promoções abertas.
 *   linhas              imprime as linhas `Depende-de` da promoção do repo (usado na abertura).  Env: GITHUB_REPOSITORY
 * Promoção (base main, head dev): depende, sem linha no corpo, das promoções abertas das camadas de baixo (AT-788).
 * Env comum: GH_TOKEN (token do App, owner viralabs-dev). Sintaxe apagável apenas (type stripping).
 * Sem `checks: write` no App (403) só avisa: nunca derruba outros jobs.
 */

export const DONO = 'viralabs-dev';
// Os 11 repos do mapa da pasta-mãe (o REPOS do clonar-tudo.sh mora em outro repo; o spec fixa a lista).
export const REPOS = ['brabo', 'brabo-api', 'brabo-engine', 'brabo-web', 'brabo-runner', 'brabo-broker', 'brabo-contracts', 'brabo-ci', 'brabo-infra', 'brabo-qa', 'brabo-workspace'];
/** A ordem da promoção dev→main (AT-788, ADR 0284): cada camada espera as de baixo. A união é `REPOS`. */
export const CAMADAS_DE_PROMOCAO: readonly (readonly string[])[] = [
  ['brabo-ci'],
  ['brabo-contracts', 'brabo-workspace'],
  ['brabo-api', 'brabo-engine', 'brabo-web', 'brabo-runner', 'brabo-broker'],
  ['brabo-infra'],
  ['brabo-qa'],
  ['brabo'],
];
export const NOME_DO_CHECK = 'Dependências de merge';
export const PROFUNDIDADE_MAXIMA = 5;

const LINHA = /^\s*(?:-\s*)?Depende-de:\s*viralabs-dev\/([a-z0-9-]+)#(\d+)\s*$/;
const LINHA_COM_DONO = /^\s*(?:-\s*)?Depende-de:\s*([^\s/#]+)\/([^\s/#]+)#(\d+)\s*$/;
const PARECE_DECLARACAO = /^\s*(?:-\s*)?depende[- ]de\b/i;

export interface Ref {
  repo: string;
  n: number;
}
export interface PrRemota {
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  titulo: string;
  url: string;
  corpo: string;
}
export type Buscar = (ref: Ref) => Promise<PrRemota | null>;
export interface Veredito {
  status: 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure';
  title: string;
  summary: string;
}

/** Repos das camadas anteriores à do `repo` (vazio se o repo não está na lista). */
export function predecessores(repo: string): string[] {
  const i = CAMADAS_DE_PROMOCAO.findIndex((c) => c.includes(repo));
  return i < 0 ? [] : CAMADAS_DE_PROMOCAO.slice(0, i).flat();
}
/** Repos das camadas seguintes à do `repo`. */
export const sucessores = (repo: string): string[] => REPOS.filter((r) => predecessores(r).includes(repo));

/** Presente só quando a PR avaliada é uma promoção (base main, head dev). */
export interface Promocao {
  /** PRs de promoção abertas do repo. */
  abertas: (repo: string) => Promise<Ref[]>;
  /** A `dev` do repo está à frente da `main`? */
  aFrente: (repo: string) => Promise<boolean>;
}

/** As linhas `Depende-de` que a abertura da promoção escreve no corpo (P1 c). */
export async function linhasDePromocao(repo: string, promocao: Promocao): Promise<string[]> {
  const linhas: string[] = [];
  for (const p of predecessores(repo)) for (const r of await promocao.abertas(p)) linhas.push(`Depende-de: ${chave(r)}`);
  return linhas;
}

export const chave = (r: Ref) => `${DONO}/${r.repo}#${r.n}`;

/** Lê as declarações do corpo; comentário HTML (o exemplo do template) não conta. */
export function lerDeclaracoes(corpo: string): { deps: Ref[]; erros: string[] } {
  const deps: Ref[] = [];
  const erros: string[] = [];
  for (const linha of corpo.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/)) {
    const ok = LINHA.exec(linha);
    if (ok) {
      const ref = { repo: ok[1] as string, n: Number(ok[2]) };
      if (!REPOS.includes(ref.repo)) erros.push(`repo fora da lista dos 11 do Brabo: ${linha.trim()}`);
      else if (!deps.some((d) => chave(d) === chave(ref))) deps.push(ref);
      continue;
    }
    const outro = LINHA_COM_DONO.exec(linha);
    if (outro && outro[1] !== DONO) erros.push(`owner diferente de ${DONO}: ${linha.trim()}`);
    else if (PARECE_DECLARACAO.test(linha)) erros.push(`linha malformada, use \`Depende-de: ${DONO}/<repo>#<n>\`: ${linha.trim()}`);
  }
  return { deps, erros };
}

const falha = (title: string, itens: string[]): Veredito => ({ status: 'completed', conclusion: 'failure', title, summary: itens.map((i) => `- ${i}`).join('\n') });
const celula = (t: string) => t.replace(/[|\r\n]+/g, ' ');

/** Segue as dependências ainda abertas até a profundidade máxima; devolve o erro de ciclo/profundidade. */
async function procurarCiclo(eu: Ref, no: Ref, caminho: Ref[], buscar: Buscar): Promise<string | null> {
  const pr = await buscar(no);
  if (!pr || pr.state !== 'OPEN') return null;
  for (const filho of lerDeclaracoes(pr.corpo).deps) {
    const trilha = [...caminho, filho];
    const texto = trilha.map(chave).join(' → ');
    if (caminho.some((c) => chave(c) === chave(filho))) return `ciclo de dependências: ${texto}`;
    if (trilha.length - 1 > PROFUNDIDADE_MAXIMA) return `cadeia de dependências além da profundidade ${PROFUNDIDADE_MAXIMA}: ${texto}`;
    const erro = await procurarCiclo(eu, filho, trilha, buscar);
    if (erro) return erro;
  }
  return null;
}

/** O veredito do check. Nunca `neutral`: para ruleset ele contaria como verde. */
export async function avaliar(eu: Ref, corpo: string, buscar: Buscar, promocao?: Promocao): Promise<Veredito> {
  const { deps, erros } = lerDeclaracoes(corpo);
  if (erros.length > 0) return falha('Declaração inválida', erros);
  // Promoção: soma as promoções abertas das camadas de baixo; sem promoção aberta e com a dev à frente, espera o repo (P2 b).
  const semPromocao: string[] = [];
  if (promocao) {
    for (const p of predecessores(eu.repo)) {
      const abertas = await promocao.abertas(p);
      for (const r of abertas) if (!deps.some((d) => chave(d) === chave(r))) deps.push(r);
      if (abertas.length === 0 && (await promocao.aFrente(p))) semPromocao.push(`promoção de ${DONO}/${p} (a dev está à frente da main)`);
    }
  }
  if (deps.length === 0 && semPromocao.length > 0) return { status: 'in_progress', title: `esperando ${semPromocao.join(', ')}`, summary: semPromocao.map((i) => `- ${i}`).join('\n') };
  if (deps.length === 0) return { status: 'completed', conclusion: 'success', title: 'Sem dependências declaradas', summary: 'Nenhuma linha `Depende-de:` no corpo da PR.' };

  const linhas: string[] = [];
  const faltam: string[] = [];
  const problemas: string[] = [];
  for (const dep of deps) {
    if (chave(dep) === chave(eu)) {
      problemas.push(`a PR cita a si mesma: ${chave(dep)}`);
      continue;
    }
    const pr = await buscar(dep);
    if (!pr) {
      problemas.push(`${chave(dep)} não existe`);
      continue;
    }
    if (pr.state === 'CLOSED') problemas.push(`${chave(dep)} foi fechada sem merge: tire a linha ou aponte a PR que a substituiu`);
    if (pr.state === 'OPEN') {
      faltam.push(chave(dep));
      const ciclo = await procurarCiclo(eu, dep, [eu, dep], buscar);
      if (ciclo) problemas.push(ciclo);
    }
    linhas.push(`| ${chave(dep)} | ${celula(pr.titulo)} | ${pr.state} | ${pr.url} |`);
  }
  const tabela = ['| PR | Título | Estado | Link |', '|---|---|---|---|', ...linhas].join('\n');
  if (problemas.length > 0) return { ...falha('Dependência inválida', problemas), summary: `${problemas.map((p) => `- ${p}`).join('\n')}\n\n${tabela}` };
  faltam.push(...semPromocao);
  if (faltam.length > 0) return { status: 'in_progress', title: `esperando ${faltam.join(', ')}`, summary: tabela };
  return { status: 'completed', conclusion: 'success', title: 'Dependências mergeadas', summary: tabela };
}

// ---- GitHub (só no main; o spec cobre o que está acima) ----

class ErroHttp extends Error {
  status: number;
  constructor(status: number, msg: string) {
    super(msg);
    this.status = status;
  }
}

async function gh(caminho: string, init: RequestInit = {}): Promise<any> {
  const r = await fetch(`https://api.github.com/${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw new ErroHttp(r.status, `GitHub ${init.method ?? 'GET'} ${caminho}: ${r.status} ${await r.text()}`);
  return r.json();
}

const buscarNoGitHub: Buscar = async ({ repo, n }) => {
  try {
    const p = await gh(`repos/${DONO}/${repo}/pulls/${n}`);
    return { state: p.merged ? 'MERGED' : p.state === 'open' ? 'OPEN' : 'CLOSED', titulo: p.title, url: p.html_url, corpo: p.body ?? '' };
  } catch (e) {
    if (e instanceof ErroHttp && e.status === 404) return null;
    throw e;
  }
};

const promocaoNoGitHub: Promocao = {
  abertas: async (repo) => {
    const l = await gh(`repos/${DONO}/${repo}/pulls?state=open&base=main&head=${DONO}:dev`);
    return (l as { number: number }[]).map((p) => ({ repo, n: p.number }));
  },
  aFrente: async (repo) => (await gh(`repos/${DONO}/${repo}/compare/main...dev`)).ahead_by > 0,
};

/** Avalia a PR e publica o check no head; não republica o que já está igual (o cron não faz barulho). */
export async function atualizarCheck(ref: Ref, buscar: Buscar = buscarNoGitHub): Promise<void> {
  const pr = await gh(`repos/${DONO}/${ref.repo}/pulls/${ref.n}`);
  if (pr.state !== 'open') return;
  const ehPromocao = pr.base.ref === 'main' && pr.head.ref === 'dev' && pr.head.repo?.full_name === `${DONO}/${ref.repo}`;
  const v = await avaliar(ref, pr.body ?? '', buscar, ehPromocao ? promocaoNoGitHub : undefined);
  const sha = pr.head.sha as string;
  try {
    const atuais = await gh(`repos/${DONO}/${ref.repo}/commits/${sha}/check-runs?check_name=${encodeURIComponent(NOME_DO_CHECK)}&per_page=1`);
    const ultimo = atuais.check_runs?.[0];
    if (ultimo && ultimo.status === v.status && (ultimo.conclusion ?? undefined) === v.conclusion && ultimo.output?.title === v.title && ultimo.output?.summary === v.summary) return;
    await gh(`repos/${DONO}/${ref.repo}/check-runs`, {
      method: 'POST',
      body: JSON.stringify({ name: NOME_DO_CHECK, head_sha: sha, status: v.status, ...(v.conclusion ? { conclusion: v.conclusion } : {}), output: { title: v.title, summary: v.summary } }),
    });
    console.log(`${chave(ref)}: ${v.status}${v.conclusion ? `/${v.conclusion}` : ''} — ${v.title}`);
  } catch (e) {
    if (!(e instanceof ErroHttp) || e.status !== 403) throw e;
    console.log(`::warning::${chave(ref)}: o App não tem checks:write (403); o check "${NOME_DO_CHECK}" não foi publicado. Falta o gesto do dono no App.`);
  }
}

async function procurar(q: string): Promise<{ ref: Ref; corpo: string }[]> {
  const achados: { ref: Ref; corpo: string }[] = [];
  for (let pagina = 1; pagina <= 10; pagina++) {
    const r = await gh(`search/issues?q=${encodeURIComponent(q)}&per_page=100&page=${pagina}`);
    for (const i of r.items as { number: number; body: string | null; repository_url: string }[]) {
      achados.push({ ref: { repo: i.repository_url.split('/').pop() as string, n: i.number }, corpo: i.body ?? '' });
    }
    if (r.items.length < 100) break;
  }
  return achados.filter((a) => REPOS.includes(a.ref.repo));
}

async function principal(modo: string): Promise<void> {
  const env = (n: string) => process.env[n] ?? '';
  const eu: Ref = { repo: env('GITHUB_REPOSITORY').split('/')[1] ?? '', n: Number(env('PR_NUMERO')) };
  if (modo === 'avaliar') return atualizarCheck(eu);
  if (modo === 'linhas') {
    for (const l of await linhasDePromocao(eu.repo, promocaoNoGitHub)) console.log(l);
    return;
  }
  // As promoções abertas dependem, sem linha no corpo, das de baixo (AT-788): entram na busca.
  const promocoes = async (quais: (repo: string) => boolean) => (await procurar(`org:${DONO} is:pr is:open base:main head:dev`)).filter((a) => quais(a.ref.repo));
  const quais =
    modo === 'avisar-dependentes'
      ? [
          ...(await procurar(`org:${DONO} is:pr is:open in:body "${chave(eu)}"`)).filter((a) => lerDeclaracoes(a.corpo).deps.some((d) => chave(d) === chave(eu))),
          ...(await promocoes((r) => sucessores(eu.repo).includes(r))),
        ]
      : modo === 'varrer'
        ? [...(await procurar(`org:${DONO} is:pr is:open in:body "Depende-de:"`)), ...(await promocoes(() => true))]
        : null;
  if (!quais) throw new Error(`modo desconhecido: ${modo}`);
  const unicas = quais.filter((a, i) => quais.findIndex((b) => chave(b.ref) === chave(a.ref)) === i);
  console.log(`${unicas.length} PR(s) a reavaliar`);
  for (const { ref } of unicas) await atualizarCheck(ref);
}

const { pathToFileURL } = await import('node:url');
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await principal(process.argv[2] ?? '');
}
