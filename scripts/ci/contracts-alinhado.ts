/**
 * contracts-alinhado — num consumidor do brabo-contracts, a versão é UMA só
 * (AT-770, RN-1038): o alias do pnpm no `package.json`, as entradas do
 * `pnpm-lock.yaml` e a constante dos scripts de download têm de coincidir.
 * Diverge → reprova. Diferir da `contracts.tag` do `componentes.json` na `dev`
 * do brabo → só AVISA (repo público, lido por raw; o check não é obrigatório).
 *
 * Sintaxe apagável apenas (o Node executa este `.ts` por type stripping).
 */

import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Cada arquivo de constante e como a versão aparece nele. */
export const CONSTANTES: ReadonlyArray<{ arquivo: string; padrao: RegExp }> = [
  { arquivo: 'scripts/baixar-contratos.sh', padrao: /\btag="\$\{1:-(v[^}"]+)\}"/ },
  { arquivo: 'scripts/baixar-areas.mjs', padrao: /\bconst TAG = '(v[^']+)'/ },
  { arquivo: '.github/actions/irmaos/action.yml', padrao: /brabo-contracts, ref: (v[^,\s}]+)/ },
];

const ALIAS = /^npm:@viralabs-dev\/brabo-[a-z-]+@(.+)$/;
const NO_LOCK = /@viralabs-dev\/brabo-[a-z-]+@(\d[^'"\s:()]*)/g;

export interface Fonte {
  onde: string;
  versao: string;
}

/** Versões dos aliases `npm:@viralabs-dev/brabo-*@X` em qualquer bloco de dependências. */
export function doPackageJson(texto: string): Fonte[] {
  const pkg = JSON.parse(texto) as Record<string, Record<string, string> | undefined>;
  const achados: Fonte[] = [];
  for (const bloco of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [nome, spec] of Object.entries(pkg[bloco] ?? {})) {
      const m = ALIAS.exec(spec);
      if (m) achados.push({ onde: `package.json:${nome}`, versao: m[1]! });
    }
  }
  return achados;
}

export function doLock(texto: string): Fonte[] {
  return [...texto.matchAll(NO_LOCK)].map((m) => ({ onde: 'pnpm-lock.yaml', versao: m[1]! }));
}

export function daConstante(arquivo: string, texto: string): Fonte[] {
  const def = CONSTANTES.find((c) => c.arquivo === arquivo);
  const m = def?.padrao.exec(texto);
  return m ? [{ onde: arquivo, versao: m[1]!.replace(/^v/, '') }] : [];
}

/** Mensagens de divergência entre as fontes (vazio = alinhado). */
export function divergencias(fontes: readonly Fonte[]): string[] {
  const versoes = new Set(fontes.map((f) => f.versao));
  if (versoes.size <= 1) return [];
  return [
    `versões diferentes do brabo-contracts: ${fontes.map((f) => `${f.onde}=${f.versao}`).join(', ')}`,
  ];
}

/** Aviso (nunca falha) se a versão do repo difere da do `componentes.json`. */
export function avisoDeComponentes(versao: string, componentesJson: string): string | null {
  const tag = (JSON.parse(componentesJson) as { contracts?: { tag?: string } }).contracts?.tag;
  if (!tag) return null;
  return tag.replace(/^v/, '') === versao
    ? null
    : `o repo usa o brabo-contracts ${versao}; componentes.json na dev do brabo diz ${tag.replace(/^v/, '')}`;
}

const COMPONENTES = 'https://raw.githubusercontent.com/viralabs-dev/brabo/dev/componentes.json';

async function principal(): Promise<void> {
  const ler = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
  const fontes: Fonte[] = [];
  const pkg = ler('package.json');
  if (pkg) fontes.push(...doPackageJson(pkg));
  const lock = ler('pnpm-lock.yaml');
  if (lock && fontes.length > 0) fontes.push(...doLock(lock));
  for (const { arquivo } of CONSTANTES) {
    const t = ler(arquivo);
    if (t) fontes.push(...daConstante(arquivo, t));
  }
  if (fontes.length === 0) {
    console.log('::notice::este repo não consome o brabo-contracts');
    return;
  }
  const erros = divergencias(fontes);
  for (const e of erros) console.log(`::error title=contracts-alinhado::${e}`);
  if (erros.length > 0) process.exit(1);

  const versao = fontes[0]!.versao;
  console.log(`brabo-contracts ${versao} em ${fontes.length} lugar(es)`);
  try {
    const r = await fetch(COMPONENTES);
    const aviso = r.ok ? avisoDeComponentes(versao, await r.text()) : null;
    if (aviso) console.log(`::warning title=contracts-alinhado::${aviso}`);
  } catch {
    console.log('::notice::componentes.json indisponível; comparação ignorada');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await principal();
}
