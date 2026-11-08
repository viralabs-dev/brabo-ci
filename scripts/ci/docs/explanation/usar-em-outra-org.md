# Usar em outra org (AT-831)

Os reutilizáveis não presumem a `viralabs-dev`: o checkout dos scripts lê o input `ci_repo` (padrão `viralabs-dev/brabo-ci`; só muda num fork, e o `uses:` aponta para o mesmo repo), e o `owner:` do token do App e o escopo npm vêm de `github.repository_owner`. Os scripts leem `GITHUB_REPOSITORY_OWNER`. Sem fork, `pr-police`, `approval-ladder` e `tag-release` já rodam em outra org só com `ci_ref`.

**Específico do Brabo (fica como está):** o portão do QA (`qa-e2e-gatilho`, repo `brabo-qa`, imagens `brabo-*`, nomes de check `E2E do brabo-qa` e `Regressivo do brabo-qa`), o `dependencias-de-merge.ts` (11 repos e a sintaxe da RN-1047), o login do App `viralabs-dev-brabo` no `pr-police` e o autor `brabo-release[bot]`.
