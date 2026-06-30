# Impact Metrics

Base Attribution OS should measure success in Base-native terms: attribution
coverage, validated transaction paths, integrations, and downstream analytics
readiness.

## Current baseline

Update before submission:

| Metric                   | Current value                          | Source      |
| ------------------------ | -------------------------------------- | ----------- |
| GitHub stars             | `[STAR_COUNT]`                         | GitHub repo |
| Forks                    | `[FORK_COUNT]`                         | GitHub repo |
| Demo URL                 | https://base-attribution-os.vercel.app | Vercel      |
| Published npm packages   | `0` until `v0.1.0`                     | npm         |
| Public pilots            | `0/3 target`                           | issues/docs |
| Public attribution cases | `0` until first case report            | issues/docs |

## Product metrics

Track these for each release:

- packages published;
- package downloads;
- GitHub Action workflow references;
- `bao scan-repo` candidate files checked in pilots;
- missing-attribution findings caught before deploy;
- wrong-builder-code findings caught before deploy;
- number of scanner families covered;
- number of docs/examples copied into external projects.

## Ecosystem metrics

Track these for grant reporting:

- apps or games that adopt Builder Code checks;
- x402 routes with verified Builder Code extension coverage;
- wallet, `sendCalls`, or agent flows validated;
- transaction hashes or calldata samples decoded by `bao`;
- Dune/replay examples showing attributed activity;
- public mentions, X updates, and demo views.

## Reporting cadence

- Weekly: public X update with shipped work, validation examples, and next step.
- Per pilot: short case note with stack, failure caught, fix, and screenshot.
- Per milestone: grant report with deliverables, metrics, risks, and links.

## Success thresholds

First grant cycle targets:

- 3 pilot integrations or fixture repos;
- 10+ public issue/discussion interactions or integration requests;
- 300+ GitHub stars target after launch push;
- at least 1 public attribution replay/report artifact;
- at least 1 x402-specific integration example beyond the demo.
