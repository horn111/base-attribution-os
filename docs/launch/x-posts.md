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

## App and game migration RFC post

Shipped Base Attribution OS update 3.

The project is expanding from Builder Code CI into an app/game migration layer:

- Base Pay purchases
- server verification
- internal credits, tickets, and entitlements
- Builder Code attribution
- a new Migration Planner demo

Star the repo if existing apps and games should have a faster path to Base:
https://github.com/horn111/base-attribution-os

Demo: [Vercel URL]

@base @CoinbaseDev

## App and game migration RFC next-update teaser

Next update is already scoped:

x402 Builder Codes CI support.

The goal: check both buyer and seller x402 attribution paths before deploy,
without replacing the official x402 SDK.

Builder Codes should be native in payment flows and boring in CI.

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

`payments-core` + `entitlements-core` primitives.

The goal: turn the app/game migration RFC into installable building blocks for
order creation, replay-safe fulfillment, internal credits, tickets, and
entitlements.

Base monetization should feel like adding a thin layer, not rebuilding the
product.

## Weekly update template

Week N of Base Attribution OS:

- shipped:
- validated:
- integrations requested:
- biggest attribution bug found:
- next:

Repo: https://github.com/horn111/base-attribution-os
