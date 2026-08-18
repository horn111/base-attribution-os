# X Post Engine

Use one post per concrete release. Keep the metric or demo visible in the first
line.

## Launch post

Builder Codes should live in CI, not only in docs.

Just shipped Base Attribution OS: OSS helpers for viem/wagmi, a `bao` validator
CLI, and a GitHub Action that catches missing Base attribution before deploy.

Repo: https://github.com/horn111/base-attribution-os

## Demo post

Before: a Base app sends txs and hopes attribution was added.

After: `bao check-calldata --expect bc_abc123` catches the suffix locally, and
CI fails if a PR removes it.

Builder Codes become part of the dev loop.

## Adapter post

Today: viem helper for Base Builder Codes.

One line creates the ERC-8021 `dataSuffix`. One CI check keeps it from
disappearing later.

Next: wallet middleware and agent flows.

## GitHub Action post

Builder Codes do not need another checklist.

They need a failing PR check.

Shipped: `validate-attribution.yml` for Base apps.

## Scanner v0.2 post

Shipped Base Attribution OS update 1:

`bao scan-repo` now catches more unattributed tx flows before they hit mainnet.

New scanner families:

- viem
- wagmi
- wallet sendCalls
- agent transaction tools

Builder Codes should be enforced like tests.

Repo: https://github.com/horn111/base-attribution-os

## Scanner v0.2 next-update teaser

Next update:

ethers adapter + scanner profiles.

Goal: let teams choose strict CI checks for production paths and lighter local
checks while integrating Base Builder Codes.

## ethers + scanner profiles post

Shipped Base Attribution OS update 2:

ethers adapter + scanner profiles.

Now teams can append Base Builder Code attribution in ethers transaction flows
and choose how hard CI should enforce it:

- `local`: report while integrating
- `ci`: fail obvious misses
- `strict`: require the expected code in tx files

SDK attribution should feel boring, automatic, and hard to forget.

Repo: https://github.com/horn111/base-attribution-os

## ethers + scanner profiles next-update teaser

Next update:

wallet `sendCalls` middleware examples + stricter real-world fixtures.

Goal: make batched wallet flows attribution-safe before they hit production.

## Vercel demo post

Shipped a live Base Attribution OS demo.

Try the scanner playground in your browser:

- pick x402, viem, wagmi, ethers, wallet, or agent code
- switch `local`, `ci`, and `strict` profiles
- copy the GitHub Action config

Star the repo if Builder Code attribution belongs in CI:
https://github.com/horn111/base-attribution-os

Demo: [Vercel URL]

## x402 Builder Codes CI post

Shipped Base Attribution OS update 4.

x402 Builder Codes are now part of the scanner.

BAO checks buyer/client and seller/resource-server payment paths before deploy:

- `x402Client`
- `wrapFetchWithPayment`
- `BuilderCodeClientExtension`
- `paymentMiddleware`
- `x402ResourceServer`
- `declareBuilderCodeExtension`

Official x402 gives teams the Builder Code extension.

BAO makes sure it stays in the code paths that ship.

Star the repo if x402 Builder Code attribution belongs in CI:
https://github.com/horn111/base-attribution-os

Demo: [Vercel URL]

@base @CoinbaseDev

## x402 Builder Codes CI next-update teaser

Next update:

wallet + agent attribution fixtures.

The goal: make batched wallet calls and autonomous transaction tools easier to
validate before deploy.

Builder Codes should stay attached even when transaction paths get abstracted.

## v0.1 release candidate post

Base Attribution OS update 5:

BAO is moving from MVP to v0.1 release candidate.

New this round:

- package smoke test via `pnpm pack`
- fresh external consumer install
- `bao encode/check-calldata/scan-repo` verification
- pilot integration guide for Base builders

Star the repo if Builder Code attribution belongs in CI:
https://github.com/horn111/base-attribution-os

Opening pilot requests for x402, wallet, app, and agent transaction paths.

## v0.1 release candidate next-update teaser

Next update:

wallet + agent attribution fixtures.

The goal: public examples that show BAO catching missing Builder Codes in
batched wallet calls and autonomous transaction tools before deploy.

## Attribution Doctor post

Base Attribution OS Update 6.

BAO can now audit an entire Base project, not just spot a marker in one file.

Attribution Doctor finds transaction paths across Privy, Wagmi, Viem, ethers,
raw RPC, smart wallets, x402, and agents, then reports what is protected, missing,
wrong, or impossible to verify statically.

Also shipped:

- AST-backed rules
- `bao.config.json`
- changed-only CI and baselines
- JSON and SARIF reports
- GitHub annotations and coverage summaries
- public broken/fixed fixtures

Try the audit demo:
https://base-attribution-os.vercel.app

Star the repo if Builder Code attribution should be testable before deploy:
https://github.com/horn111/base-attribution-os

@base @CoinbaseDev

## Attribution Doctor next-update teaser

Next: run Attribution Doctor against real production repositories.

The goal is not another synthetic scanner score. It is public pilot reports
showing which transaction paths lost attribution, what BAO caught, and what
changed before deploy.

## Weekly update template

Week N of Base Attribution OS:

- shipped:
- validated:
- integrations requested:
- biggest attribution bug found:
- next:

Repo: https://github.com/horn111/base-attribution-os
