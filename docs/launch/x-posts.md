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

## Weekly update template

Week N of Base Attribution OS:

- shipped:
- validated:
- integrations requested:
- biggest attribution bug found:
- next:

Repo: https://github.com/horn111/base-attribution-os
