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
- App and game migration layer RFC.
- Migration Planner demo for Base Pay, internal credits, tickets, entitlements,
  and Builder Code attribution.
- x402 Builder Codes CI support for buyer and seller payment paths.

## v0.1

- `payments-core` primitives for Base Pay order creation, verification, and
  replay-safe fulfillment events.
- `entitlements-core` primitives for credits, tickets, unlocks, balance reads,
  and consumption events.
- Better scanner rules with AST parsing.
- Wallet `sendCalls` middleware examples.
- Public fixture set for real transaction calldata.

## v0.2

- Nakama adapter for game ticket packs and wallet ledger fulfillment.
- Next.js or Hono adapter for app credit packs and entitlement checks.
- Dune query templates for attribution replay.
- Local analytics dashboard.
- Shareable progress cards for X.
- Pilot integration reports.

## v1

- Stable public APIs.
- Strong compatibility policy.
- Documented migration path from scanner MVP to AST-backed validation.
