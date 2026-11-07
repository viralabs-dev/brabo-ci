import { describe, expect, it } from 'vitest';
import { comCarimbo } from './tag-release.ts';

describe('comCarimbo', () => {
  const env = { GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: 'viralabs-dev/brabo-api', GITHUB_RUN_ID: '42' };
  it('acrescenta a linha que o helper vinculos lê', () => {
    const m = comCarimbo('v1.0.0-dev.1 — carimbo.', env);
    expect(m).toBe('v1.0.0-dev.1 — carimbo.\n\nCarimbo: https://github.com/viralabs-dev/brabo-api/actions/runs/42');
    expect(/^Carimbo: (\S+)$/m.exec(m)?.[1]).toBe('https://github.com/viralabs-dev/brabo-api/actions/runs/42');
  });
  it('sem o run no ambiente, a mensagem fica como era', () => {
    expect(comCarimbo('msg', {})).toBe('msg');
    expect(comCarimbo('msg', { ...env, GITHUB_RUN_ID: undefined })).toBe('msg');
  });
});
