# Roadmap

## MVP

- Core ERC-8021 helpers.
- viem and wagmi packages.
- CLI encode, decode, check-calldata, check-tx, and scan-repo commands.
- GitHub Action for CI enforcement.
- Examples and launch docs.
- Scanner v0.2 for viem, wagmi, wallet, and agent transaction flows.
- ethers adapter.
- Scanner profiles for local, CI, and strict enforcement.
- Vercel scanner playground.
- x402 Builder Codes CI support for buyer and seller payment paths.
- v0.1 release candidate verification script and pilot docs.
- Update 6 Attribution Doctor with AST-backed per-call-site analysis.
- Update 8 Smart Wallet Attribution Kit for EIP-5792 and ERC-4337 middleware.
- Privy, raw RPC, smart-wallet, x402, and agent fixture coverage.
- `bao.config.json`, changed-only audits, baselines, JSON, and SARIF.
- GitHub Action inline annotations and coverage summaries.
- Attribution Audit demo with broken/fixed fixtures.
- Update 7 Attribution Proof Loop with Dune and RPC replay, public proof
  artifacts, and the Attribution Observatory.

## v0.1 (shipped)

- Published `@base-attribution-os/*` packages at `v0.1.0`.
- Stable GitHub Action ref at `v0`.
- External consumer install verification from the original seven packed packages.

## Update 7 (shipped)

- Pure replay API in `@base-attribution-os/core`.
- `bao replay` for Dune JSON and CSV exports or batched RPC transaction hashes.
- `bao proof` for publishable single-transaction reports.
- [Attribution Proof Loop guide](attribution-proof-loop.md) and
  [Dune query templates](../dune/).
- Public [Attribution Observatory](https://base-attribution-os.vercel.app/observatory)
  and [BAO proof](https://base-attribution-os.vercel.app/proof/bc_vwmzy653).
- Dynamic, grid-free Open Graph proof card.

## Next

- Validate rules against at least three external or self-owned production apps.
- Add public x402 seller and multi-file wallet fixtures.
- Tune project-level evidence across more monorepo layouts.
- Public fixture set for real transaction calldata.

## v0.2

- Expand the Attribution Observatory with local analytics.
- Add shareable progress cards for broader proof sets.
- Pilot integration reports.

## v1

- Stable public APIs.
- Strong compatibility policy.
- Documented upgrade path from scanner MVP to AST-backed validation.
