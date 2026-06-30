# Grant Milestones

This milestone plan assumes Base Attribution OS is applying for ecosystem-style
funding as open-source attribution infrastructure for Base builders.

## Milestone 1: Public OSS Release

Goal: make BAO installable and stable enough for external builders.

Deliverables:

- publish `@base-attribution-os/core`, `viem`, `wagmi`, `ethers`, `cli`, and
  `github-action` packages as `v0.1.0`;
- create GitHub tags `v0.1.0` and `v0`;
- update all grant-facing Action snippets from `@main` to `@v0`;
- verify install in a fresh external project;
- keep Vercel demo live and linked from README.

Acceptance criteria:

- `pnpm add @base-attribution-os/core @base-attribution-os/viem` works in a new
  project;
- `bao encode --code bc_abc123` works from the installed CLI;
- a fixture workflow can use `horn111/base-attribution-os/packages/github-action@v0`;
- README no longer needs pre-release install instructions.

## Milestone 2: Attribution Adoption Pilots

Goal: prove BAO catches attribution failures in real integration shapes.

Deliverables:

- one app or dApp pilot using viem, wagmi, or ethers;
- one x402 buyer or seller pilot;
- one wallet, `sendCalls`, or agent pilot;
- public fixture repo or PR for each pilot;
- integration notes covering what BAO caught and what changed.

Acceptance criteria:

- 3 repos or public cases validated with `bao scan-repo`;
- at least one missing-attribution case caught before deploy;
- at least one wrong-builder-code case caught before deploy;
- docs link to all pilot artifacts.

## Milestone 3: Measurement Layer

Goal: connect attribution validation to Base ecosystem measurement.

Deliverables:

- attribution replay guide or Dune query templates;
- public report explaining how Builder Code validation improves downstream
  analytics;
- first public list of validated transaction examples or fixture calldata;
- roadmap update for `payments-core`, `entitlements-core`, and app/game
  migration adapters.

Acceptance criteria:

- a reviewer can trace source code -> Builder Code suffix -> validated tx or
  calldata -> analytics/replay artifact;
- public report includes metrics from pilots and CI scans;
- next-stage roadmap is scoped enough for a follow-up grant or pilot push.
