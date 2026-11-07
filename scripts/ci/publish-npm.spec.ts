import { describe, expect, it } from 'vitest';
import { distTag, versaoDaTag } from './publish-npm.ts';

describe('publish-npm (RN-1037)', () => {
  it('-dev.N publica com o dist-tag dev', () => {
    expect(distTag(versaoDaTag('v1.3.0-dev.12'))).toBe('dev');
  });
  it('a versão final publica com latest', () => {
    expect(distTag(versaoDaTag('v1.3.0'))).toBe('latest');
  });
  it('tira o v da tag', () => {
    expect(versaoDaTag('v1.3.0-dev.2')).toBe('1.3.0-dev.2');
  });
  it.each(['', 'v1.3', 'v1.3.0-rc.1', 'v1.3.0-dev', 'x1.3.0', 'v1.3.0-dev.1.2'])(
    'reprova a tag %j',
    (tag) => {
      expect(() => versaoDaTag(tag)).toThrow();
    },
  );
});
