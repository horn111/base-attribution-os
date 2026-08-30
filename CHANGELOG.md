# Changelog

All notable changes to Base Attribution OS will be documented here.

This project uses Changesets. Each package release should include a short note
that explains the attribution workflow it improves.

## 0.4.0 - 2026-08-30

- Resolve attribution evidence across workspace packages, tsconfig aliases, package exports, and re-export chains without traversing external dependencies.
- Expand changed-only scans to the affected dependency and consumer closure.
- Add strict monorepo fixtures for every supported transaction family, including wrong-code, dynamic, cyclic, and malformed-layout regressions.
- Load `bao.config.json` from `bao scan-repo` and expose bounded workspace overrides.
- Include the v0.3 post-release validation, adapter, wallet, CLI, Action, and workflow hardening fixes.

## 0.3.0 - 2026-08-28

- Enforce the Base Builder Code format and require chain IDs for custom
  registries.
- Preserve viem and ethers adapter prototypes and method context.
- Validate scanner configuration, stabilize fingerprints, and respect rule
  severity in SARIF.
- Add public x402 seller, multi-file wallet, and Base mainnet calldata fixtures.
- Verify all eight packed packages and the bundled GitHub Action against a
  temporary external consumer.
- Qualify the release through the Stack the Bag production pilot.

## 0.2.0 - 2026-08-25

- Add capability-aware EIP-5792 and ERC-4337 attribution middleware in the new
  `@base-attribution-os/wallet` package.
- Add Attribution Proof Loop commands, Dune and RPC replay, and publishable
  transaction proof reports.
- Expand the scanner across Privy, raw RPC, smart-wallet, x402, and agent
  transaction paths.
- Add the public Attribution Observatory and verified Base mainnet proof.
- Pack and install all eight public packages during release-candidate
  verification.

## 0.1.0 - 2026-08-19

- Publish the core, scanner, viem, wagmi, ethers, CLI, and GitHub Action
  packages under the `@base-attribution-os` scope.
- Ship Attribution Doctor with project coverage, baselines, changed-only scans,
  JSON, SARIF, and GitHub annotations.
- Add verified ERC-8021 helpers and transaction checks for Base Builder Codes.
- Upgrade the public demo to Next.js 16 and React 19 and clear the production
  dependency audit.
- Run the GitHub Action as a CommonJS bundle on Node.js 24 and update the SARIF
  upload workflow to CodeQL Action v4.

## 0.0.0

- Initial public scaffold for the SDK, CLI, GitHub Action, examples, and launch docs.
