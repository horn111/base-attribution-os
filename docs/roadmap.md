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

## v0.2 (shipped)

- Smart Wallet Attribution Kit for EIP-5792 and ERC-4337 flows.
- Attribution Proof Loop with Dune and RPC replay.
- Eight-package release verification and public proof surfaces.
- Wider scanner coverage for Privy, raw RPC, smart wallets, x402, and agents.

## Update 7 (shipped)

- Pure replay API in `@base-attribution-os/core`.
- `bao replay` for Dune JSON and CSV exports or batched RPC transaction hashes.
- `bao proof` for publishable single-transaction reports.
- [Attribution Proof Loop guide](attribution-proof-loop.md) and
  [Dune query templates](../dune/).
- Public [Attribution Observatory](https://base-attribution-os.vercel.app/observatory)
  and [BAO proof](https://base-attribution-os.vercel.app/proof/bc_vwmzy653).
- Dynamic, grid-free Open Graph proof card.

## v0.3 (shipped)

- Enforce the Base Builder Code format and custom-registry chain IDs.
- Preserve adapter prototypes and method context across viem and ethers.
- Validate scanner configuration, stabilize fingerprints, and respect rule
  severity in SARIF.
- Verify all eight packed packages and the bundled GitHub Action before release.
- Publish package-level READMEs and complete npm metadata.

The `v0.3.0` train shipped the hardening baseline, public x402 seller and
multi-file wallet fixtures, Base mainnet calldata snapshots, and the first
deep Stack the Bag production pilot.

## v0.4 (shipped)

The [v0.4.0 release brief](releases/v0.4.0.md) records the shipped package
versions and Stack the Bag qualification.

- Resolve attribution evidence across bounded npm/pnpm workspaces, tsconfig
  aliases, package exports, and re-export chains.
- Apply changed-only scans to the affected dependency and consumer closure.
- Publish broken/fixed monorepo fixtures for all supported transaction families.
- Qualify candidate packages through a partial Stack the Bag pilot while its
  sponsored and USDC paths remain in development.

## v0.5 (shipped)

The [v0.5.0 release brief](releases/v0.5.0.md) records the shipped reproducible
Proof Sets and local Observatory analytics without a hosted ingestion service.

- Combine multiple replay reports into a validated, schema-versioned manifest.
- Publish BAO mainnet and Stack the Bag Sepolia evidence through a static registry.
- Add shareable proof cards and per-report progress without telemetry or runtime RPC calls.
- Verify the public Proof Set API and CLI from all eight packed packages.

## Future v0 releases

- Additional public pilot integration reports.
- Broader transaction evidence after sponsored and USDC paths ship.

## v1

- Stable public APIs.
- Strong compatibility policy.
- Documented upgrade path from scanner MVP to AST-backed validation.
