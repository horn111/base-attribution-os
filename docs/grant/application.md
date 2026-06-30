# Grant Application Draft

Use this as copy-paste source for Base/Coinbase ecosystem-style grant forms.
Replace bracketed fields before submission.

## Project name

Base Attribution OS

## One-line summary

Open-source SDK, CLI, CI, and scanner tooling that helps Base builders add,
validate, and enforce Builder Code attribution before transactions ship.

## Website, repository, and demo

- Repository: https://github.com/horn111/base-attribution-os
- Demo: https://base-attribution-os.vercel.app
- Maintainer: https://github.com/horn111

## What are you building?

Base Attribution OS is open-source attribution infrastructure for Base builders.
It turns Builder Codes from a documentation checklist into an enforceable
developer workflow.

The current release includes ERC-8021 suffix helpers, viem/wagmi/ethers
adapters, a `bao` CLI, GitHub Action enforcement, scanner profiles, x402
Builder Code checks, and a live demo with Scanner and Migration Planner modes.

The next funded phase will turn this into a public release and adoption program:
stable npm packages, stable GitHub Action tags, pilot integrations, and
measurement artifacts that show how attribution improves Base analytics and
growth reporting.

## Why does this matter for Base?

Base Builder Codes only create value when attribution survives real production
workflows. Apps, wallets, agents, and x402 payment routes can all lose
attribution silently when teams refactor transaction code or forget an official
extension.

Base Attribution OS catches those failures before deploy. It helps builders
ship measurable onchain activity, helps teams prepare for analytics and rewards
surfaces, and gives Base ecosystem reviewers a repeatable way to inspect
attribution readiness.

## What has shipped?

- TypeScript monorepo with core, viem, wagmi, ethers, CLI, and GitHub Action
  packages.
- `bao encode`, `decode`, `check-calldata`, `check-tx`, and `scan-repo`.
- Scanner profiles: `local`, `ci`, `strict`.
- Scanner families: viem, wagmi, ethers, wallet, agent, and x402.
- GitHub Action wrapper for pull request enforcement.
- Live Vercel demo for Scanner and Migration Planner workflows.
- RFC for app/game migration through Base Pay, internal credits or tickets,
  entitlements, and Builder Code attribution.

## Funding request

Requested amount: `[REQUEST_AMOUNT]`

Funding will support three milestones:

1. Public OSS release with stable npm packages and GitHub Action tags.
2. Three pilot integrations or public fixture repos.
3. Measurement layer with Dune/replay templates and a public attribution report.

## Milestones and timeline

Milestone 1: Public OSS Release, `[TIMEBOX]`

- publish `@base-attribution-os/*` packages as `v0.1.0`;
- create stable `v0.1.0` and `v0` GitHub tags;
- verify package install and Action usage in a fresh repo;
- update README and docs from pre-release to public release state.

Milestone 2: Attribution Adoption Pilots, `[TIMEBOX]`

- validate one app flow, one x402 payment flow, and one wallet or agent flow;
- publish fixture repos or public PR examples;
- document missing/wrong Builder Code cases caught by CI.

Milestone 3: Measurement Layer, `[TIMEBOX]`

- publish attribution replay or Dune query templates;
- document how validated Builder Codes become measurable activity;
- produce a public grant report and next-stage roadmap.

## Success metrics

- external teams can install and run BAO without cloning the monorepo;
- 3 pilot integrations or fixture repos;
- public examples of CI catching attribution regressions;
- first attribution replay/report artifacts;
- increased GitHub stars, issue activity, demo usage, and integration requests.

## Risks

The main risk is that official Base or Coinbase tooling may add adjacent
features. BAO mitigates this by staying thin and complementary: it validates
integration paths, wraps common SDK usage, and gives teams CI enforcement rather
than replacing official Builder Code, x402, Base Pay, or Base.dev primitives.
