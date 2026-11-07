import { describe, expect, it } from 'vitest';
import { buscaTagsDoHead } from './qa-e2e-busca-tags.ts';

describe('buscaTagsDoHead (AT-789)', () => {
  it('portão da main no repo da PR busca as tags do head', () => {
    expect(buscaTagsDoHead({ repo: 'brabo-broker', repoDaPr: 'brabo-broker', baseDev: false })).toBe(true);
  });
  it('base dev não busca (a imagem é a sha-<12>)', () => {
    expect(buscaTagsDoHead({ repo: 'brabo-broker', repoDaPr: 'brabo-broker', baseDev: true })).toBe(false);
  });
  it('outro repo não busca', () => {
    expect(buscaTagsDoHead({ repo: 'brabo-api', repoDaPr: 'brabo-broker', baseDev: false })).toBe(false);
  });
});
