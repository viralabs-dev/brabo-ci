import { describe, expect, it } from 'vitest';
import { AssinaturaAusente, ImagemAusente, esperarImagemAssinada, repetirAte, tetoDoEnv, type Relogio } from './qa-e2e-espera.ts';

/** Relógio falso: `dormir` só avança o tempo. */
function falso(): Relogio & { t: number } {
  const r = { t: 0, agora: () => r.t, dormir: async (ms: number) => void (r.t += ms) };
  return r;
}
const D = 'sha256:' + 'a'.repeat(64);
const base = { imagem: 'brabo-web', tag: 'sha-abc', intervaloMs: 10_000 };

describe('esperarImagemAssinada', () => {
  it('imagem e assinatura aparecem a tempo', async () => {
    const r = falso();
    const ref = await esperarImagemAssinada({ ...base, relogio: r, limite: 600_000, digestDe: async () => (r.t >= 20_000 ? D : null), assinada: async () => r.t >= 40_000 });
    expect(ref).toBe(`ghcr.io/viralabs-dev/brabo-web@${D}`);
    expect(r.t).toBe(40_000);
  });

  it('loga o início e cada mudança de estado, sem linha por volta', async () => {
    const r = falso();
    const linhas: string[] = [];
    await esperarImagemAssinada({ ...base, relogio: r, limite: 600_000, log: (m) => linhas.push(m), digestDe: async () => (r.t >= 20_000 ? D : null), assinada: async () => r.t >= 40_000 });
    expect(linhas).toEqual([
      'esperando imagem ghcr.io/viralabs-dev/brabo-web:sha-abc',
      'imagem existe após 20 s; esperando assinatura',
      'imagem assinada após 40 s',
    ]);
  });

  it('a imagem nunca aparece: ImagemAusente, dentro do teto', async () => {
    const r = falso();
    await expect(esperarImagemAssinada({ ...base, relogio: r, limite: 60_000, digestDe: async () => null, assinada: async () => true })).rejects.toThrow(ImagemAusente);
    expect(r.t).toBeLessThanOrEqual(60_000);
  });

  it('a imagem aparece sem assinatura: AssinaturaAusente com a mensagem da assinatura', async () => {
    const r = falso();
    const p = esperarImagemAssinada({ ...base, relogio: r, limite: 60_000, digestDe: async () => D, assinada: async () => false });
    await expect(p).rejects.toThrow(AssinaturaAusente);
    await expect(p).rejects.toThrow(/assinatura/);
  });

  it('teto zero tenta uma vez só', async () => {
    let n = 0;
    await expect(esperarImagemAssinada({ ...base, relogio: falso(), limite: 0, digestDe: async () => (n++, null), assinada: async () => true })).rejects.toThrow(ImagemAusente);
    expect(n).toBe(1);
  });
});

describe('repetirAte', () => {
  it('repete o erro transitório até dar certo', async () => {
    const r = falso();
    let n = 0;
    const v = await repetirAte(async () => { if (++n < 3) throw new Error('x'); return 'ok'; }, () => true, 600_000, r, 10_000);
    expect(v).toBe('ok');
    expect(r.t).toBe(20_000);
  });
  it('estourado o teto o último erro sobe', async () => {
    const r = falso();
    await expect(repetirAte(async () => { throw new Error('sem tag'); }, () => true, 30_000, r, 10_000)).rejects.toThrow('sem tag');
    expect(r.t).toBeLessThanOrEqual(30_000);
  });
  it('erro não transitório sobe na hora', async () => {
    const r = falso();
    await expect(repetirAte(async () => { throw new Error('rede'); }, () => false, 600_000, r)).rejects.toThrow('rede');
    expect(r.t).toBe(0);
  });
});

describe('tetoDoEnv', () => {
  it('padrão de 10 min, minutos do env, inválido cai no padrão', () => {
    expect(tetoDoEnv(undefined)).toBe(600_000);
    expect(tetoDoEnv('3')).toBe(180_000);
    expect(tetoDoEnv('0')).toBe(0);
    expect(tetoDoEnv('abc')).toBe(600_000);
    expect(tetoDoEnv('-1')).toBe(600_000);
  });
});
