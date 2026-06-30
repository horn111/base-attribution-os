# Grant Brief

Status: grant-ready draft for Base/Coinbase ecosystem-style funding.

## Project

Base Attribution OS is open-source attribution infrastructure for Base builders.
It helps teams add, validate, and enforce Builder Codes across SDK transaction
clients, x402 payment paths, wallets, agents, and CI.

The project is independent OSS by [horn111](https://github.com/horn111). It is
designed to complement Base Builder Codes, Base.dev analytics, x402, Base Pay,
and the broader Base growth stack.

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
- Migration Planner previews how existing apps and games can move monetization
  to Base with attribution intact.

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
- Vercel demo: Scanner playground plus App & Game Migration Planner.
- Docs for CI validation, x402 Builder Codes, app/game migration, integrations,
  architecture, roadmap, and launch content.

Demo: [base-attribution-os.vercel.app](https://base-attribution-os.vercel.app)

Repo: [github.com/horn111/base-attribution-os](https://github.com/horn111/base-attribution-os)

## Grant request

Requested funding: `[REQUEST_AMOUNT]`

Recommended structure: milestone-based grant for open-source attribution
infrastructure. The ask should fund public release work, pilot integrations, and
measurement/reporting so the project can prove impact in Base-native terms.

## Milestones

### Milestone 1: Public OSS Release

Deliverables:

- publish `@base-attribution-os/*` packages as `v0.1.0`;
- create stable GitHub tags `v0.1.0` and `v0`;
- pin GitHub Action docs to `@v0`;
- remove pre-release install warnings from README;
- verify install in a fresh external repo.

Success metric: an external Base builder can install BAO, add attribution, and
run CI without cloning the monorepo.

### Milestone 2: Attribution Adoption Pilots

Deliverables:

- complete three pilot integrations or public fixture repos;
- cover at least one app flow, one x402 flow, and one wallet or agent flow;
- publish PR examples showing missing and wrong Builder Codes caught by CI;
- collect issue templates and case reports from pilot usage.

Success metric: three real or self-owned projects validated with `bao`, with
public artifacts reviewers can inspect.

### Milestone 3: Measurement Layer

Deliverables:

- Dune query templates or an attribution replay guide;
- public report connecting BAO validation to attributed transaction analysis;
- funded roadmap for `payments-core` and `entitlements-core` primitives;
- summary of adoption metrics and next integration targets.

Success metric: reviewers can see how BAO moves from developer tooling to
Base ecosystem measurement.

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

- Risk: teams need runtime monetization, not only attribution checks.
  Mitigation: `payments-core` and `entitlements-core` are scoped as the next
  funded milestone after grant-ready release work.

- Risk: adoption claims are too early.
  Mitigation: grant milestones prioritize public pilots, fixture repos, and
  measurement artifacts over vague growth promises.

## Evidence

See [docs/grant/evidence-pack.md](grant/evidence-pack.md) for reviewer links,
demo flows, release evidence, and public update materials.
