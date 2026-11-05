# Description

<!-- What changes and why. If there is an alignment issue, it carries the
context — a summary is enough here. -->

Closes #

## Type of change

- [ ] Bug fix
- [ ] Feature
- [ ] Documentation
- [ ] Infrastructure / CI
- [ ] Refactor with no behavior change
- [ ] **Breaking change** — breaks existing behavior

## How to test

<!-- Steps for the reviewer to reproduce. A specific test command, if any:
     pnpm --filter api test -- rate-limit -->

## Screenshots

<!-- Only if you touched the UI. Before and after helps more than only after. -->

## Definition of Done

- [ ] Tests passing — happy path **and** at least one failure case
- [ ] Lint clean
- [ ] **I updated the affected documentation** (see [`docs/.docmap.yml`](../docs/.docmap.yml)) — the doc diff is in this PR
- [ ] `CHANGELOG.md` touched, if observable behavior changed
- [ ] `pnpm docs:build` with no broken link
- [ ] New ADR, if the change is structural (no accepted ADR was edited)
- [ ] No secret in the diff

## License

- [ ] I agree to license this contribution under the project's [MIT](../LICENSE)

<!-- The PR targets `dev`, never `main`. Merging into a protected branch is always manual. -->
