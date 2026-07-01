# Evidence Pack

This file gathers reviewer-facing proof for a Base/Coinbase ecosystem-style
grant submission.

## Core links

- Repository: https://github.com/horn111/base-attribution-os
- Demo: https://base-attribution-os.vercel.app
- Maintainer: https://github.com/horn111
- Builder Code: `bc_vwmzy653`
- README: ../../README.md
- Onchain proof: ../onchain-proof.md
- Grant brief: ../grant-brief.md
- Roadmap: ../roadmap.md

## Official context

- Base Builder Codes:
  https://docs.base.org/apps/builder-codes/builder-codes
- Base app developers:
  https://docs.base.org/apps/builder-codes/app-developers
- Base wallet developers:
  https://docs.base.org/apps/builder-codes/wallet-developers
- Base agent developers:
  https://docs.base.org/apps/builder-codes/agent-developers
- Coinbase x402 Builder Codes:
  https://docs.cdp.coinbase.com/x402/builder-code.skill
- Base Rewards:
  https://docs.base.org/apps/growth/rewards
- Dune EIP-8021 parser:
  https://docs.dune.com/query-engine/Functions-and-operators/eip-8021

## Shipped evidence

- CLI implementation: `packages/cli/src`
- GitHub Action: `packages/github-action`
- Demo app: `apps/docs`
- x402 scanner docs: `docs/x402-builder-codes.md`
- Onchain proof tracker: `docs/onchain-proof.md`
- CI validation docs: `docs/ci-validation.md`
- Launch content: `docs/launch/x-posts.md`

## Demo reviewer path

1. Open https://base-attribution-os.vercel.app.
2. Start in Scanner mode.
3. Select `x402 client` and show missing attribution.
4. Select `x402 seller` and show passing Builder Code attribution.
5. Switch through `local`, `ci`, and `strict` profiles.
6. Copy the GitHub Action YAML.

## Screenshots and social proof

Add final assets before submission:

- `[SCREENSHOT_SCANNER]`
- `[X_UPDATE_4_URL]`
- `[COMMENT_ON_BASE_X402_POST_URL]`
- `[GITHUB_RELEASE_URL]`

## Release evidence checklist

Before final grant submission:

- npm packages published as `v0.1.0`;
- GitHub tags `v0.1.0` and `v0` created;
- Action snippets updated to `@v0`;
- README pre-release warning removed;
- first Base mainnet transaction attributed with `bc_vwmzy653` verified by
  `bao check-tx`;
- fresh external install verified;
- demo production build verified;
- issue templates enabled;
- first integration request or attribution case opened.
