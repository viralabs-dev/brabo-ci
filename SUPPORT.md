# Where to get help

Each kind of topic has its own path. Using the right one gets you an answer faster.

| you have | go to |
|---|---|
| **a usage question** — "how do I do X?", "is this expected?" | [issue with the question template](https://github.com/daneiel/brabo/issues/new/choose) |
| **a reproducible bug** — clear steps, wrong behavior | [bug issue](https://github.com/daneiel/brabo/issues/new/choose) |
| **an idea or feature request** | [feature issue](https://github.com/daneiel/brabo/issues/new/choose) |
| **an error or gap in the documentation** | [documentation issue](https://github.com/daneiel/brabo/issues/new/choose) |
| **a security flaw** | [SECURITY.md](SECURITY.md) — **never** a public issue |
| **you want to contribute code** | [CONTRIBUTING.md](CONTRIBUTING.md) |
| **unacceptable behavior by someone** | [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — the contact is there |

> **TODO(humano):** GitHub Discussions is **disabled** in this
> repository. Usage questions are the case that benefits most from it — they do
> not become issues, they do not carry a "resolved" status, and the answer serves the next
> person. If you want to enable it (*Settings → Features → Discussions*),
> replace the first row of the table with a link to Discussions and adjust
> `.github/ISSUE_TEMPLATE/config.yml`, which already has the link commented out.

## Before opening one

Three things that solve a good share of cases:

1. **Search the existing issues**, closed ones included.
2. **Check the documentation** — in particular
   [Getting started](docs/getting-started.md) for setup problems and the
   [Runbook](docs/runbook.md) for operation. Both have a symptom → cause table.
3. **An agent behaving strangely** (empty, truncated or very slow response)
   is almost never a code bug: it is the
   [inference environment](docs/runbook.md#ambiente-de-inferencia). Check
   that section before reporting.

## What helps in a report

Version (`BRABO_VERSION` or the tag), how you are running it (dev compose,
production compose, Kubernetes), what you expected, what happened, and the
relevant log. The issue templates ask for this — filling it in saves a whole
round of "which version?".

## Response time

This project is maintained in spare time. I usually respond within a week. No
SLA, no commercial support.
