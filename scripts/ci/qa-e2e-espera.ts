/**
 * qa-e2e-espera — o gatilho espera o carimbo e a assinatura antes de dar vermelho (AT-790, RN-1066).
 * O merge na dev move o head da promoção e o carimbo (tag -dev, imagem) e a assinatura da imagem `sha-` ainda
 * estão rodando quando o gatilho dispara. Lógica pura (relógio injetável); cosign e ghcr entram por parâmetro.
 *
 * Sintaxe apagável apenas (o Node executa este `.ts` por type stripping).
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DONO } from './dono.ts';

export class ImagemAusente extends Error {}
export class AssinaturaAusente extends Error {}

export interface Relogio {
  agora(): number;
  dormir(ms: number): Promise<void>;
}

export const relogioReal: Relogio = { agora: Date.now, dormir: (ms) => new Promise((r) => setTimeout(r, ms)) };

// Teto de 10 min: o carimbo (build multi-arquitetura + assinatura) leva de 3 a 8 min; a assinatura da `sha-` atrasou
// 8 a 22 s em 07/11. Mais que isso já é falha de verdade, e o job do gatilho tem folga de 15 min.
export const TETO_PADRAO_MS = 600_000;
export const INTERVALO_PADRAO_MS = 15_000;

/** Teto em minutos vindo do env (`QA_ESPERA_MINUTOS`); inválido ou ausente cai no padrão. */
export function tetoDoEnv(valor: string | undefined): number {
  const min = Number(valor);
  return valor && Number.isFinite(min) && min >= 0 ? min * 60_000 : TETO_PADRAO_MS;
}

/** Repete `tentar` enquanto `transitorio(erro)` e o `limite` (epoch ms) não passou; o último erro sobe. */
export async function repetirAte<T>(
  tentar: () => Promise<T>,
  transitorio: (e: unknown) => boolean,
  limite: number,
  relogio: Relogio = relogioReal,
  intervaloMs = INTERVALO_PADRAO_MS,
): Promise<T> {
  for (;;) {
    try {
      return await tentar();
    } catch (e) {
      if (!transitorio(e) || relogio.agora() + intervaloMs > limite) throw e;
      await relogio.dormir(intervaloMs);
    }
  }
}

/** Espera a imagem existir E estar assinada; devolve `repo@sha256:...`. Estourado o teto, diz o que faltou. */
export async function esperarImagemAssinada(a: {
  imagem: string;
  tag: string;
  digestDe: (imagem: string, tag: string) => Promise<string | null>;
  assinada: (ref: string) => Promise<boolean>;
  limite: number;
  relogio?: Relogio;
  intervaloMs?: number;
  /** Uma linha no início e em cada mudança de estado, nunca uma por volta. */
  log?: (m: string) => void;
}): Promise<string> {
  const relogio = a.relogio ?? relogioReal;
  const intervalo = a.intervaloMs ?? INTERVALO_PADRAO_MS;
  const nome = `ghcr.io/${DONO}/${a.imagem}:${a.tag}`;
  let existiu = false;
  const log = a.log ?? (() => {});
  const t0 = relogio.agora();
  log(`esperando imagem ${nome}`);
  for (;;) {
    const digest = await a.digestDe(a.imagem, a.tag);
    if (digest) {
      if (!existiu) log(`imagem existe após ${Math.round((relogio.agora() - t0) / 1000)} s; esperando assinatura`);
      existiu = true;
      const ref = `ghcr.io/${DONO}/${a.imagem}@${digest}`;
      if (await a.assinada(ref)) {
        log(`imagem assinada após ${Math.round((relogio.agora() - t0) / 1000)} s`);
        return ref;
      }
    }
    if (relogio.agora() + intervalo > a.limite) break;
    await relogio.dormir(intervalo);
  }
  if (existiu) throw new AssinaturaAusente(`${nome} existe, mas a assinatura (cosign) não apareceu dentro do teto de espera`);
  throw new ImagemAusente(`${nome} não foi publicada dentro do teto de espera`);
}

const execFileP = promisify(execFile);

/** Mesmo `cosign verify` e mesma identidade do e2e-pr do brabo-qa. Sem assinatura = false; cosign ausente sobe. */
export async function cosignAssinada(ref: string): Promise<boolean> {
  try {
    await execFileP('cosign', [
      'verify', ref,
      '--certificate-identity-regexp', `^https://github.com/${DONO}/brabo-(api|engine|web|broker|infra)/\\.github/workflows/(release|ci)\\.yml@`,
      '--certificate-oidc-issuer', 'https://token.actions.githubusercontent.com',
    ]);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') throw e;
    return false;
  }
}
