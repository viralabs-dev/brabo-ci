# brabo-ci

Brabo's PR policy, branch policy, approval ladder, promotion, tag stamping, archiving and Dependabot handling, as **reusable workflows** (`on: workflow_call`), plus the community templates. The logic lives in `scripts/ci/` (TypeScript run by Node through type stripping, tested with vitest).

## How it works

Each reusable workflow does a second checkout of this repository into `.brabo-ci/` and runs `node .brabo-ci/scripts/ci/<script>.ts` from the root of the calling repository. That is why they all have the `ci_ref` input: the **same SHA (or tag)** you put in `uses:`. The default is `v1.0.0`.

The triggers (`on:`) live in the calling repository. `vars` (`APPROVAL_MODE`, `OWNER_HANDLE`, `APROVADORES_*`) are read from the calling repository or organization.

Always pin by SHA: `uses: viralabs-dev/brabo-ci/.github/workflows/pr-police.yml@<sha>  # v1.0.0`.

## Workflows

| Workflow | Inputs | Secrets | What it does |
|---|---|---|---|
| `pr-police.yml` | `ci_ref` | - | PR shape (name, source, target) and the family label |
| `approval-ladder.yml` | `ci_ref` | - | the right approvals per rung (uses the vars above); exempts Dependabot PRs and the bot's regeneration PR (`chore/regenera-gerados`, ADR 0255) on `dev` |
| `backmerge-gate.yml` | `ci_ref` | - | back-merge lock after a hotfix |
| `promotion-check.yml` | `ci_ref` | - | state of the promotion PR (range, rung tag) |
| `promote.yml` | `ci_ref`, `par` (default `dev->main`) | `BOT_TOKEN` (optional) | opens the promotion PR; the merge is human |
| `tag-release.yml` | `ci_ref` | `BOT_TOKEN` (optional; required for hotfix) | stamps the stage tag, locks and unlocks the gate |
| `archive-merged-branch.yml` | `ci_ref` | - | archives a merged branch under `refs/archive/` |
| `dependabot-para-dev.yml` | `ci_ref` | - | closes or redirects a Dependabot security PR to `dev` |
| `claude.yml` | - | `CLAUDE_CODE_OAUTH_TOKEN` | answers `@claude` |
| `claude-code-review.yml` | - | `CLAUDE_CODE_OAUTH_TOKEN` | automatic PR review |

The reusable workflows that write as the bot (`tag-release`, `promote`) accept `APP_ID` and `APP_PRIVATE_KEY` and generate the GitHub App token INSIDE the job itself (the token is masked and does not cross jobs, so the caller cannot pass it as `BOT_TOKEN`). The caller passes:

```yaml
secrets:
  APP_ID: ${{ secrets.BRABO_APP_ID }}
  APP_PRIVATE_KEY: ${{ secrets.BRABO_APP_PRIVATE_KEY }}
```

`BOT_TOKEN` is still accepted as an alternative. It is a PAT or the organization's GitHub App token. The App and secret names have not been registered yet (declared gap): pass the token the organization defines.

## Call example

```yaml
# .github/workflows/politica.yml no repositório que chama
name: politica
on:
  pull_request:
    types: [opened, edited, reopened, synchronize, ready_for_review]
  pull_request_review:
    types: [submitted, edited, dismissed]
permissions:
  contents: read
  pull-requests: write
jobs:
  pr-police:
    uses: viralabs-dev/brabo-ci/.github/workflows/pr-police.yml@<sha>  # v1.0.0
    with:
      ci_ref: <sha>
  escada:
    uses: viralabs-dev/brabo-ci/.github/workflows/approval-ladder.yml@<sha>  # v1.0.0
    with:
      ci_ref: <sha>
```

Promotion and stamping:

```yaml
on:
  workflow_dispatch:
  push:
    branches: [dev, main]
jobs:
  promover:
    if: github.event_name == 'workflow_dispatch'
    uses: viralabs-dev/brabo-ci/.github/workflows/promote.yml@<sha>  # v1.0.0
    with: { ci_ref: <sha>, par: 'dev->main' }
    secrets: { BOT_TOKEN: '${{ secrets.BOT_TOKEN }}' }
  carimbar:
    if: github.event_name == 'push'
    uses: viralabs-dev/brabo-ci/.github/workflows/tag-release.yml@<sha>  # v1.0.0
    with: { ci_ref: <sha> }
    secrets: { BOT_TOKEN: '${{ secrets.BOT_TOKEN }}' }
```

Triggers for the others: `backmerge-gate` and `promotion-check` on `pull_request` (`opened, reopened, synchronize, edited`); `archive-merged-branch` on `schedule` (`0 12 * * 1`) and `workflow_dispatch`; `dependabot-para-dev` on `push` to `dev`, `workflow_dispatch` and `pull_request_target` (`opened, reopened`, base `main`). On a PR, never put `if:` on the job that calls `pr-police`, `approval-ladder`, `backmerge-gate` or `promotion-check` (a required check that gets skipped leaves a stale verdict stuck).

Watch `permissions`: the calling job must grant at least what the reusable workflow declares (for example `contents: write` for `tag-release` and `archive-merged-branch`).

## Development

```
pnpm install
pnpm test          # vitest dos scripts
pnpm typecheck
pnpm actions:pinadas
```

Permanent branches: `dev` and `main`. Every tag comes from a workflow. MIT license.

## Origin

Extracted with history from `daneiel/brabo` on 2026-11-04; `#NNN` in messages became `daneiel/brabo#NNN`.
