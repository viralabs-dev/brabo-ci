import { defineConfig } from 'vitest/config';

// Os scripts de CI são lógica pura — sem banco, sem rede, sem git. Não há
// globalSetup nem serialização de arquivos como na api: podem rodar em
// paralelo à vontade.
export default defineConfig({
  test: {
    include: ['scripts/**/*.spec.ts'],
    coverage: { provider: 'v8', include: ['scripts/ci/**/*.ts'], exclude: ['**/*.spec.ts', '**/*.d.ts', '**/__fixtures__/**'],
      // Piso no valor medido, arredondado para baixo; sobe à mão quando a cobertura sobe.
      thresholds: { statements: 54, branches: 54, functions: 65, lines: 53 },
    },
  },
});
