import { describe, expect, it } from 'vitest';
import {
  ImagemNaoPublicada,
  SemTagParaOHead,
  escolherTags,
  maisNova,
  paraDigest,
  type EntradaTags,
} from './qa-e2e-imagens.ts';

const base: EntradaTags = {
  repo: 'brabo-api',
  headSha: 'abcdef1234567890',
  headRef: 'dev',
  tagsDoHead: ['v1.2.0-dev.4'],
  ultimaDev: { api: 'v1.2.0-dev.4', engine: 'v2.0.0-dev.1', web: 'v3.0.0-dev.2', broker: 'v1.0.0-dev.3', infra: 'v4.0.0-dev.5' },
  ultimaFinal: { api: 'v1.1.0', engine: 'v2.0.0', web: 'v3.0.0', broker: 'v1.0.0', infra: 'v4.0.0' },
};

describe('escolherTags', () => {
  it('promoção do brabo-api usa a -dev do head e a -dev mais nova dos outros', () => {
    const r = escolherTags(base);
    expect(r.tags.api).toBe('v1.2.0-dev.4');
    expect(r.tags.engine).toBe(base.ultimaDev.engine);
    expect(r.composeRef).toBe(base.ultimaDev.infra);
    expect(r.tags.backup).toBe(base.ultimaFinal.infra);
  });

  it('com duas -dev no head, vale a mais nova por semver', () => {
    const r = escolherTags({ ...base, tagsDoHead: ['v1.2.0-dev.9', 'v1.2.0-dev.10', 'v1.1.0'] });
    expect(r.tags.api).toBe('v1.2.0-dev.10');
  });

  it('hotfix do brabo-web usa sha-<12> e a última final dos outros', () => {
    const r = escolherTags({ ...base, repo: 'brabo-web', headRef: 'hotfix/x', tagsDoHead: [] });
    expect(r.tags.web).toBe('sha-abcdef123456');
    expect(r.tags.api).toBe(base.ultimaFinal.api);
    expect(r.composeRef).toBe(base.ultimaFinal.infra);
  });

  it('PR do brabo-infra usa as -dev de todos e o compose do head', () => {
    const r = escolherTags({ ...base, repo: 'brabo-infra', tagsDoHead: [] });
    expect(r.tags.api).toBe(base.ultimaDev.api);
    expect(r.composeRef).toBe(base.headSha);
    expect(r.tags.backup).toBe(base.ultimaFinal.infra);
  });

  it('PR do brabo-qa usa as -dev de todos e a -dev do infra', () => {
    const r = escolherTags({ ...base, repo: 'brabo-qa', tagsDoHead: [] });
    expect(r.tags.web).toBe(base.ultimaDev.web);
    expect(r.composeRef).toBe(base.ultimaDev.infra);
  });

  it('promoção sem tag -dev no head lança SemTagParaOHead', () => {
    expect(() => escolherTags({ ...base, tagsDoHead: [] })).toThrow(SemTagParaOHead);
    expect(() => escolherTags({ ...base, tagsDoHead: ['v1.1.0'] })).toThrow(SemTagParaOHead);
  });
});

describe('maisNova', () => {
  it('ordena por semver, não por texto', () => {
    expect(maisNova(['v1.2.0-dev.9', 'v1.10.0-dev.1', 'v1.2.0-dev.10'])).toBe('v1.10.0-dev.1');
    expect(maisNova(['v1.0.0'])).toBe('v1.0.0');
    expect(maisNova([])).toBeUndefined();
  });
});

describe('paraDigest', () => {
  it('monta imagem@sha256', async () => {
    const d = await paraDigest('brabo-api', 'v1', async () => 'sha256:aa');
    expect(d).toBe('ghcr.io/viralabs-dev/brabo-api@sha256:aa');
  });
  it('sem manifesto lança ImagemNaoPublicada', async () => {
    await expect(paraDigest('brabo-api', 'v1', async () => null)).rejects.toThrow(ImagemNaoPublicada);
  });
});
