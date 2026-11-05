# Governance

This document resolves a `TODO(humano)` that
[branching-policy.md](docs/explanation/branching-policy.md#migração-para-modo-community)
had left open since ADR 0030: the criterion for who joins each approver list of
the `community` mode of the `approval-ladder` — who joins, who leaves, and on
what basis. Until that criterion exists somewhere, migrating from `solo` to
`community` would be a decision with no written rule behind it.

It is a **proposal**, not a committee that already exists: today the project has
a single maintainer, and most of this document describes what takes effect
**when** that changes, not a structure already in operation.

## Model today: a single maintainer

The project is maintained by [@daneiel](https://github.com/daneiel) alone.
Technical, product and release decisions are theirs — this is what
[branching-policy.md](docs/explanation/branching-policy.md#modo-solo--o-que-vale-hoje)
calls the `solo` mode: one owner approval for a third party's PR, and the owner's
own manual merge stands in for approval on their own PR (the platform does not
let you approve your own PR through the interface).

This is not a provisional model out of carelessness — it is the **honest** model
for a project with one person. The three-role ladder below only makes sense
once there are real people to fill it; until then, activating it would produce
a rule that nobody can meet.

## The three roles of `community` mode

When `APPROVAL_MODE=community`, the approval required per target
(`docs/explanation/branching-policy.md#modo-community--quando-houver-gente`) is:

| target | requires |
|---|---|
| `dev` | 1 approval from **devs** |
| `qa` | 2 approvals from **devs**, distinct people |
| `main` | 1 approval from **po** **+** 1 from **gestão**, distinct people |

The roles are lists of handles in repository variables
(`APROVADORES_DEVS`, `APROVADORES_PO`, `APROVADORES_GESTAO`) — not GitHub
Teams, for the reason already recorded in `branching-policy.md`: this
repository belongs to a user, not to an organization.

### `devs`

Approves code changes on `dev` and `qa`.

- **Entry criterion:** sustained contribution — several merged PRs that show
  real familiarity with the decisions recorded in the ADRs and with the
  conventions of this `CLAUDE.md`/`CONTRIBUTING.md`. It is not a fixed PR count;
  it is the maintainer recognizing that the person already understands the
  product well enough to judge someone else's PR, not just their own.
- **Who decides:** the current maintainer invites — there is no
  self-nomination. While the model is `solo`, it is the same person who decides
  everything; the difference shows up when there is more than one real
  maintainer.
- **Exit criterion:** the person's own request, prolonged inactivity (no
  contribution or review in 6 months), or a violation of the
  [Code of Conduct](CODE_OF_CONDUCT.md) established through the channel it
  describes.

### `po`

Approves what reaches `main` from the **product direction** side — what Brabo
does, for whom, and why.

- **Entry criterion:** being the person who actually answers for those
  decisions outside the code — today nobody besides the maintainer. This role
  only gets a second name when someone really owns that responsibility, not as
  a symbolic recognition.
- **Who decides:** the current maintainer.
- **Exit criterion:** the same as the `devs` list, plus no longer exercising
  the product responsibility that justified the entry.

### `gestão`

Approves what reaches `main` from the **organizational** side — release,
priority between initiatives, and the same characteristic as the `po` role:
today it is an empty list in any realistic short-term scenario, and it only
gets people when the project has a real organizational structure behind it.

- **Entry and exit criteria:** the same as the `po` role, applied to
  organizational responsibility instead of product.

## Distinct people on `main`

`branching-policy.md` already documents why the distinct-people requirement on
`main` is not just counting approvals — it is an assignment problem, solved by
backtracking in `approval-ladder.ts`. The direct governance consequence:
**the same person should not be on both the `po` and `gestão` lists at the same
time** — even if the check accepted it (it does not, by design), it would be
one person deciding both sides of what should be a cross-check.

## When the migration to `community` happens

Prerequisite, beyond the technical ones that `branching-policy.md` already lists
(each role with real people, `qa` with two distinct `devs`): the entry and exit
criteria of this document must have been applied for real at least once — that
is, the first person on each list must have been invited following the
criterion above, not populated just so the check stops failing.

The decision to migrate remains the current maintainer's. This document does not
change who decides that — only the criterion for who joins each role once they
decide it is time.

## Final authority

Even with `community` mode active, [merging into a protected branch stays
manual](CLAUDE.md) and the lock is guaranteed by a test — no role, including
`gestão`, automates that act. The approval ladder decides who CAN approve; who
presses the merge button remains a human decision, always.

## Reviewing this document

Changing a criterion here is itself a decision of the current maintainer — it
needs no approval from anyone this document does not yet describe as able to
approve. `docs/.docmap.yml` asks for a review (`aviso`, not a block) of this
file when `scripts/ci/approval-ladder.ts` or
`docs/explanation/branching-policy.md` change, so the criterion does not age in
silence while the mechanism evolves.
