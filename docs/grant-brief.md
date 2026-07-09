# Grant Brief

Status: grant-ready draft for Base/Coinbase ecosystem-style funding.

## Project

Base Attribution OS is open-source attribution infrastructure for Base builders.
It helps teams add, validate, and enforce Builder Codes across SDK transaction
clients, x402 payment paths, wallets, agents, and CI.

The project is independent OSS by [horn111](https://github.com/horn111). It is
designed to complement Base Builder Codes, Base.dev analytics, x402, and the
broader Base growth stack.

## Problem

Builder Codes make attribution native onchain, but integration still fails in
ordinary developer workflows:

- transaction helpers ship without the ERC-8021 suffix;
- x402 buyer or seller code omits the official Builder Code extension;
- wallets, agents, and batch flows hide attribution bugs until after deploy;
- teams cannot show Base reviewers a repeatable validation path.

The result is silent attribution loss. That hurts analytics, rewards readiness,
ecosystem visibility, and the ability to measure which apps and builders are
actually driving Base activity.

## Why Base should care

Base already treats attribution as a key part of rewards, analytics, growth,
and app visibility. Base Attribution OS turns attribution into a testable
developer workflow:

- SDK helpers append ERC-8021 suffixes for viem, wagmi, and ethers flows;
- `bao` validates calldata, transactions, and repository source paths;
- GitHub Action checks fail pull requests before production regressions ship;
- x402 scanner support verifies buyer and seller Builder Code integration paths;
- Dune/replay work can connect validated code paths to measurable attributed
  activity.

This is not a competing platform. BAO is a thin OSS layer between official docs
and production code.

## Shipped work

- TypeScript monorepo with core, viem, wagmi, ethers, CLI, and GitHub Action
  packages.
- ERC-8021 suffix encode, decode, append, and validation logic.
- `bao` commands for `encode`, `decode`, `check-calldata`, `check-tx`, and
  `scan-repo`.
- Scanner profiles: `local`, `ci`, and `strict`.
- Scanner families: viem, wagmi, ethers, wallet `sendCalls`, agents, and x402.
- Vercel demo: Scanner playground for transaction and x402 attribution checks.
- Docs for CI validation, x402 Builder Codes, integrations, architecture,
  roadmap, and launch content.

Demo: [base-attribution-os.vercel.app](https://base-attribution-os.vercel.app)

Repo: [github.com/horn111/base-attribution-os](https://github.com/horn111/base-attribution-os)

## Grant request

Requested funding: milestone-scoped Base Builder Grant.

BAO already has a working MVP, live demo, release-candidate install path, and
verified onchain attribution proof. Funding would turn that foundation into
reusable Base ecosystem infrastructure: a public release, pilot integrations,
fixture repos, Dune/replay measurement templates, and ongoing scanner coverage
as Builder Code and x402 integration patterns evolve.

## Why funding is needed

Builder Code attribution is only valuable if it survives real production paths.
That requires more than a library release. It requires testing against actual
apps, x402 flows, wallet calls, agent tooling, CI workflows, and analytics
surfaces.

Grant funding would support the work that is hardest to sustain as unpaid OSS
maintenance:

- supporting pilot teams while they integrate BAO into real repositories;
- keeping scanner coverage current as official Builder Code and x402 patterns
  change;
- publishing public fixture repos that reviewers and builders can inspect;
- documenting real attribution regressions caught before deploy;
- connecting validation output to Dune/replay measurement so Base can see how
  attribution tooling maps to ecosystem activity.

Without funding, BAO can remain a useful OSS repo. With funding, it can become a
repeatable attribution validation layer for Base builders.

## Funded work plan

### Workstream 1: v0.1 Public Release

Deliverables:

- publish `@base-attribution-os/*` packages as `v0.1.0`;
- create stable GitHub tags `v0.1.0` and `v0`;
- pin GitHub Action docs to `@v0`;
- remove pre-release install warnings from README;
- verify install in a fresh external repo.

Success metric: an external Base builder can install BAO, add attribution, and
run CI without cloning the monorepo.

Why it matters: this makes BAO usable outside the maintainer's repo and gives
Base teams a stable install path for CI validation.

### Workstream 2: Attribution Adoption Pilots

Deliverables:

- complete three pilot integrations or public fixture repos;
- cover at least one app flow, one x402 flow, and one wallet or agent flow;
- publish PR examples showing missing and wrong Builder Codes caught by CI;
- collect issue templates and case reports from pilot usage.

Success metric: three transaction paths validated with `bao`, including at
least one external pilot where possible and public artifacts reviewers can
inspect.

Why it matters: this proves BAO catches attribution regressions in practical
Base builder workflows, not only in synthetic examples.

### Workstream 3: Measurement Layer

Deliverables:

- Dune query templates or an attribution replay guide;
- public report connecting BAO validation to attributed transaction analysis;
- wallet, agent, and x402 fixture coverage for reviewer inspection;
- summary of adoption metrics and next integration targets.

Success metric: reviewers can see how BAO moves from developer tooling to
Base ecosystem measurement.

Why it matters: Base can evaluate the project in native terms: attribution
coverage, validated transaction paths, CI adoption, and measurable Builder Code
activity.

## Measurable outcomes

- GitHub stars, forks, and watchers.
- npm package downloads after `v0.1.0`.
- GitHub Action installs or workflow references.
- Number of candidate transaction files scanned by pilot repos.
- Number of missing or wrong Builder Code findings caught before deploy.
- Number of public attribution cases or validated transactions.
- X posts, demo views, and public integration requests.

## Risks and mitigations

- Risk: Base or Coinbase ships adjacent tooling.
  Mitigation: BAO stays framework-agnostic and focuses on CI, adapters, and
  validation surfaces that complement official SDKs.

- Risk: Builder Code or x402 APIs change.
  Mitigation: scanner rules are small, tested, and easy to update; official docs
  are linked throughout the repo.

- Risk: adoption claims are too early.
  Mitigation: grant milestones prioritize public pilots, fixture repos, and
  measurement artifacts over vague growth promises.

## Evidence

See [docs/grant/evidence-pack.md](grant/evidence-pack.md) for reviewer links,
demo flows, release evidence, and public update materials.
